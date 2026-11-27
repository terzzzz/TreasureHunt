# UNBOUND SEEKERS (無界尋寶錄)

**UNBOUND SEEKERS** is an infinite, seeded 2D action-platformer set across a dark dungeon canvas layered over the ruled pages of an explorer's field notebook. Assemble a custom relic hunter by combining physical and sensory traits, loot the Super Cannon Hat in the entry chamber, descend through procedurally generated floors where enemy squads and attack power scale endlessly, and decide when to cash out against the Vault Warden—or push deeper until a single blow becomes fatal.

---

## Core Gameplay & Infinite Progression

1. **Choose Difficulty & Traits:** Select **Normal (1 trait)**, **Hard (3 traits)**, or **Ultimate (5 traits)** to forge your hunter's identity, mobility profile, and sensory constraints. Open the built-in trilingual guide (**English / 繁體中文 / 日本語**) anytime on the selection screen via **`[?]`**.
2. **Entry Chamber & Endless Procedural Floors:** Every run generates a fresh `runSeed`. After clearing the starting **Entry (`RM:0`)** chamber—where defeating the **Hat Alien (頂帽外星人)** unlocks the **Super Cannon Hat**—each exit advances the floor counter (`FLOOR 01` / `RM:1`, `RM:2`, ...) and builds a multi-tier stone dungeon layout with ladders, red drop-through hatches, cover walls, pickups, and mixed enemy squads (1–3 enemies per patrol zone).
3. **+2% Compound Monster Attack:** With every room transition $n$, all enemies gain **+2% compound attack damage** ($\text{Base ATK} \times 1.02^n$), alongside scaling HP and movement speed.
4. **The Floor 10 Choice (Boss vs. Endless):**
   - Once you reach **10 transitions (`RM:10`)**, the **`[B] FACE BOSS NEXT STAGE`** button unlocks in the top-right HUD.
   - **Challenge the Boss:** Toggle `[B]` ON before taking the next exit to enter the **Boss Chamber** and face **The Vault Warden**. Defeating him unlocks the exit to the **Treasure Vault**, where collecting the chests and reaching `FINISH` completes the game with a **CONGRATZ!** victory screen and difficulty clear bonus.
   - **Keep Pushing:** Leave `[B]` OFF to keep descending indefinitely for a higher score—until the compound attack multiplier turns every enemy hit into a one-hit KO.

---

## Controls

### Desktop (Keyboard + Mouse)

| Input | Action |
| :--- | :--- |
| **`A` / `D`** | Move Left / Right |
| **`W` / `S`** | Climb Ladder Up / Down |
| **`Space`** | Jump |
| **`S` + `Space`** | Drop down through red one-way platforms |
| **`Mouse Move`** | 360° Free Aim (tilts head & machine-gun arm) |
| **`Left Click` (Hold)** | Fire 5-Round Burst Machine Gun (auto-reloads after 5 shots) |
| **`Right Click`** | Throw Heavy Bone (deals `15%` of target's current HP in a high arc) |
| **`F`** | Fire Super Cannon Ball (`2` rounds per room, `200` AoE splash damage) |
| **`B`** | Arm / Disarm Boss Chamber for the next exit (requires `RM >= 10`) |
| **`?` / `F1` / `T`** | Open / Close Trilingual **How to Play** Guide (on Hunter Select) |
| **`M`** | Mute / Unmute Chiptune BGM & SFX |
| **`R`** | Start a New Run (on Victory / Game Over) |
| **`ESC`** | Return to Hunter Selection |

### Mobile / Touch (Landscape Recommended)

- **Left Thumb Virtual D-Pad (`◀` `▶` `▲` `▼`):** Move and climb ladders; slide your thumb smoothly between directions without lifting.
- **Right Thumb Action Buttons:**
  - **`GUN`:** Tap to auto-aim at the nearest enemy in range and fire; drag like a twin-stick to aim manually.
  - **`JUMP` / `BONE` / `HAT`:** Dedicated buttons for jumping, throwing bones, and firing cannon balls.
- **Direct Screen Touch:** Touching and dragging anywhere on the playfield aims and fires directly at your fingertip.
- **Tap HUD:** Tap `[B] FACE BOSS NEXT STAGE`, `[ESC]CHAR`, `[M]BGM`, or end-screen prompts directly.

---

## Arsenal & Pickups

| Item / Weapon | Stats & Effect |
| :--- | :--- |
| **5-Burst Machine Gun** | Unlimited reserve ammo (`GUN:5/5`). Fires a rapid 5-shot burst followed by an automatic reload (`GUN:RLD`). Bullets fly flat up to effective range before dropping with gravity. |
| **Throwing Bone (`BN`)** | Lobbed in a high arc to deal **`15%` of an enemy's current HP**—ideal for hitting enemies across elevation gaps or chunking high-HP giants and bosses. |
| **Super Cannon Hat (`HAT` / 頂帽大炮)** | Dropped by the **Hat Alien** in Room 0 (`ENTRY`). Grants **`2` Cannon Balls per room** (`HAT:2/2`), launching heavy explosive ordnance that deals **`200` AoE damage** with a shockwave blast. |
| **Roast Chicken** | Restores **`+50 HP`**, grants **`+2 Bones`**, clears **Asthma fatigue**, and awards bonus points. Spawns reliably on every 10th floor and in the Boss Chamber. |
| **Crown** | Awards **`+250` pts**. |
| **Treasure Chest** | Multi-variant chests found in the post-Boss **Treasure Vault** for massive bonus score. |

---

## Bestiary

| Enemy | Appears | Base HP | Base ATK | Score | Behavior |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Hat Alien (頂帽外星人)** | Room 0 (`ENTRY`) | — | Cannon AoE | — | Guards the starting chamber with telegraphed (`FIRE!`) cannon shots. Drops the **Super Cannon Hat** on defeat. |
| **Blademan** | Floor 1+ | `45` | `15` | `250` | Mid-speed patroller (`77` patrol / `164.5` chase) that closes in and slashes with a curved blade when sharing your elevation. |
| **Knifer** | Floor 1+ | `34` | `13` | `260` | Compact, low-profile ambusher that crouches into a brief windup before lunging forward in a high-speed afterimage stab (`DASH_STAB`). |
| **Axe Giant** | Floor 1+ | `145` | `24` (Cleave)<br>`24` (Charge) | `800` | Towering brute capable of both telegraphed overhead axe cleaves and high-speed bull rushes (`CHARGE!`). Spawns solo or alongside Blademen and Knifers. |
| **The Vault Warden** *(Boss)* | Boss Chamber (`RM >= 10`) | `680+` | `24` | `5,000` | Giant crowned warden (`+3%` HP scaling per transition) who stalks the arena with cleaves and charges. The exit stays `LOCKED` until he falls. |

---

## Field Tactics & Trait Survival Guide

### Managing Hunter Traits
- **Blind (視障):** Your vision is restricted to a clear spotlight around your hunter while the surrounding notebook blurs into shadow. Listen for enemy footsteps and weapon windups, fire probing bursts down corridors to watch for particle sparks, and memorize ladder placements before dropping down.
- **Asthma (哮喘):** Running (`A`/`D`) and climbing (`W`) build up the overhead fatigue bar. If it hits `100%`, you suffer a **`GASP!`** stun the moment your feet touch a floor or ladder, leaving you completely vulnerable. **Feather your movement** in short bursts, pause on safe ledges to let the gauge decay, and save **Roast Chickens** for emergency breath resets.
- **Tremor (手震):** Causes crosshair sway and bullet spread. Avoid long-range sniping—close the distance, aim center-mass, and rely on **Throwing Bones** and **Super Cannon Balls** for reliable impact damage.
- **Prosthesis (義肢) & Deaf (聽障):** Adjust jump timing around your modified movement/jump curve, and watch visual cues (such as the Knifer's crouch glint, the Axe Giant's `CHARGE!` warning, and the red `GASP!` indicator) rather than relying on audio warnings.

### Combat & Scaling Strategy
- **Burst Discipline:** Never drop into a multi-enemy patrol with 1 round left in the magazine. Fire off the final shot in safety to trigger `GUN:RLD` before engaging.
- **Respect Mixed Squads:** Procedural rooms can spawn up to 3 enemies together on a single platform. Use a **Super Cannon Ball (`F`)** to clear clustered Blademen and Knifers immediately, then finish surviving Axe Giants with `%`-HP **Throwing Bones**.
- **Bait & Punish Giants and Knifers:** Step just inside a Knifer's or Axe Giant's trigger range to bait its crouch/charge windup, hop onto a ladder or drop through a red hatch, and punish during its recovery frames.
- **Know When to Call the Boss:** At `RM:10`, monster attacks are already at **`x1.22`**. By `RM:35`, attacks double (`x2.00`), and by `RM:60+`, even a Knifer's lunge becomes lethal. Arm `[B]` right at `RM:10` for a clean Vault clear, or keep descending to chase high-floor leaderboard scores.

---

## Development History

- **25/11/26:** Project kick-start; core character sprite layering, trait-based difficulty system (`Normal` / `Hard` / `Ultimate`), and field-notebook visual style established.
- **26/11/26:** Pivoted to an infinite seeded procedural dungeon generator with endless floor transitions, `+2%` compound monster attack scaling, and the Floor 10 Boss/Vault loop.
- **27/11/26:** Added the **Knifer** enemy type and multi-enemy patrol squads, integrated the semi-transparent dark dungeon background template across all floors, added chiptune BGM/SFX audio and a trilingual **How to Play** screen, and rebalanced firepower (5-round burst gun, `%`-HP throwing bones, and 2-per-room Super Cannon Hat).
