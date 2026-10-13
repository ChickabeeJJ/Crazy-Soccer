# Crazy Soccer — CrazyGames submission sheet

Everything to paste into the CrazyGames developer portal.

## Basics

| Field | Value |
| --- | --- |
| Title | Crazy Soccer |
| Category | Sports |
| Tags | Soccer, Football, Multiplayer, 3D, PvP, Physics, Funny, Ball |
| Orientation | Landscape (desktop and mobile; phones held upright see a "rotate your device" screen) |
| Platforms | Desktop and mobile (touch controls appear automatically) |
| Multiplayer | Yes: real-time online 4v4, invite links and private rooms (bots fill empty spots) |
| Account / saving | Progress is saved with the CrazyGames Data module (cloud save when logged in) |
| Build | GitHub's green **Code > Download ZIP** of this repository. The repo root holds the finished game (`index.html`, `assets/`, `music/`), about 14 MB in total. `npm run build` refreshes it. |

## Short description

Chaotic 4v4 soccer with no referee: slide tackles, bicycle kicks, bazookas and freeze guns. Score the most goals by any means necessary.

## Full description

Crazy Soccer is fast 4v4 online soccer where anything goes. There's no referee, so slide-tackle the ball carrier, knock rivals over with a rocket punch, or freeze them solid with an ice gun, then hammer the ball into the net.

Grab the glowing mystery cubes for 19 items: Bazooka, Freeze Gun, Titan, Time Warp, Blink, Shockwave, Jetpack, Grappling Hook, Banana Peel, Supercharge, Forcefield and more. Flick the ball up, jump and hang in the air for a bicycle kick that nobody can take off you without an item, then release to send it into the top corner.

Every kickoff gives you a new random position. Walk into your own box to take the goalkeeper gloves: keepers can't be tackled, hold the ball in their hands and bowl over anyone in the path of their throw. Step out of the box and you lose the gloves, so your team might be left with an empty net.

New players get a quick, skippable tutorial and a free roll for their first item. Join a team and play live against real players straight away. Bots fill any empty spot until people join, and you can invite friends to a private room. Earn coins to unlock new items with the Item Roll and customise your player with jerseys, boots, 16 hairstyles, skin and hair colours, balls, goal effects and emotes. New players can take the optional tutorial or practise their shooting and goalkeeping in the training ground.

### Features

- Live online 4v4 matches with instant matchmaking and friend invites
- Bicycle kicks, volleys, flicks, skill moves and charged power shots
- 19 chaotic items, from Jetpacks and Bazookas to Titan mode and Time Warp
- Goalkeepers who can't be tackled, and gloves that move to the next player into the box
- Ball-flight lines that show exactly where your shot will go
- A podium award ceremony after every match: MVP, Top Scorer, Playmaker, The Wall and more
- Tutorial, free practice, shooting challenge and goalkeeper challenge
- Seasonal Season Pass with a free and an Elite track, packed with exclusive kits, boots and balls
- Weekly limited-time events with their own exclusive rewards
- Daily challenges, a 7-day login calendar and playtime rewards
- Item Roll and levels
- Deep customisation: jerseys, boots, 16 hairstyles, skin and hair colours
- Full touch controls for phones and tablets

## Controls

### Desktop (every key can be rebound in Settings)

- **WASD / Arrow keys**: Move
- **Mouse**: Aim the camera and crosshair
- **Left click**: Kick (hold to charge). In mid-air with the ball above you, it starts a bicycle kick.
- **Right click / T**: Pass. Goalkeepers in their own box dive with right click.
- **Q**: Flick the ball up
- **E**: Slide tackle
- **F**: Lob
- **Space**: Jump (without the ball) or spin move (with the ball)
- **Shift**: Sprint
- **1 / 2**: Select an item, then click to use it
- **R**: Call for the ball
- **C / B**: Quick chat / Emotes
- **Tab**: Scoreboard
- **M**: Release the mouse

### Mobile and tablet

- **Left side of the screen**: Floating joystick (push to the edge to sprint)
- **Right side of the screen**: Drag to look around
- **Buttons**: Kick, Pass, Lob, Flick, Spin, Tackle / Dive, Jump, Call, plus the two item slots

## Art assets

The tools in `tools/` render these with the game's own engine (`node tools/make-art.mjs covers` and `node tools/make-art.mjs videos`). The finished files are in `art/`.

| File | Size | Use |
| --- | --- | --- |
| `art/cover-landscape.png` | 1920×1080 | Landscape cover (16:9) |
| `art/cover-portrait.png` | 800×1200 | Portrait cover (2:3) |
| `art/cover-square.png` | 800×800 | Square cover (1:1) |
| `art/preview-landscape.mp4` | 1920×1080, 18 s, silent H.264 | Landscape preview video (not stored in the repo; render with `node tools/make-art.mjs videos`) |
| `art/preview-portrait.mp4` | 1080×1620, 18 s, silent H.264 | Portrait preview video (not stored in the repo) |

## Multiplayer connectivity

Players connect peer to peer (WebRTC). A free signalling server (PeerJS cloud) introduces them, and STUN finds a direct route. That works for most home connections. Players on strict mobile or school networks need a TURN relay, and the free public relay the game falls back to is unreliable.

For reliable cross-network play, create a free TURN account (for example Metered) and put its credentials URL in `NET.turnCredentialsUrl` in `src/config.js`. The game fetches fresh TURN servers from it at startup.

## Compliance checklist

- **CrazyGames SDK v3**:
  - Loading and gameplay events: `loadingStart`/`loadingStop` and `gameplayStart`/`gameplayStop`.
  - Ads: midgame ads only between matches; a rewarded ad to double coins (hidden when an adblocker is detected).
  - Banner: a responsive banner on the results screen only.
  - Celebrations: `happytime` on wins.
  - Settings: the mute-audio and disable-chat settings are respected.
  - Accounts: user account, login prompt and auth listener.
  - Saving: the Data module.
  - Multiplayer: invite links, the invite button (private rooms only, hidden once the match starts), join-room listener and room status updates.
- **Restricted keys**: Escape, F-keys and browser shortcuts are never bound. The mouse is released with M, which can be rebound.
- **Matches keep running**: they never pause. An online host keeps the match running even when their tab is in the background.
- **Content**: cartoon slapstick only (no blood); suitable for PEGI 12.
- **No external links or other branding**: all art, characters and sound effects are generated in code; the two soundtracks ship with the game.
