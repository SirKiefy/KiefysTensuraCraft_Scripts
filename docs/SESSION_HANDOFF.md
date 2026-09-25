# Session Handoff: TensuraJS skills + LSO bridge

Read `Claude.md` first. This file records where the previous session stopped
and what the next session must verify now that documentation hosts are
reachable. Delete or update it when the checklist is done.

## 1. Current state

Branch: `claude/tensurajs-custom-skills-cuw7gi` (pushed, ahead of `main`).

| File | Purpose | Status |
|---|---|---|
| `kubejs/startup_scripts/skills.js` | Registers `kubejs:thermoregulation` (extra), `kubejs:purification` (common), `kubejs:adaptive_carapace` (intrinsic) via `StartupEvents.registry` | Written, syntax-checked, **API names unverified** |
| `kubejs/assets/kubejs/lang/en_us.json` | Names and descriptions for the three skills | Done |
| `kubejs/server_scripts/tensura_lso_bridge.js` | 20-tick `PlayerEvents.tick` bridge: limb regeneration, temperature clamping, parasite cleansing, Tensura max HP divided across LSO limbs | Written, syntax-checked, **API names unverified** |

Both scripts were written without access to the TensuraJS, KubeJS, Tensura or
LSO documentation (the previous environment blocked those hosts). Every
unverified identifier is isolated in the config block at the top of each file,
so fixing a wrong name is a one-line edit.

`main` carries two stray commits from the previous session ("probe" adding
`docs/.keep`, then its removal). The tree is identical to the owner's last
commit. Leave them unless the owner asks to reset `main` to `d72a45e`.

## 2. Documentation to read first

Fetch these before touching code. Each maps to a verification item below.

1. TensuraJS: https://www.curseforge.com/minecraft/mc-mods/tensurajs
   (also https://www.curseforge.com/minecraft/mc-mods/tr-javascript). Look
   for the KubeJS example: registry id, builder type strings, callback names.
2. KubeJS 1.21.1 events: https://kubejs.com/wiki/events and
   https://kubejs.com/wiki/folder-structure/startup-scripts
3. Tensura skills list and ids: https://tensura-mod.fandom.com/wiki/Category:Skills
4. LSO: https://www.curseforge.com/minecraft/mc-mods/legendary-survival-overhaul
   and its source repository if linked (body damage API, temperature API,
   effect ids).
5. If the docs are thin, a ProbeJS dump from the actual modpack is the
   ground truth: `/probejs dump`, then grep the generated typings for
   `SkillAPI`, `BodyDamageUtil`, `TemperatureUtil`, `TemperatureEnum`.

## 3. Verification checklist

### skills.js
- [ ] `SKILL_REGISTRY` — currently `'manascore:skills'`. Confirm the id
      TensuraJS exposes to `StartupEvents.registry` (may be `'tensura:skill'`).
- [ ] Builder type strings `'extra'`, `'common'`, `'intrinsic'`.
- [ ] Builder callbacks: `icon`, `learningCost`, `meetEPRequirement`,
      `canBeToggled`, `canTick`, `onTick`, `onToggleOn`, `onToggleOff`,
      `onBeingDamaged`. Confirm names and argument order
      `(instance, entity[, event])`. `onBeingDamaged` assumes the 1.21
      `LivingIncomingDamageEvent` with `setAmount` and `setCanceled`.
- [ ] `JAVA.skillHelper` (`com.github.manasmods.tensura.ability.SkillHelper`)
      and its `drainMagicule(entity, amount)` / `outOfMagicule(entity, instance)`.
- [ ] `JAVA.temperatureUtil`, `JAVA.thirstUtil` class paths and the
      `internal` singleton methods `getTemperatureLevel`, `setTemperatureLevel`,
      `getThirstLevel`, `addThirstLevel`.
- [ ] `LSO.effects` ids (`heat_resistance`, `cold_resistance`, `heat_stroke`,
      `frostbite`, `parasites`) and `LSO.damage` msgIds
      (`hyperthermia`, `hypothermia`).
- [ ] Skill icons point at `kubejs:textures/skill/...` which do not exist.
      Add textures or repoint to existing Tensura icons.

### tensura_lso_bridge.js
- [ ] `JAVA_CANDIDATES.skillApi` — find the real ManasCore 1.21 `SkillAPI`
      package and put it first. Confirm `getSkillRegistry()`,
      `getSkillsFrom(entity)`, `Skills.getSkill(skill)` return shapes
      (nullable vs `Optional`; the code handles both).
- [ ] `SKILLS.*` Tensura ids, especially `ultraspeed_regeneration`,
      `infinite_regeneration`, `self_regeneration`, the flame / cold /
      thermal resistance ids, and `abnormal_condition_resistance`.
- [ ] `JAVA_CANDIDATES.bodyDamageUtil` / `bodyPartEnum` and the method names
      probed in `limbHealth`, `limbMaxHealth`, `healLimb`, `setLimbHealth`,
      `setLimbMaxHealth`. The limb-scaling feature needs a max-health
      setter; if LSO has none, decide whether to drop the feature or use
      a different mechanism (attachment / NBT write).
- [ ] `TEMP` fallbacks (optimal 12, hyperthermia from 20, freezing to 5)
      against LSO's real `TemperatureEnum` bounds.
- [ ] `LSO_EFFECTS.bleeding` / `fracture` ids. If LSO has no such effects,
      remove those calls or point them at the mod that provides them.
- [ ] `ItemEvents.foodEaten` fires for LSO drinks. If LSO drinking is an
      empty-hand water right-click that never raises a server item event,
      the periodic cleanse already covers it.

## 4. Testing plan (in the modpack)

1. Launch with both scripts; check `logs/kubejs/startup.log` and
   `logs/kubejs/server.log` for `[skills.js]` / `[tensura_lso_bridge]`
   warnings. Each warning names the class or method that failed to resolve.
2. `/tensura skill learn <player> kubejs:thermoregulation` (or the
   equivalent command from the Tensura wiki) and toggle it; stand in the
   Nether and watch magicules drop 2 per 5 s, temperature stay in band.
3. Give `tensura:ultraspeed_regeneration`, damage a limb, confirm limb HP
   rises 2 HP per second across damaged limbs.
4. Change race or max health; confirm LSO limb maxes re-split per
   `LIMB_WEIGHTS` and current limb HP keeps its fraction.
5. Drink dirty water with `kubejs:purification`; parasites should vanish
   within one tick.

## 5. Remaining work from Claude.md not yet started

- §2C: water magic / hydro skills replenishing LSO hydration on cast.
- §3: In Control! `spawn.json` / `spawner.json` rules for Born in Chaos,
  Legendary Monsters, Threatening Mobs Revamped (1,200-block safe zone,
  dimension isolation, max-health scaling, entity tags).
- `config/legendarysurvivaloverhaul/` tuning.
