# 🐾 Critter Clash — صدام المخلوقات

An endless idle/tap monster battler in Arabic and English. Pure vanilla
JavaScript, no framework, no build step, no art assets — every creature,
background and icon is drawn procedurally by the game's own canvas renderer.
Ships to Android and iOS through Capacitor.

```bash
npm install
npm run serve        # play at http://localhost:5173
npm test             # 122 checks across balance, saves, UI and the arena
```

## What is in the game

| System | |
|---|---|
| **Critters** | 17 hand-authored tiers, then endlessly generated ones. ×2 damage milestones on key levels. |
| **Monsters** | 30 sprite archetypes, an elite in every stage, a timed boss every 5. Zones re-tint forever. |
| **Hero upgrades** | 15 gold upgrades — damage, crit, gold, boss hunting, chest timers, soul yield. |
| **Skills** | 7 actives that start deliberately weak, each with a 50-level gold upgrade track. |
| **Mutation Lab** | 5 rarities × 12 traits × 4 elements, re-rolled with gems. Survives prestige. |
| **Fusion** | Merge one critter into another for a permanent star: +15% damage each, up to 8. Survives prestige. |
| **Prestige** | Souls paid **only for stages deeper than your last prestige**, spent on 10 eternal relics. |
| **Arena** | Async PvP against real players or generated rivals, friend codes, live duels, trophies and ranks. |

Numbers are held in a custom `m × 10^e` big-number type, so stage 25 000 and a
damage figure of `10^4000` behave exactly like stage 3 does.

## Layout

```
www/            the whole game — open index.html and it runs
  js/bignum.js    arbitrary-scale numbers
  js/data.js      every balance table and progression curve
  js/state.js     save format, derived stats, persistence, migrations
  js/game.js      combat loop, prestige, fusion, scene rendering
  js/sprites.js   the procedural creature renderer
  js/arena.js     deterministic PvP resolution and share codes
  js/online.js    Firebase auth, friends, duels, cloud saves
  js/ui.js        HUD, lists, modals    js/views.js  arena + labs
tools/          tests, icon generation, release guard rails
```

## Commands

| | |
|---|---|
| `npm run serve` | play locally |
| `npm test` | big numbers, gameplay, arena, and the new-systems UI suite |
| `npm run test:endless` | nine full prestige cycles — proves progression never dead-ends |
| `npm run icons` | regenerate icons, splash screens and the Play feature graphic |
| `npm run release:check` | blocks a store upload with test ad ids or missing assets |
| `npm run bundle` | fold the whole game into one self-contained HTML file |

## Shipping it

Run `npm run release:check` first — it blocks the two mistakes that are hard to
undo (Google's test ad ids, a placeholder app id) and lists any missing store asset.

Two things Google will hold you to, neither of which the build can do for you:

- **Publish `firebase-rules.json`** to Firebase Console → Realtime Database → Rules.
  A new database is world-readable and expires after 30 days, taking the Arena with it.
- **Answer Data safety honestly.** The game uses Firebase (anonymous id, player name,
  squad summary, attack log) and optional Google Sign-In (email, display name), so
  "no data collected" is not a valid answer. `docs/privacy.html` is the matching
  policy — edit the placeholders and serve it via Settings → Pages → main /docs.

The GitHub Actions workflow builds a debug APK on every run and a signed `.aab`
once the four keystore secrets (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`,
`KEY_ALIAS`, `KEY_PASSWORD`) exist, stamping a fresh `versionCode` each time so
Play never rejects an upload as a duplicate.

## Licence

See `LICENSE`.
