/* ============================================================
   Critter Clash Idle — online multiplayer (Firebase)

   Handles: anonymous auth, player sync, matchmaking by trophies,
   friend codes, async attacks, and defense logs.
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});

  const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyCiCW_4MJfRwPFJteBB54RXbZCVuNLq8YM",
    authDomain:        "critter-clash-4115a.firebaseapp.com",
    databaseURL:       "https://critter-clash-4115a-default-rtdb.firebaseio.com",
    projectId:         "critter-clash-4115a",
    storageBucket:     "critter-clash-4115a.firebasestorage.app",
    messagingSenderId: "951933912495",
    appId:             "1:951933912495:web:c8072a4e3541b41c6b5b5a"
  };

  let db    = null;    // Firebase Realtime Database
  let auth  = null;    // Firebase Auth
  let uid   = null;    // current user id
  let ready = false;
  let g     = null;    // reference to game state

  /* ─── Init ─────────────────────────────────────────────── */
  async function init(state) {
    g = state;

    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
      console.warn('[online] Firebase SDK not loaded, online features disabled');
      return false;
    }

    try {
      // Initialize Firebase (only once)
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      db   = firebase.database();
      auth = firebase.auth();

      // Sign in anonymously
      const cred = await auth.signInAnonymously();
      uid = cred.user.uid;
      g.online.uid = uid;

      // Generate friend code if we don't have one
      if (!g.online.friendCode) {
        g.online.friendCode = await generateUniqueFriendCode();
      }

      ready = true;
      console.log('[online] Connected as', uid, 'friendCode:', g.online.friendCode);

      // Sync our data to Firebase
      await syncMyData();

      // Listen for incoming attacks
      listenForAttacks();

      return true;
    } catch (e) {
      console.warn('[online] Firebase init failed:', e);
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
      name:        (g.playerName || CC.i18n.t('you')).slice(0, 18),
      trophies:    g.arena.trophies || 0,
      bestStage:   g.bestStage || 1,
      friendCode:  g.online.friendCode,
      team:        encoded,
      lastOnline:  firebase.database.ServerValue.TIMESTAMP
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
      snap.forEach(child => {
        const data = child.val();
        if (child.key === uid) return;  // skip self
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
        uid:      data.uid || null,
        name:     data.name || 'Player',
        trophies: data.trophies || 0,
        team:     decoded.team,
        stage:    decoded.stage || data.bestStage || 1,
        online:   true,
        generated: false
      };
    } catch (e) {
      console.warn('[online] decode opponent failed:', e);
      return null;
    }
  }

  /* ─── Friends ──────────────────────────────────────────── */
  async function addFriendByCode(code) {
    if (!ready) return { ok: false, error: 'offline' };
    code = String(code).trim().toUpperCase();
    if (code.length < 4 || code.length > 8) return { ok: false, error: 'invalid_code' };

    try {
      // Look up friend code
      const codeSnap = await db.ref('codes/' + code).once('value');
      if (!codeSnap.exists()) return { ok: false, error: 'not_found' };

      const friendUid = codeSnap.val();
      if (friendUid === uid) return { ok: false, error: 'self' };

      // Check if already friends
      if (g.online.friends[friendUid]) return { ok: false, error: 'already_friend' };

      // Get friend's data
      const friendSnap = await db.ref('players/' + friendUid).once('value');
      if (!friendSnap.exists()) return { ok: false, error: 'not_found' };
      const friendData = friendSnap.val();

      // Add to both sides
      await db.ref('players/' + uid + '/friends/' + friendUid).set(true);
      await db.ref('players/' + friendUid + '/friends/' + uid).set(true);

      // Save locally
      g.online.friends[friendUid] = {
        name: friendData.name || 'Player',
        trophies: friendData.trophies || 0,
        addedAt: Date.now()
      };

      CC.state.save(g, true);
      return { ok: true, name: friendData.name };
    } catch (e) {
      console.warn('[online] addFriend failed:', e);
      return { ok: false, error: 'network' };
    }
  }

  async function getFriendsList() {
    if (!ready) return [];

    try {
      const friendsSnap = await db.ref('players/' + uid + '/friends').once('value');
      if (!friendsSnap.exists()) return [];

      const friendUids = Object.keys(friendsSnap.val());
      const friends = [];

      for (const fUid of friendUids.slice(0, 30)) { // cap at 30 friends
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
            // Update local cache
            g.online.friends[fUid] = {
              name: d.name,
              trophies: d.trophies || 0,
              addedAt: g.online.friends[fUid] ? g.online.friends[fUid].addedAt : Date.now()
            };
          }
        } catch (e) { /* skip individual failures */ }
      }

      friends.sort((a, b) => b.trophies - a.trophies);
      return friends;
    } catch (e) {
      console.warn('[online] getFriendsList failed:', e);
      return [];
    }
  }

  async function attackFriend(friendUid) {
    if (!ready) return null;
    try {
      const snap = await db.ref('players/' + friendUid).once('value');
      if (!snap.exists()) return null;
      const data = snap.val();
      data.uid = friendUid;
      return decodeOnlineOpponent(data);
    } catch (e) {
      console.warn('[online] attackFriend failed:', e);
      return null;
    }
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
        attackerUid:  uid,
        attackerName: (g.playerName || CC.i18n.t('you')).slice(0, 18),
        result:       won ? 'win' : 'lose',   // from attacker perspective
        trophyDelta:  trophyDelta || 0,
        timestamp:    firebase.database.ServerValue.TIMESTAMP
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
          id:           logKey,
          attackerName: data.attackerName || 'Player',
          attackerWon:  data.result === 'win',
          trophyDelta:  data.trophyDelta || 0,
          timestamp:    data.timestamp || Date.now()
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
          id:           child.key,
          attackerName: data.attackerName || 'Player',
          attackerWon:  data.result === 'win',
          trophyDelta:  data.trophyDelta || 0,
          timestamp:    data.timestamp || 0
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

  /* ─── Clear old attacks ────────────────────────────────── */
  async function clearMyAttacks() {
    if (!ready || !uid) return;
    try {
      await db.ref('attacks/' + uid).remove();
      g.online.attackLog = [];
    } catch (e) { /* ignore */ }
  }

  /* ─── Exports ──────────────────────────────────────────── */
  CC.online = {
    init, isReady, syncMyData,
    findOpponent, addFriendByCode, getFriendsList,
    attackFriend, removeFriend,
    reportAttack, getAttackLog, clearMyAttacks,
    get uid() { return uid; },
    get friendCode() { return g ? g.online.friendCode : ''; }
  };
})(window);
