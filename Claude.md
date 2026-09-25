# Project Overview & Guardrails
- **Environment:** Minecraft 1.21.1 | NeoForge | KubeJS
- **Primary Goal:** Integrate survival mechanics, custom spawning control, and Tensura skill/stat systems into a cohesive progression.
- **Allowed Scope:**
  - `kubejs/server_scripts/` (Mechanics, hooks, recipe unification, skill interactions)
  - `kubejs/startup_scripts/` (Custom registries, attributes, damage types)
  - `config/incontrol/` (Spawning, potential spawn pools, mob scaling)
  - `config/legendarysurvivaloverhaul/` (Survival stat balance and locational health)
- **Restricted:** Do NOT generate non-KubeJS Java code, external build files (Gradle/Maven), or modify unrelated mod configuration files unless explicitly instructed.

---

## 1. Legendary Survival Overhaul (LSO) Guidelines
LSO introduces **locational damage/body parts**, **body temperature**, and **thirst**.

### Locational Health & Healing Interactions
- Standard vanilla health manipulation (`player.heal()`) often fails to heal individual damaged body parts in LSO.
- When scripting healing, regeneration, or recovery effects:
  - Check for LSO-specific player capability data / NBT structures (`legendarysurvivaloverhaul:body_damage`).
  - Distribute passive healing across damaged limbs (Head, Torso, Arms, Legs) rather than solely pumping the root health pool.
  - Bleeding and fractured limbs must have interaction hooks (e.g., high-tier regeneration should clear bleeding/broken limb debuffs).

### Temperature & Thirst
- Use KubeJS player tick / periodic events (e.g., every 20–40 ticks, not every tick) to evaluate temperature and hydration.
- Respect external environmental modifiers (biomes, nearby heat/cold blocks, dimension tags).

---

## 2. Tensura Skills & Survival Stat Integration
Tensura abilities, stat attributes, and racial traits must dynamically cross-link with LSO mechanics:

### Regeneration & Recovery
- **Tensura Ultra-Speed Regeneration / Infinite Regeneration:**
  - Must bypass or rapidly heal LSO locational limb damage.
  - Automatically remove internal LSO status conditions: Bleeding, Fractures, and Hypothermia/Hyperthermia organ stress.
- **Magicule / Aura Infusion:**
  - High Magicule counts or active Barrier skills should provide flat damage mitigation before locational multipliers apply.

### Temperature Resistance
- Skills granting **Thermal Resistance / Flame Resistance / Ice Resistance** must inject modifiers into LSO’s internal temperature balance:
  - Fire/Lava immunities clamp maximum body temperature to safe ranges (neutralizing Hyperthermia).
  - Ice/Frost immunities clamp minimum body temperature to safe ranges (neutralizing Hypothermia).

### Thirst & Water Purity
- Demon / Spiritual / Slime life forms or high-tier skill holders should exhibit partial or complete immunity to dirty water parasites/thirst penalties, converting raw fluids directly into hydration or magicules.

---

## 3. In Control! Spawning & Scaling Rules
Applies to: **Born in Chaos**, **Legendary Monsters / Mobs**, **Threatening Mobs Revamped**, and related combat mods.

### File Targets
- `config/incontrol/spawn.json`: Absolute spawn restrictions, light levels, biome tags, and dimension rules.
- `config/incontrol/potentialspawn.json`: Weighted spawn rates per biome/structure.
- `config/incontrol/spawner.json` & `experience.json`: Custom drops, attribute scaling, and milestone-locked entities.

### Spawning Directives
1. **Dimension Isolation:** Ensure high-threat bosses and elite variants from Born in Chaos and Legendary Monsters are constrained to appropriate dimensions or distant world-border thresholds.
2. **Day/Milestone Scaling:** Scale mob base attributes (Max Health, Attack Damage, Knockback Resistance, Movement Speed) using In Control conditions:
   - Early game (Days 0–20): Suppress hyper-aggressive mob packs; prevent high-tier variant spawns near world spawn.
   - Mid to Late game: Introduce tiered variants with increased health pools calibrated against Tensura offensive damage scaling.
3. **Tensura Skill Target Validation:** Ensure all custom spawned entities from Born in Chaos and Legendary Monsters retain standard living entity attributes (`generic.max_health`, `generic.attack_damage`) so Tensura target-selection logic, Magicule consumption, and crowd-control skills register them correctly.

---

## 4. Scripting Conventions
- Use modern KubeJS syntax for 1.21.1:
  - Event listeners must use `ServerEvents.*` or `LevelEvents.*` correctly.
  - Prefer cached player data (`player.persistentData`) for tracking custom cooldowns or status timers.
- Prevent server lag: Avoid running heavy iterations across entire loaded entity lists inside raw tick events; use entity distance queries or event-driven triggers (`EntityEvents.hurt`, `EntityEvents.death`).
