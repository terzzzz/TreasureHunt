# UNBOUND RELICS (無界尋寶錄)

**UNBOUND RELICS** is an infinite, seeded 2D action-platformer set across the ruled pages of an explorer's field notebook. Assemble a custom relic hunter by combining physical and sensory traits, descend through procedurally generated floors where enemy attack power compounds endlessly, and decide when to cash out against the Vault Warden—or push deeper until a single blow becomes fatal.

---

## Core Gameplay & Infinite Progression

1. **Choose Difficulty & Traits:** Select **Normal (1 trait)**, **Hard (3 traits)**, or **Ultimate (5 traits)** to forge your hunter's identity, mobility profile, and sensory constraints.
2. **Endless Procedural Floors:** Every run generates a fresh `runSeed`. Crossing each floor exit advances the transition counter (`RM:1`, `RM:2`, ...) and builds a guaranteed multi-tier layout with ladders, drop-through platforms, bulkheads, pickups, and patrols.
3. **+2% Compound Monster Attack:** With every room transition $n$, all enemies gain **+2% compound attack damage** ($\text{Base ATK} \times 1.02^n$), alongside scaling HP and movement speed.
4. **The Floor 10 Choice (Boss vs. Endless):**
   * Once you reach **10 transitions (`RM:10`)**, the **`[B] FACE BOSS NEXT STAGE`** button unlocks in the top-right HUD.
   * **Challenge the Boss:** Toggle `[B]` ON before taking the next exit to enter the **Boss Chamber** and face **The Vault Warden**. Defeating him unlocks the exit to the **Treasure Vault**, where collecting the chests and reaching `FINISH` completes the game with a **CONGRATZ!** victory screen and difficulty clear bonus.
   * **Keep Pushing:** Leave `[B]` OFF to keep descending indefinitely for a higher score—until the compound attack multiplier turns every enemy hit into a one-hit KO.

---

## Controls

### Desktop (Keyboard + Mouse)

| Input | Action |
| :--- | :--- |
| **`A` / `D`** | Move Left / Right |
| **`W` / `S`** | Climb Ladder Up / Down |
| **`Space`** | Jump |
| **`S` + `Space`** | Drop down through red one-way platforms |
| **`Mouse Move`** | 360° Free Aim (tilts head & weapon arm) |
| **`Left Click` (Hold)** | Fire 7-Round Burst Handgun (`0.40s` auto-reload after 7 shots) |
| **`Right Click`** | Throw Heavy Bone (`55` dmg, high arc) |
| **`F`** | Launch Hat Missile (`110` splash dmg, `4.5s` cooldown) |
| **`B`** | Arm / Disarm Boss Chamber for the next exit (requires `RM >= 10`) |
| **`M`** | Mute / Unmute Chiptune BGM & SFX |
| **`R`** | Start a New Run (on Victory / Game Over) |
| **`ESC`** | Return to Hunter Selection |

### Mobile / Touch (Landscape Recommended)

* **Left Thumb Virtual D-Pad (`◀` `▶` `▲` `▼`):** Move and climb ladders; slide your thumb smoothly between directions without lifting.
* **Right Thumb Action Buttons:**
  * **`GUN`:** Tap to auto-aim at the nearest enemy in range and fire; drag like a twin-stick to aim manually.
  * **`JUMP` / `BONE` / `HAT`:** Dedicated buttons for jumping, throwing bones, and firing the missile hat.
* **Direct Screen Touch:** Touching and dragging anywhere on the playfield aims and fires directly at your fingertip.
* **Tap HUD:** Tap `[B] FACE BOSS NEXT STAGE`, `[ESC]CHAR`, `[M]BGM`, or end-screen prompts directly.

---

## Arsenal & Pickups

| Item / Weapon | Stats & Effect |
| :--- | :--- |
| **7-Burst Handgun** | Unlimited reserve ammo. Fires a rapid 7-shot burst (`10` dmg/round) followed by a `0.40s` reload (`GUN:RLD`). Bullets fly flat up to effective range before dropping with gravity. |
| **Throwing Bone (`BN`)** | Deals **`55` dmg** in a lobbed arc—ideal for hitting enemies across elevation gaps or chunking armored giants. |
| **Missile Hat (`HAT`)** | Unlocked by picking up a Hat item. Fires a high-speed rocket dealing **`110` dmg** across a `74px` blast radius (`4.5s` cooldown). |
| **Roast Chicken** | Restores **`+45 HP`**, restocks **Bones to `4`**, clears **Asthma fatigue to `0`**, and awards **`+200` pts**. |
| **Crown** | Awards **`+250` pts**. |
| **Treasure Chest** | Appears in the post-Boss Treasure Vault; awards **`+1,500` pts** each. |

---

## Bestiary (Defined in `js/enemies.js` / `data/enemies.json`)

| Enemy | Appears | Base HP | Base ATK | Score | Behavior |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Blade Stalker** | Floor 1+ | `35` | `16` | `250` | Fast floor patroller that lunges with a curved blade when you share its elevation. |
| **Axe Juggernaut** | Floor 3+ | `130` | `18` (Body)<br>`28` (Cleave) | `800` | Heavy brute with a telegraphed overhead axe windup (`WINDUP → STRIKE → RECOVER`). |
| **The Vault Warden** *(Boss)* | Boss Chamber (`RM >= 10`) | `680` | `26` (Body)<br>`42` (Cleave) | `5,000` | Giant crowned warden who actively stalks the hunter. The exit stays `LOCKED` until he falls. |

---

## Field Tactics & Trait Survival Guide

### Managing Hunter Traits
* **Blind (視障):** Your vision is restricted to a clear spotlight around your hunter while the surrounding notebook blurs into shadow. Listen for enemy footsteps/axe windups, fire probing bursts down corridors to watch for particle sparks, and memorize ladder placements before dropping down.
* **Asthma (哮喘):** Running (`A`/`D`) and climbing (`W`) build up the overhead fatigue bar. If it hits `100%`, you suffer a **`GASP!`** stun the moment your feet touch a floor or ladder, leaving you completely vulnerable. **Feather your movement** in short bursts, pause on safe ledges to let the gauge decay, and save **Roast Chickens** for emergency breath resets.
* **Tremor (手震):** Causes crosshair sway and bullet spread. Avoid long-range sniping—close the distance, aim center-mass, and rely on **Throwing Bones** and **Hat Missiles** for reliable splash damage.
* **Prosthesis (義肢) & Deaf (聽障):** Adjust jump timing around your modified movement/jump curve, and watch visual cues (such as the Axe Juggernaut's raised weapon windup and the red `GASP!` indicator) rather than relying on audio warnings.

### Combat & Scaling Strategy
* **Burst Discipline:** Never enter a crowded floor with 1 round left in the magazine. Fire off the final shot in safety to trigger the `0.40s` reload before dropping onto an enemy patrol.
* **Bait & Punish Giants:** Step just inside an Axe Juggernaut's reach to trigger its `WINDUP`, step back or climb a ladder out of the red cleave arc, and unload a full 7-round burst + Throwing Bone during its `RECOVER` frames.
* **Know When to Call the Boss:** At `RM:10`, monster attacks are already at **`x1.22`**. By `RM:35`, attacks double (`x2.00`), and by `RM:60+`, even a Blade Stalker's graze can surpass `50+` damage. If you are chasing a clean clear, arm `[B]` right at `RM:10` while your HP and chicken reserves are healthy; if you are chasing the leaderboard, keep climbing until the math catches up.


Development history:

25/11/26: kick-start, game char design, difficulty, game style.
26/11/26: decide to switch it to infinite generative style.


