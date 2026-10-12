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
- **Context-sensitive buttons** on the right: with the ball you get KICK (hold for power), PASS, LOB, FLICK and SPIN. Without it you get KICK, TACKLE (DIVE for keepers), JUMP and CALL (request the ball).
- **Camera**: drag on the right side to look. While you run, the camera swings in behind you on its own.
- **Aim assist** (on by default, in Settings): aiming roughly at the rival goal snaps the shot inside the frame.
- Tap an item slot to use a power. Phones held upright show a "rotate your device" screen, because the game is landscape-only. Touch laptops switch to touch controls on the first tap.

## Gameplay

- **New players**: the first launch starts the tutorial (skippable with the Skip button or L; there is a touch version on phones), then a free **starter roll**. You start with only the item you rolled.
- **4v4** on two cinematic arenas, Cliffside at golden hour (layered mountain ranges around the cliff island) and Canyon at sunset (banded mesas, cacti and glowing crystal clusters). Both have crowds in roofed side stands and open end stands behind each goal (the crowd jumps when someone scores), jumbotrons showing the live score (they flash GOAL! after a goal), waving team flags, floodlight towers and drifting motes in the low sun. There is also an indoor training hall. Bots fill every empty spot; humans replace bots when they join.
- **PLAY** opens the team picker: click RED or BLUE and you are put straight into a match on that team. The match starts instantly (bots fill in while real players are found in the background). Private Room and Practice Match sit under the team cards, and **Switch Team** is in the in-match menu.
- **Random positions** at every kickoff (striker, wing, defender or goalkeeper).
- **Goalkeepers** (white kit) are whoever walks into their own penalty box when the team has no keeper. Step out and you lose the gloves; the next teammate to walk in takes them, so a team can be left with no keeper. Keepers can't be tackled, stunned, frozen, knocked down or robbed, and nothing (tackles, items or contact) can take the ball out of a keeper's hands. A keeper who catches the ball holds it for up to 6 s (kick to punt, pass to throw) and can't carry it out of the box; then it is thrown out automatically. A keeper's throw or punt bowls over rivals in its path like a tackle, but only over the first quarter of its flight (and only while it is fast); after that it can be received normally. The same goes for a Supercharge fireball. Keepers dive with Right mouse (rebindable). Keepers have a big catching reach (larger again when diving) and catch shots at any speed instead of letting them bounce off. In their own box the keeper's camera always faces out at the pitch and stays in front of the goal line, and their own goal turns see-through, so the posts and net never block the view.
- **Knockdowns**: a player who has been knocked over can't act (including tackling) until they are fully back on their feet.
- **Stamina** (175) is the main limit: sprinting, kicks, tackles and jumps cost stamina, and a tired player kicks weaker. Dribble skill moves are free. Nothing drains outside live play (kickoff countdown, warm-up, between matches).
- **Everyone sees shot lines**: while the ball carrier charges a shot, every player sees its predicted path in that team's colour.
- **Mercy rule warning**: when a team is one goal from the mercy rule, a themed strip under the timer says so.
- **Arrows**: a 3D arrow marks you, and another marks whoever has the ball, in the colour of the team in possession. The crosshair sits in the middle of the screen with your player just left of it (over-the-shoulder camera).
- **Ball lines**: while you charge a shot, a thick bright ribbon (with a dark halo, so it reads on any background) shows exactly where the ball will go, up to the first wall, post or net it hits (same physics as the game: gravity, bounces, curve, posts, nets). Fast balls in flight show their predicted path too.
- **Shot phasing** (stops instant blocks at point-blank range): a hard shot or lob passes straight through outfield players for its first 7 m (the ball goes see-through with a white trail while it phases). Inside that radius it can't be blocked or volleyed; you can only intercept it at the end of the shot. Goalkeepers in their own box can still save it.
- **Goals only count through the goal mouth.** The frame, side nets, roof and back net are solid. A ball that lands on the crossbar or the net roof rolls off instead of sitting there.
- **Flick → volley**: Flick (Q) pops the ball up over your head. Press Kick while the ball is in the air next to you (stand or jump with Space to reach higher) for an instant volley, or, **while you are in the air** (jump first with Space), a **bicycle kick** when the ball is above your head: **press** Kick as you meet the ball and you snap into position, frozen high in the air with the ball floating above you while you aim (the ball line shows exactly where it will go); **release** Kick to shoot. Hold too long (0.9 s) and it fires by itself. While you hang in a bicycle kick nobody can kick the ball away, tackle you or bowl you over: a rival can only take it with a bicycle kick of their own, catch it once it's in flight, or knock you out of it with an item (the ball then drops loose). The jump is high and the volley reach is generous, so flick, jump, kick is easy to land. Volleys come off faster than normal shots. **Crosshair aiming** sends the ball through the point under the crosshair.
- **Items** (the original game's 14): Forcefield, Barricades, Energy Drink, Oil Spill (Common) · Shotgun, Grappling Hook, Magnet, Landmines (Uncommon) · Rocket Punch (homes in on the ball and bursts there, knocking over rivals around it), Supercharge, Flintlock (Rare) · Freeze Gun, Bazooka (Epic) · Jetpack (Mythic). They come out of the glowing “?” cubes, which only drop items you own. New items come from the **Item Roll** in the Shop (250 coins, or 5 for 1,100), shown as a horizontal gacha strip that spins and lands on your item: Common 46%, Uncommon 30%, Rare 16%, Epic 7%, Mythic 1%. Duplicates refund coins and a new item is guaranteed after 5 duplicates in a row.
- **Award stage** after every match: the standout players line up on a lit podium in the stadium, under the final score. Each award is revealed in turn and the MVP goes last, with confetti and fireworks: MVP (most points), Top Scorer, Playmaker (assists), The Wall (saves), Enforcer (steals), Menace (item hits) and Sharpshooter (shots). A player can win several awards. Then the results card appears (or press Continue).
- **Players**: fully rigged footballers (pelvis, spine, chest, neck, head, clavicles, shoulders, elbows, wrists, hips, knees and ankles) with one continuous skinned body: loose jersey with trimmed collar and cuffs, shorts with side stripes, ribbed socks with bands, sculpted boots and hands. Round chibi heads with a painted face (big dark eyes, short brows, rosy cheeks, small smile) and four expressions. Animations: stride-locked run cycle with pelvis bob and counter-rotating chest and arms, banking into turns, breathing idle, landing absorb, a full kick with wind-up and follow-through, and a side-on scissor bicycle kick. Feet stay planted automatically.
- **Customisation**: jerseys, boots (8 colourways), 16 hairstyles (Spiky, Bob, Backwards Cap, Mohawk, Space Buns, Big Curls, Beanie, Buzz Cut, Quiff, Curtains, Ponytail (swings when you run), Man Bun, Cornrows, Long Hair, Dreads, Champion Crown), skin, hair and eye colours, shirt number, balls, goal effects and emotes.
- **Camera**: it never leaves the arena (zooming out pulls it in along the view line instead of putting stands or jumbotrons in the way) and passes freely through goals, which turn see-through when the camera is near them.
- **Training**: interactive tutorial, free practice, Shooting Challenge and Goalkeeper Challenge.
- Rules: 6:00 matches, golden-goal overtime, last-chance extension, mercy rule (4-goal lead), goal replays.

- **Music**: two soundtracks (Punto Final, Buant Groove) play as a looping playlist, full volume in menus and softer under the crowd in matches. They stream on demand, so they don't slow down loading, and follow the music volume and mute settings.
- **Performance**: each arena is built only when first shown and its static meshes are batched; all flags are one animated mesh; the crowd is low-poly instanced; dynamic resolution lowers the render scale when the frame rate drops and restores it when there is headroom.

## Multiplayer

- **Inactivity**: in live online matches a player who does nothing for 60 s is disconnected (a warning shows from 45 s). Results screens and ads don't count.

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
- `showInviteButton` / `hideInviteButton` for private rooms (hidden once the match starts), `ad.hasAdblock` (the double-coins button is hidden when ads are blocked), and a responsive banner on the results screen only (never during play; cleared when the results close).
- Matches never pause: an online host's simulation catches up on real time and keeps running from a worker timer while the tab is in the background.
- There is no custom fullscreen button and no external links. Escape and Ctrl/Cmd shortcuts are never captured.
- Store-page text (descriptions, controls, tags) is in [`docs/CRAZYGAMES_SUBMISSION.md`](docs/CRAZYGAMES_SUBMISSION.md).

## Submission art

Generated with the game engine itself (`tools/art.html`, `tools/art.js`, `tools/art-video.js`):

```bash
npx vite --port 5199 &           # dev server for the art studio
node tools/make-art.mjs covers   # art/cover-landscape.png 1920x1080, cover-portrait.png 800x1200, cover-square.png 800x800
node tools/make-art.mjs videos   # art/preview-landscape.mp4 1920x1080, preview-portrait.mp4 1080x1620 (18 s, silent H.264)
```

The finished files are in `art/`.
