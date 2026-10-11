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
| Dive (goalkeepers, in their own box) | Right mouse |
| Flick | Q |
| Tackle | E |
| Lob | F |
| Request the ball | R |
| **Jump** (no ball) / **Dribble skill** (with ball) | Space |
| Sprint | Shift |
| Use item 1 / 2 | 1 / 2, then click |
| Stats | Tab |
| Quick chat / Emotes | C / B |
| Return to lobby | L |
| Unlock mouse | M (rebindable in Settings) |

The game never binds Escape (a CrazyGames restricted key) and matches never pause. Unlock the mouse with your own key (default M); the browser also releases it on Escape by itself. Touch controls appear automatically on phones and tablets.

### Mobile & tablet (landscape)

- **Floating joystick**: touch anywhere on the left side to move. Pushing it to the edge sprints; there is also a SPRINT toggle.
- **Context-sensitive buttons** on the right: with the ball you get KICK (hold for power), PASS, LOB, FLICK and SKILL. Without it you get KICK, TACKLE (DIVE for keepers), JUMP and CALL (request the ball).
- **Camera**: drag on the right side to look. While you run, the camera swings in behind you on its own.
- **Aim assist** (on by default, in Settings): aiming roughly at the rival goal snaps the shot inside the frame.
- Tap an item slot to use a power. Phones held upright show a "rotate your device" screen, because the game is landscape-only. Touch laptops switch to touch controls on the first tap.

## Gameplay

- **4v4** on two arenas (Cliffside grass, Canyon desert) plus an indoor training hall. Bots fill every empty spot; humans replace bots when they join.
- **PLAY** opens the team picker: click RED or BLUE and you are put straight into a match on that team. The match starts instantly (bots fill in while real players are found in the background). Private Room and Offline Match sit under the team cards, and **Switch Team** is in the in-match menu.
- **Random positions** at every kickoff (striker, wing, defender or goalkeeper).
- **Goalkeepers** (white kit) are whoever walks into their own penalty box when the team has no keeper. Step out and you lose the gloves; the next teammate to walk in takes them, so a team can be left with no keeper. Keepers can't be tackled, stunned, frozen, knocked down or robbed, and nothing (tackles, items or contact) can take the ball out of a keeper's hands. A keeper who catches the ball holds it for up to 6 s (kick to punt, pass to throw) and can't carry it out of the box; then it is thrown out automatically. A keeper's throw or punt knocks down every rival in its path, like a tackle. Keepers dive with Right mouse (rebindable).
- **Stamina** (175) is the main limit: sprinting, skill moves, kicks, tackles and jumps cost stamina, and a tired player kicks weaker.
- **Ball lines**: while you charge a shot, a dotted line shows exactly where the ball will go (same physics as the game: gravity, bounces, curve, posts, nets). Fast balls in flight show their predicted path too.
- **Goals only count through the goal mouth.** The frame, side nets, roof and back net are solid.
- **Flick → volley**: Flick (Q) pops the ball up over your head. Press Kick while the ball is in the air next to you (stand or jump with Space to reach higher) for an instant volley, or a bicycle kick when the ball is above your head (you turn your back to goal and scissor the ball over the top). The jump is high and the volley reach is generous, so flick, jump, kick is easy to land. Volleys come off faster than normal shots. **Crosshair aiming** sends the ball through the point under the crosshair.
- **Items** (the original game's 14): Forcefield, Barricades, Energy Drink, Oil Spill (Common) · Shotgun, Grappling Hook, Magnet, Landmines (Uncommon) · Rocket Punch, Supercharge, Flintlock (Rare) · Freeze Gun, Bazooka (Epic) · Jetpack (Mythic). They come out of the glowing “?” cubes, which only drop items you own. New items come from the **Item Roll** in the Shop (250 coins, or 5 for 1,100): Common 46%, Uncommon 30%, Rare 16%, Epic 7%, Mythic 1%. Duplicates refund coins and a new item is guaranteed after 5 duplicates in a row.
- **Training**: interactive tutorial, free practice, Shooting Challenge and Goalkeeper Challenge.
- Rules: 6:00 matches, golden-goal overtime, last-chance extension, mercy rule (4-goal lead), goal replays.

## Multiplayer

Peer-to-peer (WebRTC via PeerJS), host-authoritative: the first player in a room runs the match and others connect directly. Quick play claims or joins public room ids; private rooms use 5-letter codes and CrazyGames invite links. If the host leaves, everyone continues against bots.

- **Signalling**: the free PeerJS cloud (`0.peerjs.com`) introduces players to each other. For production scale you can self-host one (`npx peerjs --port 9000`) and set `NET.peerServer` in `src/config.js`.
- **NAT traversal**: STUN (Google, Cloudflare, Twilio) finds direct routes; a TURN relay is listed for players behind strict NATs or mobile carriers. The bundled Open Relay credentials are a public best-effort fallback. **For launch, put your own TURN credentials in `NET.iceServers`** (Metered and Cloudflare both have free tiers) so every pair of players can connect.
- If a room can't be reached, quick play moves on to the next room (or hosts one), and if online play is unavailable it falls back to a bot match.

## CrazyGames SDK v3 integration

`src/sdk.js` wraps every call and falls back gracefully when the SDK is unavailable:

- `loadingStart/Stop` during boot. `gameplayStart/Stop` on entering or leaving matches, menus and results.
- Midgame ads only at natural breaks (after a match). The rewarded ad doubles match coins. Audio is muted and gameplay suspended while an ad plays.
- `settings.muteAudio` and `settings.disableChat` are respected live. Chat is preset quick-chat only, with no free text.
- Progress is saved through `SDK.data`, so it syncs to the cloud for logged-in users. The CrazyGames username and avatar are shown, and guests get a generated name.
- Multiplayer: `updateRoom` (roomId, isJoinable, inviteParams), `inviteLink`, `getInviteParam('roomId')` on load, `addJoinRoomListener` (accepting an invite while the game is already open joins without a reload), and `isInstantMultiplayer`, which puts you straight into a joinable private room. Rooms persist across rounds.
- There is no custom fullscreen button and no external links. Escape and Ctrl/Cmd shortcuts are never captured.

## Submission art

Generated with the game engine itself (`tools/art.html`, `tools/art.js`, `tools/art-video.js`):

```bash
npx vite --port 5199 &           # dev server for the art studio
node tools/make-art.mjs covers   # art/cover-landscape.png 1920x1080, cover-portrait.png 800x1200, cover-square.png 800x800
node tools/make-art.mjs videos   # art/preview-landscape.mp4 1920x1080, preview-portrait.mp4 1080x1620 (18 s, silent H.264)
```

The finished files are in `art/`.
