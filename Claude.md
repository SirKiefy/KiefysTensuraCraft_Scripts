# Modpack Core Architecture & Automation Rules
- **Platform:** Minecraft 1.21.1 | NeoForge | KubeJS 6/7 | TensuraJS
- **Primary Objective:** Build a seamless bridge between Tensura Mod skills/stats and Legendary Survival Overhaul (LSO) bodily systems, while balancing combat encounters via In Control! for Born in Chaos, Legendary Monsters, and Threatening Mobs Revamped.
- **Allowed Working Directories:**
  - `kubejs/server_scripts/` (Mechanics, event listeners, dynamic scaling, LSO/Tensura bridges)
  - `kubejs/startup_scripts/` (Custom TensuraJS skills, attributes, damage types, registries)
  - `config/incontrol/` (`spawn.json`, `potentialspawn.json`, `spawner.json`, `experience.json`)
  - `config/legendarysurvivaloverhaul/` (Survival tuning parameters)

---

## 0. Official Reference Documentation
Refer to these external documentation sources for exact syntax, event names, and schema rules:

- **KubeJS Documentation:**
  - Main Wiki: https://kubejs.com/wiki
  - Core Events & Global Scope: https://kubejs.com/wiki/events
  - Modern Recipes & Event Handling: https://kubejs.com/wiki/tutorials/recipes
- **In Control! (1.20.1 & 1.21+ Specification):**
  - McJty Official Documentation: https://mcjty.eu/docs/mods/control-mods/control-mods-20
  - *Key 1.21 Syntax Note:* `biometype` is deprecated; use `biometags` instead. Use `spawner.json` rather than legacy `potentialspawn.json` where possible.
- **Legendary Survival Overhaul (LSO):**
  - Project Reference & Systems: https://www.curseforge.com/minecraft/mc-mods/legendary-survival-overhaul
  - *Key Mechanics:* Locational body damage capability (`legendarysurvivaloverhaul:body_damage`), hydration saturation bar, and thermal inertia/coating systems.
- **Tensura Mod & TensuraJS:**
  - Tensura Mod Wiki & Skills: https://tensura-mod.fandom.com/wiki/Category:Skills
  - TensuraJS Bridge Hub: https://www.curseforge.com/minecraft/mc-mods/tensurajs

---

## 1. TensuraJS Custom Skills Specification
Use TensuraJS (`kubejs/startup_scripts/`) to define custom skills and passives that hook into survival and monster-slaying systems:

### Custom Skill: 'Thermoregulation' (Extra Skill / Intrinsic)
- **Concept:** Control of internal heat and cold magicule flow.
- **Tiers & Mechanics:**
  - *Tier 1 (Thermal Resistance):* Halves hyperthermia and hypothermia tick damage. Neutralizes biome temperature penalties up to extreme cold/hot limits.
  - *Tier 2 (Absolute Thermal Control):* Complete immunity to LSO ambient temperature extremes. Prevents temperature-induced debuffs (slowness, shivering, sweat exhaustion).
- **Consumption:** Passive drain of negligible magicules (e.g., 2 magicules/100 ticks) when exposed to extreme biomes (The Nether, icy peaks).

### Custom Skill: 'Purification & Sustenance' (Intrinsic / Common Skill)
- **Concept:** Spiritual digestive biology (Slime / Spiritual Lifeform traits).
- **Mechanics:**
  - Automatically filters parasite/infection checks when drinking untreated or salt water.
  - Extends hydration retention: Player thirst depletes 50% slower per skill tier.
  - High tier (True Sustenance): Converts raw fluids or magicule reservoirs into hydration directly, removing the need for manual drinking.

### Custom Skill: 'Adaptive Carapace / Magic Armament' (Intrinsic Passive)
- **Concept:** Hardened magicule coating defending specific body areas.
- **Mechanics:**
  - Calculates damage reduction per body limb (Head, Torso, Arms, Legs) before LSO locational damage resolves.
  - Grants a flat resistance against fracture checks from blunt hits dealt by giant mobs (e.g., Legendary Monsters).

---

## 2. Tensura Native Skills -> LSO Mechanics Bridge
All script hooks in `kubejs/server_scripts/` must adhere to these specific system bindings:

### A. Locational Health & Regeneration
LSO bypasses vanilla `player.heal()`. Healing must interface directly with LSO's limb NBT / capabilities (`legendarysurvivaloverhaul:body_damage`).
- **Self-Regeneration (Low Tier):**
  - Distributes 1 HP of limb healing every 60 ticks across the most damaged limb.
- **Ultra-Speed Regeneration (Mid Tier):**
  - Heals 2 HP across all damaged limbs simultaneously every 20 ticks.
  - Reduces active Bleeding timer by 50% per cycle.
- **Infinite Regeneration (High Tier / Demon Lord):**
  - Instantly cleanses Bleeding and Fractured limb status effects.
  - Restores all limbs to 100% capacity within 3 seconds of taking non-fatal locational damage.

### B. Temperature & Resistances
- **Flame / Heat Resistance Skills (e.g., Fire Resistance, Flame Attack Passives):**
  - Intercept LSO internal body temperature checks: Clamp the maximum temperature value below the hyperthermia trigger threshold.
  - Negate hyperthermia organ failure damage.
- **Cold / Frost Resistance Skills (e.g., Cold Tolerance):**
  - Clamp internal body temperature above the hypothermia freezing threshold.
- **Full Thermal Fluctuation Immunity (e.g., Ultimate Skills, Multi-Layer Barrier):**
  - Locks the player's LSO body temperature permanently at the 50% baseline (Optimal).

### C. Thirst & Stamina
- **Poison Resistance / Abnormal Condition Resistance:**
  - Completely neutralizes the LSO "Parasites" or "Stomach Sick" debuffs inflicted by dirty water sources.
- **Water Magic / Hydro-Skills:**
  - Casting low-tier water spells or skills replenishes small increments of LSO hydration.

---

## 3. In Control! Spawning & Scaling Rules
Applies to: **Born in Chaos**, **Legendary Monsters**, and **Threatening Mobs Revamped**.

### `config/incontrol/spawn.json` Constraints:
1. **Distance-Based Spawning (Early Game Safe Zone):**
   - Entities from `born_in_chaos_v1:*` and `legendarymonsters:*` are strictly blocked from spawning within a 1,200-block radius from world spawn (coordinates `x: -1200..1200`, `z: -1200..1200`).
2. **Dimension Isolation:**
   - High-tier apex predators from Legendary Monsters and high-threat undead from Born in Chaos are restricted to specific dimensions (Nether, End, or designated high-difficulty modded dimensions) or deep underground (`y: < 0`).
3. **Tensura Mob Interaction & Balancing:**
   - Scale base entity stats using In Control to match Tensura magicule and damage curves:
     - Boost base `generic.max_health` on Born in Chaos / Legendary Monsters variants so they are not instantly deleted by low-tier Tensura magic attacks.
     - Ensure all custom mobs retain standard tags (`#minecraft:skeletons`, `#minecraft:zombies`, or living entity classifications) so Tensura auto-targeting, skill detection, and aura senses function properly.

---

## 4. Scripting & Execution Standards
- **Performance First:** Never run heavy loop iterations over all world entities inside a 1-tick player loop. Throttle player checks using modulus counters (e.g., `if (player.age % 20 != 0) return;`).
- **NBT Safety:** Always null-check LSO limb capabilities and Tensura player data before calling mutator methods to prevent server crashes on player respawn or dimension swap.
- **Syntax:** Strict KubeJS 6/7 modern NeoForge syntax. Do not output legacy 1.12 or 1.16 KubeJS syntax (e.g., avoid `events.listen`, use `ServerEvents.*`).
