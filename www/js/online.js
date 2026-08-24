/* ============================================================
   Critter Clash Idle — online multiplayer (Firebase)

   Handles: anonymous auth, player sync, matchmaking by trophies,
   friend codes, async attacks, and defense logs.
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCiCW_4MJfRwPFJteBB54RXbZCVuNLq8YM",
    authDomain: "critter-clash-4115a.firebaseapp.com",
    databaseURL: "https://critter-clash-4115a-default-rtdb.firebaseio.com",
    projectId: "critter-clash-4115a",
    storageBucket: "critter-clash-4115a.firebasestorage.app",
    messagingSenderId: "951933912495",
    appId: "1:951933912495:web:c8072a4e3541b41c6b5b5a"
  };

  let db = null;    // Firebase Realtime Database
  let auth = null;    // Firebase Auth
  let uid = null;    // current user id
  let ready = false;
  let g = null;    // reference to game state

  /* ─── Init ─────────────────────────────────────────────── */
  async function init(state) {
    g = state;

    // Ensure friendCode is always present on state immediately
    if (!g.online.friendCode) {
      g.online.friendCode = randomCode();
    }

    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
      console.warn('[online] Firebase SDK not loaded, online features running in offline mode');
      if (CC.views && CC.views.renderFriendCode) { CC.views.renderFriendCode(); }
      return false;
    }

    try {
      // Initialize Firebase (only once)
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      db = firebase.database();
      auth = firebase.auth();

      // Check redirect sign-in result if user came from Google redirect
      try {
        const redirectRes = await auth.getRedirectResult();
        if (redirectRes && redirectRes.user) {
          const user = redirectRes.user;
          uid = user.uid;
          g.online.uid = uid;
          g.online.isAnonymous = user.isAnonymous;
          g.online.email = user.email || '';
          g.online.displayName = user.displayName || '';
          const cloudState = await loadCloudState();
          if (cloudState) {
            Object.assign(g, cloudState);
            g.online.uid = uid;
            g.online.isAnonymous = false;
            CC.state.save(g, true);
            if (CC.ui && CC.ui.updateHud) CC.ui.updateHud();
            if (CC.ui && CC.ui.refreshLists) CC.ui.refreshLists(true);
          } else {
            await saveCloudState();
          }
        }
      } catch (redirErr) {
        console.warn('[online] getRedirectResult note:', redirErr);
      }

      // Sign in anonymously if not already signed in
      if (auth.currentUser) {
        uid = auth.currentUser.uid;
        g.online.uid = uid;
        g.online.isAnonymous = auth.currentUser.isAnonymous;
        g.online.email = auth.currentUser.email || '';
        g.online.displayName = auth.currentUser.displayName || '';
      } else {
        const cred = await auth.signInAnonymously();
        uid = cred.user.uid;
        g.online.uid = uid;
        g.online.isAnonymous = true;
      }

      // Claim or register friend code in Firebase
      try {
        await db.ref('codes/' + g.online.friendCode).set(uid);
      } catch (e) { /* ignore */ }

      ready = true;
      console.log('[online] Connected as', uid, 'friendCode:', g.online.friendCode);

      if (CC.views) {
        if (CC.views.renderFriendCode) CC.views.renderFriendCode();
        if (CC.views.updateOnlineStatus) CC.views.updateOnlineStatus();
        if (CC.views.renderFriendsList) CC.views.renderFriendsList();
      }

      // Sync our data to Firebase
      await syncMyData();

      // Listen for incoming attacks & live duels
      listenForAttacks();
      listenForDuels(challenge => {
        if (CC.views && CC.views.handleIncomingDuel) {
          CC.views.handleIncomingDuel(challenge);
        }
      });

      return true;
    } catch (e) {
      console.warn('[online] Firebase init failed:', e);
      if (CC.views && CC.views.renderFriendCode) { CC.views.renderFriendCode(); }
      return false;
    }
  }

  function isReady() { return ready; }

  /* ─── Friend codes ─────────────────────────────────────── */
  function randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for clarity
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  async function generateUniqueFriendCode() {
    // Try up to 10 times to find a unique code
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = randomCode();
      const snap = await db.ref('codes/' + code).once('value');
      if (!snap.exists()) {
        // Claim it
        await db.ref('codes/' + code).set(uid);
        return code;
      }
    }
    // Fallback: use first 6 of uid
    return uid.slice(0, 6).toUpperCase();
  }

  /* ─── Sync player data ─────────────────────────────────── */
  async function syncMyData() {
    if (!ready || !uid) return;
    const AR = CC.arena;
    const team = AR.myTeam(g);
    const encoded = team.length ? AR.encodeTeam(g, g.playerName) : '';

    const data = {
      name: (g.playerName || ('Player' + Math.floor(1000 + Math.random() * 9000))).slice(0, 18),
      trophies: g.arena.trophies || 0,
      bestStage: g.bestStage || 1,
      friendCode: g.online.friendCode,
      team: encoded,
      lastOnline: firebase.database.ServerValue.TIMESTAMP
    };

    try {
      await db.ref('players/' + uid).update(data);
      g.online.lastSync = Date.now();
    } catch (e) {
      console.warn('[online] sync failed:', e);
    }
  }

  /* ─── Matchmaking: find closest opponent by trophies ────── */
  async function findOpponent() {
    if (!ready) return null;
    const myTrophies = g.arena.trophies || 0;

    // Ensure our own data is up-to-date in DB before searching
    await syncMyData();

    try {
      // 1. Fetch candidates from database ordered by trophies
      const snap = await db.ref('players')
        .orderByChild('trophies')
        .limitToLast(50)
        .once('value');

      const candidates = [];
      const myCode = g.online.friendCode || '';
      snap.forEach(child => {
        const data = child.val();
        if (child.key === uid) return;  // skip self by UID
        if (data.friendCode && data.friendCode === myCode) return; // skip self by friend code
        if (!data.team) return;         // skip players with no team
        const trophies = data.trophies || 0;
        const diff = Math.abs(trophies - myTrophies);
        candidates.push({ uid: child.key, diff, trophies, ...data });
      });

      // 2. If real candidates exist, sort by closest trophies diff
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.diff - b.diff);

        // Pick among the closest matches (within +50 diff of best match)
        const bestDiff = candidates[0].diff;
        const topPool = candidates.filter(c => c.diff <= bestDiff + 50);
        const pick = topPool[Math.floor(Math.random() * topPool.length)];
        return decodeOnlineOpponent(pick);
      }

      // 3. Fallback if no other real player is in DB yet (e.g. brand new app database):
      // Generate a matched rival with trophies close to player so fight always works!
      const AR = CC.arena;
      const bot = AR.generateRival(g, Date.now() & 0xffff, 1.0);
      bot.trophies = Math.max(0, myTrophies + Math.floor(Math.random() * 40 - 20));
      bot.online = true;
      bot.generated = false; // treat as online rival
      return bot;
    } catch (e) {
      console.warn('[online] findOpponent failed:', e);
      // Fallback on error so button never hangs
      const AR = CC.arena;
      const bot = AR.generateRival(g, Date.now() & 0xffff, 1.0);
      bot.trophies = myTrophies;
      bot.online = true;
      return bot;
    }
  }

  function decodeOnlineOpponent(data) {
    try {
      const AR = CC.arena;
      const decoded = AR.decodeTeam(data.team);
      return {
        uid: data.uid || null,
        name: data.name || 'Player',
        trophies: data.trophies || 0,
        team: decoded.team,
        stage: decoded.stage || data.bestStage || 1,
        lastOnline: data.lastOnline || 0,
        online: true,
        generated: false
      };
    } catch (e) {
      console.warn('[online] decode opponent failed:', e);
      return null;
    }
  }

  /* ─── Friends ──────────────────────────────────────────── */
  async function addFriendByCode(rawCode) {
    rawCode = String(rawCode || '').trim();
    if (!rawCode) return { ok: false, error: 'invalid_code' };

    // Support team share code CC1... (case sensitive)
    if (rawCode.indexOf('CC1') === 0) {
      try {
        const AR = CC.arena;
        const decoded = AR.decodeTeam(rawCode);
        const fUid = 'friend_' + (Date.now() & 0xffff) + '_' + Math.floor(Math.random() * 1000);
        g.online.friends[fUid] = {
          name: decoded.name || 'Friend',
          trophies: Math.max(0, Math.floor((decoded.stage || 1) * 12)),
          team: rawCode,
          addedAt: Date.now()
        };
        CC.state.save(g, true);
        return { ok: true, name: decoded.name };
      } catch (e) {
        return { ok: false, error: 'invalid_code' };
      }
    }

    const code = rawCode.toUpperCase();
    if (code === (g.online.friendCode || '').toUpperCase()) {
      return { ok: false, error: 'self' };
    }

    if (!ready || !db) {
      // Local friend creation
      const fUid = 'code_' + code;
      if (g.online.friends[fUid]) return { ok: false, error: 'already_friend' };
      const friendName = 'Player_' + code.slice(0, 4);
      g.online.friends[fUid] = {
        name: friendName,
        trophies: g.arena.trophies || 0,
        friendCode: code,
        addedAt: Date.now()
      };
      CC.state.save(g, true);
      return { ok: true, name: friendName };
    }

    try {
      let friendUid = null;
      let friendData = null;

      // 1. Check codes/{code}
      const codeSnap = await db.ref('codes/' + code).once('value');
      if (codeSnap.exists()) {
        friendUid = codeSnap.val();
      } else {
        // 2. Query players by friendCode
        const pSnap = await db.ref('players').orderByChild('friendCode').equalTo(code).once('value');
        if (pSnap.exists()) {
          pSnap.forEach(ch => {
            friendUid = ch.key;
            friendData = ch.val();
          });
        }
      }

      if (friendUid && friendUid === uid) return { ok: false, error: 'self' };
      if (friendUid && g.online.friends[friendUid]) return { ok: false, error: 'already_friend' };

      if (friendUid) {
        if (!friendData) {
          const friendSnap = await db.ref('players/' + friendUid).once('value');
          friendData = friendSnap.exists() ? friendSnap.val() : {};
        }

        try {
          await db.ref('players/' + uid + '/friends/' + friendUid).set(true);
          await db.ref('players/' + friendUid + '/friends/' + uid).set(true);
        } catch (e) { /* ignore */ }

        g.online.friends[friendUid] = {
          name: friendData.name || ('Player_' + code.slice(0, 4)),
          trophies: friendData.trophies || 0,
          team: friendData.team || '',
          friendCode: code,
          addedAt: Date.now()
        };

        CC.state.save(g, true);
        return { ok: true, name: friendData.name || ('Player_' + code.slice(0, 4)) };
      }

      // If not in DB, add as offline/custom friend
      const fUid = 'code_' + code;
      if (g.online.friends[fUid]) return { ok: false, error: 'already_friend' };
      const friendName = 'Player_' + code.slice(0, 4);
      g.online.friends[fUid] = {
        name: friendName,
        trophies: g.arena.trophies || 0,
        friendCode: code,
        addedAt: Date.now()
      };
      CC.state.save(g, true);
      return { ok: true, name: friendName };
    } catch (e) {
      console.warn('[online] addFriend fallback:', e);
      const fUid = 'code_' + code;
      const friendName = 'Player_' + code.slice(0, 4);
      g.online.friends[fUid] = {
        name: friendName,
        trophies: g.arena.trophies || 0,
        friendCode: code,
        addedAt: Date.now()
      };
      CC.state.save(g, true);
      return { ok: true, name: friendName };
    }
  }

  async function getFriendsList() {
    // If not online/ready or DB query fails, always return locally cached friends
    if (!ready || !uid || !db) {
      return Object.keys(g.online.friends || {}).map(fUid => {
        const f = g.online.friends[fUid];
        return {
          uid: fUid,
          name: f.name || 'Friend',
          trophies: f.trophies || 0,
          bestStage: 1,
          team: f.team || '',
          lastOnline: 0,
          friendCode: f.friendCode || ''
        };
      });
    }

    try {
      const friendsSnap = await db.ref('players/' + uid + '/friends').once('value');
      const localKeys = Object.keys(g.online.friends || {});
      const dbKeys = friendsSnap.exists() ? Object.keys(friendsSnap.val()) : [];
      const allKeys = Array.from(new Set(dbKeys.concat(localKeys)));

      const friends = [];
      for (const fUid of allKeys.slice(0, 30)) {
        try {
          const snap = await db.ref('players/' + fUid).once('value');
          if (snap.exists()) {
            const d = snap.val();
            friends.push({
              uid: fUid,
              name: d.name || 'Player',
              trophies: d.trophies || 0,
              bestStage: d.bestStage || 1,
              team: d.team || '',
              lastOnline: d.lastOnline || 0,
              friendCode: d.friendCode || ''
            });
            g.online.friends[fUid] = {
              name: d.name,
              trophies: d.trophies || 0,
              team: d.team || '',
              friendCode: d.friendCode || '',
              addedAt: g.online.friends[fUid] ? g.online.friends[fUid].addedAt : Date.now()
            };
          } else if (g.online.friends[fUid]) {
            const f = g.online.friends[fUid];
            friends.push({
              uid: fUid,
              name: f.name || 'Player',
              trophies: f.trophies || 0,
              bestStage: 1,
              team: f.team || '',
              lastOnline: 0,
              friendCode: f.friendCode || ''
            });
          }
        } catch (e) {
          if (g.online.friends[fUid]) {
            const f = g.online.friends[fUid];
            friends.push({
              uid: fUid,
              name: f.name || 'Player',
              trophies: f.trophies || 0,
              bestStage: 1,
              team: f.team || '',
              lastOnline: 0,
              friendCode: f.friendCode || ''
            });
          }
        }
      }

      friends.sort((a, b) => b.trophies - a.trophies);
      return friends;
    } catch (e) {
      console.warn('[online] getFriendsList failed, using local cache:', e);
      return Object.keys(g.online.friends || {}).map(fUid => {
        const f = g.online.friends[fUid];
        return {
          uid: fUid,
          name: f.name || 'Friend',
          trophies: f.trophies || 0,
          bestStage: 1,
          team: f.team || '',
          lastOnline: 0,
          friendCode: f.friendCode || ''
        };
      });
    }
  }

  async function attackFriend(friendUid) {
    if (!friendUid || friendUid === uid) return null;
    const AR = CC.arena;

    if (ready && db) {
      try {
        const snap = await db.ref('players/' + friendUid).once('value');
        if (snap.exists()) {
          const data = snap.val();
          data.uid = friendUid;
          const opp = decodeOnlineOpponent(data);
          if (opp) return opp;
        }
      } catch (e) { /* fallback below */ }
    }

    // Fallback: check local friends cache
    const f = g.online.friends[friendUid];
    if (f && f.team) {
      try {
        const decoded = AR.decodeTeam(f.team);
        return {
          uid: friendUid,
          name: f.name || decoded.name || 'Friend',
          trophies: f.trophies || 0,
          team: decoded.team,
          stage: decoded.stage || 1,
          online: false,
          generated: false
        };
      } catch (e) { /* fallback below */ }
    }

    // Generated matching opponent for friend
    const bot = AR.generateRival(g, Date.now() & 0xffff, 1.0);
    bot.name = f ? f.name : 'Friend';
    bot.trophies = f ? f.trophies : g.arena.trophies || 0;
    bot.online = false;
    bot.generated = true;
    return bot;
  }

  async function removeFriend(friendUid) {
    if (!ready) return false;
    try {
      await db.ref('players/' + uid + '/friends/' + friendUid).remove();
      await db.ref('players/' + friendUid + '/friends/' + uid).remove();
      delete g.online.friends[friendUid];
      CC.state.save(g, true);
      return true;
    } catch (e) {
      console.warn('[online] removeFriend failed:', e);
      return false;
    }
  }

  /* ─── Attack result reporting ──────────────────────────── */
  async function reportAttack(oppUid, won, trophyDelta) {
    if (!ready || !oppUid) return;
    try {
      const attackData = {
        attackerUid: uid,
        attackerName: (g.playerName || CC.i18n.t('you')).slice(0, 18),
        result: won ? 'win' : 'lose',   // from attacker perspective
        trophyDelta: trophyDelta || 0,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      };
      await db.ref('attacks/' + oppUid).push(attackData);

      // Also update trophies for the defender (they lose if attacker won)
      if (won) {
        const defSnap = await db.ref('players/' + oppUid + '/trophies').once('value');
        const defTrophies = defSnap.val() || 0;
        const loss = Math.round(Math.abs(trophyDelta) * 0.6); // defender loses less
        await db.ref('players/' + oppUid + '/trophies').set(Math.max(0, defTrophies - loss));
      }

      // Sync our updated trophies
      await syncMyData();
    } catch (e) {
      console.warn('[online] reportAttack failed:', e);
    }
  }

  /* ─── Listen for incoming attacks ──────────────────────── */
  function listenForAttacks() {
    if (!ready || !uid) return;

    db.ref('attacks/' + uid)
      .orderByChild('timestamp')
      .limitToLast(20)
      .on('child_added', snap => {
        const data = snap.val();
        if (!data) return;

        // Only show recent attacks (last 24h)
        const age = Date.now() - (data.timestamp || 0);
        if (age > 86400000) return;

        // Avoid duplicate entries
        const logKey = snap.key;
        if (g.online.attackLog.some(a => a.id === logKey)) return;

        const entry = {
          id: logKey,
          attackerName: data.attackerName || 'Player',
          attackerWon: data.result === 'win',
          trophyDelta: data.trophyDelta || 0,
          timestamp: data.timestamp || Date.now()
        };

        g.online.attackLog.unshift(entry);
        // Keep only last 20 entries
        if (g.online.attackLog.length > 20) g.online.attackLog.pop();

        // Toast notification
        if (CC.ui && CC.ui.toast) {
          const T = CC.i18n;
          if (entry.attackerWon) {
            CC.ui.toast(entry.attackerName + ' ' + T.t('attacked_you_won'), 'bad');
          } else {
            CC.ui.toast(entry.attackerName + ' ' + T.t('attacked_you_lost'), 'good');
          }
        }
      });
  }

  async function getAttackLog() {
    if (!ready || !uid) return g.online.attackLog || [];

    try {
      const snap = await db.ref('attacks/' + uid)
        .orderByChild('timestamp')
        .limitToLast(20)
        .once('value');

      const entries = [];
      snap.forEach(child => {
        const data = child.val();
        entries.push({
          id: child.key,
          attackerName: data.attackerName || 'Player',
          attackerWon: data.result === 'win',
          trophyDelta: data.trophyDelta || 0,
          timestamp: data.timestamp || 0
        });
      });

      entries.sort((a, b) => b.timestamp - a.timestamp);
      g.online.attackLog = entries.slice(0, 20);
      return g.online.attackLog;
    } catch (e) {
      console.warn('[online] getAttackLog failed:', e);
      return g.online.attackLog || [];
    }
  }

  async function clearMyAttacks() {
    if (g && g.online) {
      g.online.attackLog = [];
      CC.state.save(g, true);
    }
    if (ready && db && uid) {
      try {
        await db.ref('attacks/' + uid).remove();
      } catch (e) { /* ignore */ }
    }
    return true;
  }

  /* ─── Google Authentication ────────────────────────────── */
  async function signInWithGoogle() {
    const T = CC.i18n;
    if (typeof firebase === 'undefined') {
      return { ok: false, error: 'offline', msg: (T && T.t) ? T.t('google_failed') : 'Offline' };
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      if (!auth) auth = firebase.auth();
      if (!db) db = firebase.database();
    } catch (e) {
      return { ok: false, error: 'init_failed', msg: e.message || 'Firebase init failed' };
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      let result = null;
      try {
        result = await auth.signInWithPopup(provider);
      } catch (popErr) {
        if (popErr.code === 'auth/popup-blocked') {
          await auth.signInWithRedirect(provider);
          return { ok: true, redirect: true };
        }
        throw popErr;
      }

      if (!result || !result.user) {
        return { ok: false, error: 'no_user', msg: (T && T.t) ? T.t('google_failed') : 'No user returned' };
      }

      const user = result.user;
      uid = user.uid;
      ready = true;
      g.online.uid = uid;
      g.online.isAnonymous = false;
      g.online.email = user.email || '';
      g.online.displayName = user.displayName || '';

      if (!g.playerName && user.displayName) {
        g.playerName = user.displayName.slice(0, 18);
      }

      if (!g.online.friendCode) {
        g.online.friendCode = randomCode();
      }

      // Check if this Google account already had cloud save data
      const cloudState = await loadCloudState();
      if (cloudState) {
        // Merge cloud state into active state g
        Object.assign(g, cloudState);
        g.online.uid = uid;
        g.online.isAnonymous = false;
        g.online.email = user.email || '';
        g.online.displayName = user.displayName || '';
        CC.state.save(g, true);
        if (CC.ui && CC.ui.updateHud) CC.ui.updateHud();
        if (CC.ui && CC.ui.refreshLists) CC.ui.refreshLists(true);
      } else {
        // Save current local progress to cloud
        await saveCloudState();
      }

      await syncMyData();
      CC.state.save(g, true);

      return { ok: true, user };
    } catch (e) {
      console.warn('[online] Google Sign-In failed:', e);
      let msg = (T && T.t) ? T.t('google_failed') : 'Google Sign-In failed';
      const isAr = (T && T.getLang) ? T.getLang() === 'ar' : true;
      const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'critter-clash-peach.vercel.app';
      if (e.code === 'auth/operation-not-allowed') {
        msg = isAr
          ? 'يجب تفعيل موفر Google في لوحة Firebase Console (Authentication > Sign-in method)'
          : 'Google sign-in is disabled in Firebase Console (Authentication > Sign-in method)';
      } else if (e.code === 'auth/unauthorized-domain') {
        msg = isAr
          ? 'النطاق (' + host + ') غير مضاف في Firebase Console! يرجى إضافته في Authorized Domains.'
          : 'Domain (' + host + ') is not in Firebase Authorized Domains.';
      } else if (e.code === 'auth/popup-closed-by-user') {
        msg = isAr
          ? 'تم إغلاق نافذة تسجيل الدخول'
          : 'Sign-in popup was closed';
      } else if (e.code === 'auth/popup-blocked') {
        msg = isAr
          ? 'المتصفح حظر النافذة المنبثقة، يرجى السماح بالنوافذ المنبثقة'
          : 'Popup was blocked by browser';
      } else if (e.code === 'auth/network-request-failed') {
        msg = isAr
          ? 'تعذر الاتصال بالشبكة'
          : 'Network request failed';
      } else if (e.message) {
        msg = e.message;
      }
      return { ok: false, error: e.code || 'failed', msg: msg };
    }
  }

  async function signOutGoogle() {
    if (!ready || !auth) return false;
    try {
      await auth.signOut();
      const cred = await auth.signInAnonymously();
      uid = cred.user.uid;
      g.online.uid = uid;
      g.online.isAnonymous = true;
      g.online.email = '';
      g.online.displayName = '';
      await syncMyData();
      CC.state.save(g, true);
      return true;
    } catch (e) {
      console.warn('[online] Sign-Out failed:', e);
      return false;
    }
  }

  async function saveCloudState() {
    if (!ready || !uid || (g.online && g.online.isAnonymous)) return;
    try {
      const stateJson = CC.state.exportSave(g);
      await db.ref('saves/' + uid).set({
        save: stateJson,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
    } catch (e) { /* ignore */ }
  }

  async function loadCloudState() {
    if (!ready || !uid) return null;
    try {
      const snap = await db.ref('saves/' + uid).once('value');
      if (!snap.exists()) return null;
      const data = snap.val();
      if (data && data.save) {
        return CC.state.importSave(data.save);
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /* ─── Live Friend Duels & Synchronized Spectating ──────── */
  let onDuelReceivedCallback = null;

  function listenForDuels(onReceived) {
    if (!ready || !uid) return;
    onDuelReceivedCallback = onReceived;

    db.ref('duels/' + uid)
      .orderByChild('timestamp')
      .limitToLast(5)
      .on('child_added', snap => {
        const data = snap.val();
        if (!data || data.status !== 'pending') return;

        // Skip expired challenges (older than 45s)
        const age = Date.now() - (data.timestamp || 0);
        if (age > 45000) return;

        if (onDuelReceivedCallback) {
          onDuelReceivedCallback({
            duelId: snap.key,
            challengerUid: data.challengerUid,
            challengerName: data.challengerName || 'Player',
            challengerTeam: data.challengerTeam,
            seed: data.seed
          });
        }
      });
  }

  async function sendDuelChallenge(targetUid, onStatusChange) {
    if (!ready || !uid || targetUid === uid) return null;
    const AR = CC.arena;
    const team = AR.myTeam(g);
    if (!team.length) return null;
    const encoded = AR.encodeTeam(g, g.playerName);
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e6)) >>> 0;

    const duelData = {
      challengerUid: uid,
      challengerName: (g.playerName || ('Player' + Math.floor(1000 + Math.random() * 9000))).slice(0, 18),
      challengerTeam: encoded,
      seed: seed,
      status: 'pending',
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    const ref = db.ref('duels/' + targetUid).push();
    const duelId = ref.key;
    await ref.set(duelData);

    const listener = ref.on('value', snap => {
      const val = snap.val();
      if (!val) return;
      if (val.status === 'accepted' && val.targetTeam) {
        ref.off();
        if (onStatusChange) {
          onStatusChange({
            status: 'accepted',
            duelId,
            seed: val.seed,
            oppTeam: AR.decodeTeam(val.targetTeam).team,
            oppName: val.targetName || 'Player'
          });
        }
      } else if (val.status === 'rejected') {
        ref.off();
        if (onStatusChange) onStatusChange({ status: 'rejected', duelId });
      }
    });

    return {
      duelId,
      seed,
      cancel: async () => {
        try {
          ref.off();
          await ref.update({ status: 'rejected' });
        } catch (e) { /* ignore */ }
      }
    };
  }

  async function acceptDuel(challengerUid, duelId) {
    if (!ready || !uid) return false;
    const AR = CC.arena;
    const team = AR.myTeam(g);
    if (!team.length) return false;
    const encoded = AR.encodeTeam(g, g.playerName);

    try {
      await db.ref('duels/' + uid + '/' + duelId).update({
        status: 'accepted',
        targetTeam: encoded,
        targetName: (g.playerName || ('Player' + Math.floor(1000 + Math.random() * 9000))).slice(0, 18),
        acceptedAt: firebase.database.ServerValue.TIMESTAMP
      });
      return true;
    } catch (e) {
      console.warn('[online] acceptDuel failed:', e);
      return false;
    }
  }

  async function rejectDuel(challengerUid, duelId) {
    if (!ready || !uid) return false;
    try {
      await db.ref('duels/' + uid + '/' + duelId).update({
        status: 'rejected'
      });
      return true;
    } catch (e) {
      console.warn('[online] rejectDuel failed:', e);
      return false;
    }
  }

  /* ─── Exports ──────────────────────────────────────────── */
  CC.online = {
    init, isReady, syncMyData,
    findOpponent, addFriendByCode, getFriendsList,
    attackFriend, removeFriend,
    reportAttack, getAttackLog, clearMyAttacks,
    signInWithGoogle, signOutGoogle, saveCloudState, loadCloudState,
    listenForDuels, sendDuelChallenge, acceptDuel, rejectDuel,
    get uid() { return uid; },
    get friendCode() { return g ? g.online.friendCode : ''; }
  };
})(window);
