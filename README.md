# Crazy Soccer

A chaotic 4v4 3D soccer game for [CrazyGames](https://www.crazygames.com) — items, slide tackles, jump volleys and no referee. Built with Three.js; all art, characters, sounds and music are generated in code (no external assets).

## Play / develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/ + crazy-soccer-html5.zip (upload this to CrazyGames)
```

The whole build is ~1 MB in 10 files (CrazyGames limits: 50 MB initial download, 1500 files).

## Controls (rebindable in Settings)

| Action | Key |
| --- | --- |
| Move | WASD / arrows (physical keys, so AZERTY works automatically) |
| Kick (hold to charge, aim with the crosshair) | Left mouse |
| Pass | T / Right mouse |
| Flick | Q |
| Tackle (goalkeepers: Dive in their own box) | E |
| Lob | F |
| Request the ball | R |
| **Jump** (no ball) / **Dribble skill** (with ball) | Space |
| Sprint | Shift |
| Use item 1 / 2 | 1 / 2, then click |
| Stats | Tab |
| Quick chat / Emotes | C / B |
| Return to lobby | L |

Escape only releases the mouse; matches never pause. Touch controls appear automatically on phones and tablets.

## Gameplay

- **4v4** on two arenas (Cliffside grass, Canyon desert) plus an indoor practice hall. Bots fill every empty spot; humans replace bots when they join.
- **Lobby**: pick JOIN RED or JOIN BLUE. Your team choice is kept when the room plays again.
- **Goalkeepers** (one per team, white kits) are the only players who can dive, and they can't be tackled.
- **Jump** to catch high balls and shoot mid-air (volley bonus).
- **Crosshair aiming**: the ball flies through the point under the crosshair, so aiming up gives a rising shot.
- **Items** from the glowing “?” boxes: Fire Shot, Ice Blast, Oil Slick, Jetpack, Grapple, Boxing Glove, Lightning Boots, Bubble Shield, Barricade, Barrel Roll.
- Rules: 6:00 matches, golden-goal overtime, last-chance extension, mercy rule (4-goal lead), goal replays.
- Progression: coins and XP, levels, daily reward, and a locker with jerseys, balls, goal effects, emotes and hairstyles. All of it is unlocked with in-game coins, with no real-money purchases.

## Multiplayer

Peer-to-peer (WebRTC via PeerJS), host-authoritative: the first player in a room runs the match and others connect directly. Quick play claims or joins public room ids; private rooms use 5-letter codes and CrazyGames invite links. If the host leaves, everyone continues against bots.

The default signalling server is the free PeerJS cloud (`0.peerjs.com`). For production scale you can self-host one (`npx peerjs --port 9000`) and set `NET.peerServer` in `src/config.js`.

## CrazyGames SDK v3 integration

`src/sdk.js` wraps every call and falls back gracefully when the SDK is unavailable:

- `loadingStart/Stop` during boot. `gameplayStart/Stop` on entering or leaving matches, menus and results.
- Midgame ads only at natural breaks (after a match). The rewarded ad doubles match coins. Audio is muted and gameplay suspended while an ad plays.
- `settings.muteAudio` and `settings.disableChat` are respected live. Chat is preset quick-chat only, with no free text.
- Progress is saved through `SDK.data`, so it syncs to the cloud for logged-in users. The CrazyGames username and avatar are shown, and guests get a generated name.
- Multiplayer: `updateRoom` (roomId, isJoinable, inviteParams), `inviteLink`, `getInviteParam('roomId')` on load, and `isInstantMultiplayer`, which puts you straight into a joinable private room. Rooms persist across rounds.
- There is no custom fullscreen button and no external links. Escape and Ctrl/Cmd shortcuts are never captured.

## Submission art

Generated with the game engine itself (`tools/art.html`, `tools/art.js`, `tools/art-video.js`):

```bash
npx vite --port 5199 &           # dev server for the art studio
node tools/make-art.mjs covers   # art/cover-landscape.png 1920x1080, cover-portrait.png 800x1200, cover-square.png 800x800
node tools/make-art.mjs videos   # art/preview-landscape.mp4 1920x1080, preview-portrait.mp4 1080x1620 (18 s, silent H.264)
```

The finished files are in `art/`.
