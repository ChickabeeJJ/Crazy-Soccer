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
| Build | `crazy-soccer-html5.zip` (about 0.5 MB, 16 files, no external assets) |

## Short description

Chaotic 4v4 soccer with no referee: slide tackles, bicycle kicks, bazookas and freeze guns. Score the most goals by any means necessary.

## Full description

Crazy Soccer is fast 4v4 online soccer where anything goes. There's no referee, so slide-tackle the ball carrier, knock rivals over with a rocket punch, or freeze them solid with an ice gun, then hammer the ball into the net.

Grab the glowing mystery cubes for 14 items: Bazooka, Freeze Gun, Grappling Hook, Jetpack, Magnet, Landmines, Shotgun, Supercharge, Forcefield and more. Flick the ball up, jump and hang in the air for a slow-motion bicycle kick that bends straight into the top corner.

Every kickoff gives you a new random position. Walk into your own box to take the goalkeeper gloves: keepers can't be tackled, hold the ball in their hands and bowl over anyone in the path of their throw. Step out of the box and you lose the gloves, so your team might be left with an empty net.

Join a team and play live against real players straight away. Bots fill any empty spot until people join, and you can invite friends to a private room. Earn coins to unlock new items with the Item Roll and customise your player with jerseys, hairstyles, balls, goal effects and emotes. New players can take the optional tutorial or practise their shooting and goalkeeping in the training ground.

### Features

- Live online 4v4 matches with instant matchmaking and friend invites
- Bicycle kicks, volleys, flicks, skill moves and charged power shots
- 14 chaotic items, from Jetpacks to Bazookas
- Goalkeepers who can't be tackled, and gloves that move to the next player into the box
- Ball-flight lines that show exactly where your shot will go
- Tutorial, free practice, shooting challenge and goalkeeper challenge
- Item Roll, cosmetics, levels and daily rewards
- Full touch controls for phones and tablets

## Controls

### Desktop (every key can be rebound in Settings)

- **WASD / Arrow keys**: Move
- **Mouse**: Aim the camera and crosshair
- **Left click**: Kick (hold to charge). With the ball in the air above you, it starts a bicycle kick.
- **Right click / T**: Pass. Goalkeepers in their own box dive with right click.
- **Q**: Flick the ball up
- **E**: Slide tackle
- **F**: Lob
- **Space**: Jump (without the ball) or skill move (with the ball)
- **Shift**: Sprint
- **1 / 2**: Select an item, then click to use it
- **R**: Call for the ball
- **C / B**: Quick chat / Emotes
- **Tab**: Scoreboard
- **M**: Release the mouse

### Mobile and tablet

- **Left side of the screen**: Floating joystick (push to the edge to sprint)
- **Right side of the screen**: Drag to look around
- **Buttons**: Kick, Pass, Lob, Flick, Skill, Tackle / Dive, Jump, Call, plus the two item slots

## Art assets

The tools in `tools/` render these with the game's own engine (`node tools/make-art.mjs covers` and `node tools/make-art.mjs videos`). The finished files are in `art/`.

| File | Size | Use |
| --- | --- | --- |
| `art/cover-landscape.png` | 1920×1080 | Landscape cover (16:9) |
| `art/cover-portrait.png` | 800×1200 | Portrait cover (2:3) |
| `art/cover-square.png` | 800×800 | Square cover (1:1) |
| `art/preview-landscape.mp4` | 1920×1080, 18 s, silent H.264 | Landscape preview video |
| `art/preview-portrait.mp4` | 1080×1620, 18 s, silent H.264 | Portrait preview video |

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
- **No external links or other branding**: all art, characters, sounds and music are generated in code.
