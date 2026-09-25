# Session Handoff: TensuraJS skills + LSO bridge

Read `Claude.md` first. This file records the API verification pass and what
still needs the real modpack to confirm. Delete or update it when the
remaining items are done.

## 1. Current state

| File | Purpose | Status |
|---|---|---|
| `kubejs/startup_scripts/skills.js` | Registers `kubejs:thermoregulation` (extra), `kubejs:purification` (common), `kubejs:adaptive_carapace` (intrinsic) via `StartupEvents.registry('manascore:skills', ...)` | Rewritten against verified ManasCore / LSO / KubeJS APIs. TensuraJS builder method names still unverified (see §3). |
| `kubejs/server_scripts/tensura_lso_bridge.js` | 20-tick `PlayerEvents.tick` bridge: limb regeneration, temperature immunity/clamping, dirty-water cleansing | Rewritten against verified APIs. Tensura skill ids still unverified (see §3). |
| `kubejs/assets/kubejs/lang/en_us.json` | Names and descriptions for the three skills | Done |
| `kubejs/assets/kubejs/textures/skill/{extra,common,intrinsic}/*.png` | 32x32 placeholder icons (generated, flat shapes) | Done; replace with real art when available |

`main` carries two stray commits from an earlier session ("probe" adding
`docs/.keep`, then its removal). The tree is identical to the owner's last
commit. Leave them unless the owner asks to reset `main` to `d72a45e`.

## 2. What was verified, and from where

The documentation hosts in `Claude.md` (kubejs.com, curseforge.com,
tensura wikis, modrinth, deepwiki, archive.org) are blocked from the dev
environment. `raw.githubusercontent.com` and GitHub page views are reachable,
so everything below was read from source on GitHub.

### ManasCore 1.21.1 (`ManasMods/ManasCore`, branch `1.21.1/minh`)
- Skill registry id: `manascore:skills` (`skill.impl.SkillRegistry`).
- `io.github.manasmods.manascore.skill.api.SkillAPI`:
  `getSkillRegistry()` (Architectury `Registrar<ManasSkill>`),
  `getSkillRegistryKey()`, `getSkillsFrom(LivingEntity)` (never null, returns
  `Skills.EMPTY` when the storage is missing).
- `Skills.getSkill(ResourceLocation)` and `getSkill(ManasSkill)` return
  `Optional<ManasSkillInstance>`; `getLearnedSkills()`.
- `ManasSkillInstance`: `isToggled()`, `setToggled()`, `canBeToggled(entity)`,
  `canTick(entity)`, `isMastered(entity)`, `getOrCreateTag()`, `markDirty()`,
  `onToggleOff(entity)`, `getSkill()`.
- `ManasSkill` hooks: `canBeToggled(instance, entity)`, `canTick`,
  `onTick(instance, living)`, `onToggleOn/Off(instance, entity)`,
  `addMasteryPoint(instance, entity)`,
  `onBeingDamaged(instance, entity, DamageSource, float) -> boolean`
  (return `false` cancels; amount is read-only),
  `onTakenDamage(instance, owner, DamageSource, Changeable<Float>) -> boolean`
  (`amount.set(x)` rescales). The scripts wire both and accept either shape.

### Tensura: Reincarnated 1.21.1 (closed source; read from public addons
`MoosWqz/tensurasingleplayeraddon`, `RisingEclipse/Tensura-Starlight-1.21.1`,
`ManasMods/tensura-opac`, and the 1.19.2 `Sersium/TensuraAddons` example)
- Package root is `io.github.manasmods.tensura` (1.19.2 used `com.github...`).
- `io.github.manasmods.tensura.ability.SkillHelper` (1.19.2 exposed
  `outOfMagicule(entity, instance)` and `outOfMagicule(entity, double)`;
  1.21.1 names not confirmed), `ability.SkillUtils.hasSkill(entity, skill)` /
  `isSkillMastered(entity, skill)`, `ability.skill.Skill` with
  `SkillType.{INTRINSIC,COMMON,EXTRA,UNIQUE,ULTIMATE}`.
- Magicules: `io.github.manasmods.tensura.storage.TensuraStorages
  .getExistenceFrom(player)` -> `getMagicule()`, `setMagicule(double)`,
  `markDirty()`, `getEP()`. This is what `skills.js` drains with.
- 1.21.1 `Skill` overrides seen in addons: `getAcquiringMagiculeCost(instance)`,
  `getAcquirementMastery(entity)`, `checkAcquiringRequirement(Player, double newEP)`,
  `getMagiculeCost(entity, instance, mode)`. 1.19.2 used `learningCost()`,
  `meetEPRequirement(player, ep)`, `magiculeCost(entity, instance)`.
  `skills.js` tries the 1.21.1 names first, then the 1.19.2 names.
- Skill id format confirmed as `tensura:<snake_case>` (`tensura:predator`,
  `tensura:great_sage`, `tensura:magic_sense`, `tensura:sage`). The regen /
  resistance ids in `SKILLS` are still educated guesses.

### Legendary Survival Overhaul (`sfiomn/LegendarySurvivalOverhaul`)
The GitHub `1.21.1` branch still holds the 1.20.1 Forge 2.3.x code (last
commit Sep 2025); the CurseForge `1.21.1-2.4` jar is NeoForge and its source
is not published. Public API package names are assumed unchanged.
- `api.bodydamage.BodyDamageUtil` (static): `healBodyPart(player, part, float)`,
  `hurtBodyPart`, `applyHealingTimeBodyPart(player, part, float, int)`,
  `getHealthRatio(player, part)`, `getMaxHealth(player, part)`. There is no
  static getter for current health (use ratio * max) and no static
  max-health setter.
- `api.bodydamage.BodyPartEnum`: `HEAD, RIGHT_ARM, LEFT_ARM, CHEST, RIGHT_LEG,
  RIGHT_FOOT, LEFT_LEG, LEFT_FOOT`.
- `api.bodydamage.IBodyDamageCapability` (via `util.CapabilityUtil
  .getBodyDamageCapability(player)` in 2.3): `getBodyPartDamage`,
  `getBodyPartMaxHealth`, `setBodyPartDamage`, `setBodyPartMaxHealth`, `heal`, `hurt`.
- Limb max health already tracks the player's max health when the config
  `body-parts-health / "Body Part Health Mode"` is `DYNAMIC` (the default):
  `BodyDamageCapability` recomputes every limb from
  `HealthUtil.getPlayerStableMaxHealth(player)` every 20 ticks and keeps the
  damage offset. The script-side limb scaling from the previous revision was
  therefore removed; keep that config on `DYNAMIC`.
- `api.temperature.TemperatureEnum`: `FROSTBITE 0-10, COLD 10-16, NORMAL 16-24,
  HOT 24-30, HEAT_STROKE 30-40`, with `getLowerBound()`, `getUpperBound()`,
  `getMiddle()`. Optimal body temperature is 20, not 12.
- `api.temperature.TemperatureUtil` (static): `getWorldTemperature(level, pos)`,
  `getTemperatureEnum(float)`, `clampTemperature`, `add{Heat,Cold,Thermal}ResistanceModifier(player, double, UUID)`,
  `addTemperatureModifier`. Body temperature itself lives on
  `ITemperatureCapability.getTemperatureLevel()/setTemperatureLevel(float)`
  (via `CapabilityUtil.getTempCapability(player)` in 2.3).
- `api.thirst.ThirstUtil` (static): `takeDrink(player, int hydration, float saturation)`,
  `addExhaustion`, `isThirstActive`. Hydration level lives on
  `IThirstCapability.getHydrationLevel()/addHydrationLevel(int)/isHydrationLevelAtMax()`
  (via `CapabilityUtil.getThirstCapability(player)` in 2.3).
- Effects (`registry.MobEffectRegistry`): `thirst`, `hydration_fill`,
  `hot_food`, `hot_drink`, `cold_food`, `cold_drink`, `heat_resistance`,
  `cold_resistance`, `frostbite`, `cold_hunger`, `heat_stroke`, `heat_thirst`,
  `cold_immunity`, `heat_immunity`, `temperature_immunity`, `painkiller`,
  `painkiller_addiction`, `hard_falling`, `vulnerability`, `headache`,
  `recovery`. There is **no** `parasites`, `bleeding` or `fracture` effect:
  dirty water applies `thirst`; a limb at 0 HP is "broken" and inflicts the
  `hard_falling` / `vulnerability` / `headache` maluses.
- Damage types (`api.ModDamageTypes`): msgIds are
  `legendarysurvivaloverhaul.hyperthermia`, `.hypothermia`, `.dehydration`
  (the mod id prefix is part of the msgId).

### KubeJS 2101 (`KubeJS-Mods/KubeJS`, branch `2101`)
- `StartupEvents.registry(<registry id>, ...)` with `event.create(id, type)`;
  unknown builder types throw at startup.
- `PlayerEvents.tick` (common), `ItemEvents.foodEaten` (common, exposes
  `event.entity` and `event.item`; there is no `event.player`).
- `MinecraftServerKJS` has no `scheduleInTicks` in 2101; `setTimeout` /
  `setInterval` are the server-script bindings. The scripts no longer schedule.
- `EntityPotionEffectsJS`: `add(Holder<MobEffect>, duration, amplifier, ambient, showParticles)`,
  `isActive(holder)`, `getActive(holder)`; effect id strings are wrapped to
  holders by `KubeJSContext` (`HolderWrapper.wrap`). Removal goes through
  vanilla `entity.removeEffect(holder)`.
- `Registry.of('minecraft:mob_effect').contains(id)` (the old
  `Registry.MOB_EFFECT` field does not exist).
- No `entity.age` accessor in 2101; scripts use vanilla `tickCount`.
- Bindings present: `Java`, `Text`, `Registry`, `Utils`, `NBT`, `DamageSource`.

## 3. Still unverified (needs the modpack or a ProbeJS dump)

- [ ] **TensuraJS builder surface.** TensuraJS (`tr-javascript`, abandoned,
      v2.0.0 for 1.21.1) is not on GitHub and CurseForge is blocked. Unknown:
      the registry id it exposes to `StartupEvents.registry`, the builder
      type strings (`'extra'`, `'common'`, `'intrinsic'`), and the builder
      method names. `skills.js` applies every callback through
      `applyCallback()`, which logs `builder has none of [...]` for each
      missing method instead of failing, so the startup log lists exactly
      what to rename. Also unknown: whether TensuraJS exposes both
      `onBeingDamaged` and `onTakenDamage`; both are wired.
- [ ] **Tensura skill ids** in `SKILLS` (`tensura_lso_bridge.js`). Run
      `/manascore skills list` (or `/probejs dump` and grep
      `tensura:` under the skill registry) and fix any of:
      `self_regeneration`, `ultraspeed_regeneration`, `infinite_regeneration`,
      `heat_resistance`, `cold_resistance`, `flame_attack_resistance`,
      `thermal_fluctuation_resistance`, `*_nullification`,
      `abnormal_condition_resistance`, `poison_resistance`, `multilayer_barrier`.
- [ ] **LSO 2.4 NeoForge accessor for capabilities.** `CapabilityUtil` is the
      2.3 Forge name. If the startup log shows
      `Could not load sfiomn.legendarysurvivaloverhaul.util.CapabilityUtil`,
      find the attachment accessor in a ProbeJS dump and add it to
      `JAVA.capabilityUtil` / `JAVA_CANDIDATES.capabilityUtil`. Without it:
      Thermoregulation tier 2 and the bridge still work through LSO's
      immunity effects; Purification's thirst-refund and True Sustenance are
      disabled (they need `getHydrationLevel()`).
- [ ] `SkillHelper` 1.21.1 method names (only `learnSkill` was seen). Not
      needed by the scripts anymore; magicules go through `TensuraStorages`.
- [ ] Icons are placeholders; replace the three PNGs with real art.

## 4. Testing plan (in the modpack)

1. Launch with both scripts; read `logs/kubejs/startup.log` and
   `logs/kubejs/server.log` for `[skills.js]` / `[tensura_lso_bridge]`
   warnings. Each warning names the class, builder method or effect id that
   failed to resolve.
2. Learn and toggle `kubejs:thermoregulation`; stand in the Nether and watch
   magicules drop 2 per 5 s, `heat_resistance` / `cold_resistance` refresh
   every second, and hyperthermia damage halve (tier 1) or stop (mastered).
3. Give the Ultraspeed Regeneration skill, damage a limb, confirm limb HP
   rises 2 HP per second spread across damaged limbs.
4. Change race or max health; confirm LSO's DYNAMIC mode re-splits limb
   maxes on its own (no script involved).
5. Drink dirty water with `kubejs:purification`; the `thirst` effect should
   vanish within one second.

## 5. Remaining work from Claude.md not yet started

- §2C: water magic / hydro skills replenishing LSO hydration on cast.
- §3: In Control! `spawn.json` / `spawner.json` rules for Born in Chaos,
  Legendary Monsters, Threatening Mobs Revamped (1,200-block safe zone,
  dimension isolation, max-health scaling, entity tags).
- `config/legendarysurvivaloverhaul/` tuning (at minimum confirm
  `Body Part Health Mode = DYNAMIC`).
