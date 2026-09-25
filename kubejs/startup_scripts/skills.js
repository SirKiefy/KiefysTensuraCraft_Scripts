// priority: 100
//
// kubejs/startup_scripts/skills.js
// ---------------------------------
// Custom TensuraJS skills that bridge Tensura magicule mechanics into
// Legendary Survival Overhaul (LSO) body systems. See Claude.md §1.
//
//   kubejs:thermoregulation   (Extra Skill)      - heat / cold magicule flow control
//   kubejs:purification       (Common Skill)     - spiritual digestion, thirst & dirty water
//   kubejs:adaptive_carapace  (Intrinsic Skill)  - per-limb magicule armament
//
// Skill tiers map onto Tensura mastery: an un-mastered skill is Tier 1,
// a mastered skill (instance.isMastered(entity)) is Tier 2 / "True" tier.
//
// Every cross-mod Java class is resolved lazily and null-checked, so a
// missing or renamed LSO / Tensura class degrades to a no-op with one
// warning instead of crashing the server (Claude.md §4 NBT Safety).
//
// Verification status (see docs/SESSION_HANDOFF.md for sources):
//   VERIFIED   ManasCore 1.21.1 skill hooks, LSO 2.3.x API/effect/damage ids,
//              KubeJS 2101 event and binding names, Tensura 1.21.1 package names.
//   UNVERIFIED TensuraJS builder method names (the mod is closed source and
//              its CurseForge page is unreachable from the dev environment).
//              Every builder call below is therefore applied through
//              applyCallback(), which skips - and logs - any method the
//              builder does not expose instead of aborting registration.

// ---------------------------------------------------------------------
// 0. Registry / API wiring (the only block that should ever need edits)
// ---------------------------------------------------------------------
// ManasCore registers its skill registry as "manascore:skills"
// (io.github.manasmods.manascore.skill.impl.SkillRegistry). TensuraJS must
// expose KubeJS builder types for that key; if the startup log reports an
// unknown registry, check a ProbeJS dump for the id TensuraJS uses.
const SKILL_REGISTRY = 'manascore:skills'

// Builder type strings passed to event.create(id, type). Tensura's own
// SkillType enum is INTRINSIC / COMMON / EXTRA / UNIQUE / ULTIMATE /
// RESISTANCE; TensuraJS is assumed to accept the lowercase names.
const SKILL_TYPES = { extra: 'extra', common: 'common', intrinsic: 'intrinsic' }

// Fully-qualified classes used for the LSO / Tensura bridge.
//   tensuraStorages : Tensura 1.21.1, verified from public addon source.
//   skillHelper     : Tensura 1.21.1 package verified; 1.19.2 exposed
//                     outOfMagicule(entity, instance) and (entity, double).
//   capabilityUtil  : LSO 2.3.x (Forge). The 2.4 NeoForge build may have
//                     moved to attachments; the script degrades gracefully.
//   thirstUtil      : LSO public API, static takeDrink(player, int, float).
//   temperatureUtil : LSO public API, static getWorldTemperature(level, pos)
//                     and getTemperatureEnum(float).
const JAVA = {
  tensuraStorages: 'io.github.manasmods.tensura.storage.TensuraStorages',
  skillHelper: 'io.github.manasmods.tensura.ability.SkillHelper',
  capabilityUtil: 'sfiomn.legendarysurvivaloverhaul.util.CapabilityUtil',
  thirstUtil: 'sfiomn.legendarysurvivaloverhaul.api.thirst.ThirstUtil',
  temperatureUtil: 'sfiomn.legendarysurvivaloverhaul.api.temperature.TemperatureUtil'
}

// LSO ids referenced by the skills (all registered in
// sfiomn.legendarysurvivaloverhaul.registry.MobEffectRegistry / api.ModDamageTypes).
const LSO = {
  effects: {
    heatResistance: 'legendarysurvivaloverhaul:heat_resistance',
    coldResistance: 'legendarysurvivaloverhaul:cold_resistance',
    temperatureImmunity: 'legendarysurvivaloverhaul:temperature_immunity',
    heatStroke: 'legendarysurvivaloverhaul:heat_stroke',
    frostbite: 'legendarysurvivaloverhaul:frostbite',
    heatThirst: 'legendarysurvivaloverhaul:heat_thirst',
    coldHunger: 'legendarysurvivaloverhaul:cold_hunger',
    // LSO's dirty-water debuff (applied by ThirstUtil.takeDrink from the
    // drink's JSON effect list). LSO has no separate "parasites" effect.
    thirst: 'legendarysurvivaloverhaul:thirst'
  },
  // DamageType msgIds are "<modid>.<name>" (ModDamageTypes.bootstrap).
  damage: {
    hyperthermia: 'legendarysurvivaloverhaul.hyperthermia',
    hypothermia: 'legendarysurvivaloverhaul.hypothermia',
    dehydration: 'legendarysurvivaloverhaul.dehydration'
  },
  // TemperatureEnum: FROSTBITE 0-10, COLD 10-16, NORMAL 16-24, HOT 24-30,
  // HEAT_STROKE 30-40. 20 is the middle of NORMAL ("50% baseline").
  temperature: { min: 0, optimal: 20.0, max: 40 },
  // Hydration runs 0..20 like vanilla hunger.
  hydration: { max: 20 }
}

// ---------------------------------------------------------------------
// 1. Shared helpers
// ---------------------------------------------------------------------
const _classCache = {}
function loadJava(key) {
  if (_classCache[key] !== undefined) return _classCache[key]
  let clazz = null
  try {
    clazz = Java.loadClass(JAVA[key])
  } catch (e) {
    console.warn(`[skills.js] Could not load ${JAVA[key]} (${key}); related bridge disabled. ${e}`)
  }
  _classCache[key] = clazz
  return clazz
}

// Apply the first builder method that exists from `names`. Returns the
// builder so calls can chain; logs (once per skill+name) when none match so
// a TensuraJS rename shows up in logs/kubejs/startup.log instead of
// silently dropping a mechanic.
function applyCallback(builder, skillId, names, arg) {
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    try {
      if (typeof builder[name] === 'function') {
        builder[name](arg)
        return builder
      }
    } catch (e) {
      console.warn(`[skills.js] ${skillId}: builder.${name} threw ${e}`)
      return builder
    }
  }
  console.warn(`[skills.js] ${skillId}: builder has none of [${names.join(', ')}]; that mechanic is disabled.`)
  return builder
}

function isServerPlayer(entity) {
  return entity && entity.isPlayer() && !entity.level.isClientSide()
}

// Tier helpers: 1 = base, 2 = mastered.
function tierOf(instance, entity) {
  return instance.isMastered(entity) ? 2 : 1
}

// --- Magicules -------------------------------------------------------
// Primary path: Tensura's existence storage (verified 1.21.1 API):
//   TensuraStorages.getExistenceFrom(player).getMagicule()/setMagicule()/markDirty()
function existenceOf(entity) {
  const storages = loadJava('tensuraStorages')
  if (!storages) return null
  try {
    return storages.getExistenceFrom(entity)
  } catch (e) {
    return null
  }
}

function magiculeOf(entity) {
  const ex = existenceOf(entity)
  if (!ex) return NaN
  try {
    return Number(ex.getMagicule())
  } catch (e) {
    return NaN
  }
}

// Returns true if `amount` magicules were paid.
function drainMagicule(entity, amount) {
  if (!(amount > 0)) return true
  const ex = existenceOf(entity)
  if (!ex) return false
  try {
    const current = Number(ex.getMagicule())
    if (current < amount) return false
    ex.setMagicule(current - amount)
    ex.markDirty()
    return true
  } catch (e) {
    console.warn(`[skills.js] drainMagicule failed: ${e}`)
    return false
  }
}

function hasMagicule(entity, amount) {
  const m = magiculeOf(entity)
  return !isNaN(m) && m >= amount
}

// --- Effects ---------------------------------------------------------
function applyEffect(entity, effectId, duration, amplifier) {
  entity.potionEffects.add(effectId, duration, amplifier, false, false)
}

function removeEffect(entity, effectId) {
  try {
    if (entity.potionEffects.isActive(effectId)) entity.removeEffect(effectId)
  } catch (e) {
    // effect id not registered in this LSO build
  }
}

// Award a mastery point every `every` ticks the skill is active
// (same pattern Tensura addons use: instance tag "activatedTimes").
function tickMastery(instance, entity, every) {
  const tag = instance.getOrCreateTag()
  const t = tag.getInt('activatedTimes')
  if (t % every === 0) instance.getSkill().addMasteryPoint(instance, entity)
  tag.putInt('activatedTimes', t + 1)
}

// --- LSO capabilities (optional; every use is guarded) ---------------
function lsoTempCapability(player) {
  const util = loadJava('capabilityUtil')
  if (!util) return null
  try {
    return util.getTempCapability(player)
  } catch (e) {
    return null
  }
}

function lsoThirstCapability(player) {
  const util = loadJava('capabilityUtil')
  if (!util) return null
  try {
    return util.getThirstCapability(player)
  } catch (e) {
    return null
  }
}

function hydrationLevel(player) {
  const cap = lsoThirstCapability(player)
  if (!cap) return NaN
  try {
    return Number(cap.getHydrationLevel())
  } catch (e) {
    return NaN
  }
}

// Adds hydration through LSO's public API (clamped at max by LSO).
function addHydration(player, points) {
  if (!(points > 0)) return false
  const util = loadJava('thirstUtil')
  if (!util) return false
  try {
    util.takeDrink(player, points, 0.0)
    return true
  } catch (e) {
    console.warn(`[skills.js] ThirstUtil.takeDrink failed: ${e}`)
    return false
  }
}

// --- Environment -----------------------------------------------------
// "Extreme" = the Nether, or a spot whose LSO world temperature is outside
// the NORMAL band. Falls back to vanilla biome base temperature.
function inExtremeBiome(entity) {
  const level = entity.level
  if (dimensionId(level) == 'minecraft:the_nether') return true
  const util = loadJava('temperatureUtil')
  if (util) {
    try {
      const t = util.getWorldTemperature(level, entity.blockPosition())
      const band = String(util.getTemperatureEnum(t))
      return band != 'NORMAL'
    } catch (e) {
      // fall through to vanilla biome check
    }
  }
  try {
    const biome = level.getBiome(entity.blockPosition())
    const temp = biome.value().getBaseTemperature()
    return temp <= 0.15 || temp >= 1.5
  } catch (e) {
    return false
  }
}

function dimensionId(level) {
  try {
    const d = level.dimension
    return String(d.location ? d.location() : d)
  } catch (e) {
    return ''
  }
}

function damageTypeId(source) {
  try {
    return String(source.getMsgId())
  } catch (e) {
    return ''
  }
}

// --- Damage hook adapter ---------------------------------------------
// ManasCore 1.21.1 exposes two damage hooks on ManasSkill:
//   onBeingDamaged(instance, entity, source, float amount) -> boolean
//       return false to cancel the hit; the amount cannot be changed here.
//   onTakenDamage(instance, owner, source, Changeable<Float> amount) -> boolean
//       amount.set(x) rescales the hit.
// TensuraJS may forward either shape, or wrap them in an event object with
// getSource()/getAmount()/setAmount()/setCanceled(). normalizeDamage() makes
// one handler work with all three.
function normalizeDamage(args) {
  const ctx = { source: null, amount: NaN, canceled: false, changeable: null, event: null }
  const a2 = args[2]
  if (a2 && typeof a2.getSource === 'function') {
    ctx.event = a2
    ctx.source = a2.getSource()
    try { ctx.amount = Number(a2.getAmount()) } catch (e) { ctx.amount = NaN }
  } else {
    ctx.source = a2
    const a3 = args[3]
    if (a3 && typeof a3.get === 'function' && typeof a3.set === 'function') {
      ctx.changeable = a3
      try { ctx.amount = Number(a3.get()) } catch (e) { ctx.amount = NaN }
    } else {
      ctx.amount = Number(a3)
    }
  }
  ctx.setAmount = function (v) {
    ctx.amount = v
    if (ctx.event && typeof ctx.event.setAmount === 'function') ctx.event.setAmount(v)
    else if (ctx.changeable) ctx.changeable.set(v)
  }
  ctx.cancel = function () {
    ctx.canceled = true
    if (ctx.event && typeof ctx.event.setCanceled === 'function') ctx.event.setCanceled(true)
    else if (ctx.changeable) ctx.changeable.set(0.0)
  }
  // ManasCore hooks return true to continue, false to cancel.
  ctx.result = function () { return !ctx.canceled }
  return ctx
}

// Damage that no physical coating can stop (vanilla msgIds of #bypasses_armor
// minus fall / falling blocks, which the carapace does absorb) plus LSO's.
const NON_PHYSICAL_DAMAGE = [
  'drown', 'starve', 'wither', 'outOfWorld', 'genericKill', 'magic', 'indirectMagic',
  'dryout', 'freeze', 'onFire', 'inFire', 'lava', 'hotFloor', 'sonic_boom', 'cramming',
  'inWall', 'dragonBreath', 'thorns',
  LSO.damage.hyperthermia, LSO.damage.hypothermia, LSO.damage.dehydration
]

// ---------------------------------------------------------------------
// 2. Skill registration
// ---------------------------------------------------------------------
StartupEvents.registry(SKILL_REGISTRY, event => {

  // -------------------------------------------------------------------
  // Thermoregulation (Extra Skill)
  //   Tier 1 - Thermal Resistance: halves hyper/hypothermia tick damage,
  //            neutralises biome temperature penalties (LSO resistance effects).
  //   Tier 2 - Absolute Thermal Control: LSO temperature_immunity effect,
  //            body temperature locked at optimal, temperature debuffs removed.
  //   Cost   - 2 magicules per 100 ticks while in an extreme biome.
  // -------------------------------------------------------------------
  const THERMO_ID = 'kubejs:thermoregulation'
  const THERMO_DRAIN = 2.0
  const THERMO_DRAIN_INTERVAL = 100
  const THERMO_EFFECT_TICKS = 60

  function thermoDamage(instance, entity, args) {
    if (!instance.isToggled()) return true
    const dmg = normalizeDamage(args)
    const id = damageTypeId(dmg.source)
    if (id != LSO.damage.hyperthermia && id != LSO.damage.hypothermia) return true
    if (tierOf(instance, entity) >= 2) {
      dmg.cancel()                                   // Absolute Thermal Control: immune
    } else if (!isNaN(dmg.amount)) {
      dmg.setAmount(dmg.amount * 0.5)                // Thermal Resistance: halve
    }
    return dmg.result()
  }

  const thermo = event.create(THERMO_ID, SKILL_TYPES.extra)
  applyCallback(thermo, THERMO_ID, ['icon', 'skillIcon'], 'kubejs:textures/skill/extra/thermoregulation.png')
  // Tensura 1.21.1: checkAcquiringRequirement(player, newEP); 1.19.2: meetEPRequirement.
  applyCallback(thermo, THERMO_ID, ['checkAcquiringRequirement', 'meetEPRequirement'], (player, ep) => ep >= 20000.0)
  // Tensura 1.21.1: getAcquiringMagiculeCost(instance); 1.19.2: learningCost().
  applyCallback(thermo, THERMO_ID, ['acquiringMagiculeCost', 'getAcquiringMagiculeCost', 'learningCost'], 120.0)
  applyCallback(thermo, THERMO_ID, ['canBeToggled'], (instance, entity) => true)
  applyCallback(thermo, THERMO_ID, ['canTick'], (instance, entity) => instance.isToggled())
  applyCallback(thermo, THERMO_ID, ['onToggleOff'], (instance, entity) => {
    removeEffect(entity, LSO.effects.heatResistance)
    removeEffect(entity, LSO.effects.coldResistance)
    removeEffect(entity, LSO.effects.temperatureImmunity)
  })
  applyCallback(thermo, THERMO_ID, ['onTick'], (instance, entity) => {
    if (!isServerPlayer(entity)) return
    const player = entity
    const tick = player.tickCount
    if (tick % 20 != 0) return // throttle: once a second

    const tier = tierOf(instance, entity)

    // Tier 1: LSO's own resistance effects offset ambient heat / cold.
    applyEffect(player, LSO.effects.heatResistance, THERMO_EFFECT_TICKS, tier - 1)
    applyEffect(player, LSO.effects.coldResistance, THERMO_EFFECT_TICKS, tier - 1)

    // Tier 2: full immunity effect, hard-lock body temperature, strip debuffs.
    if (tier >= 2) {
      applyEffect(player, LSO.effects.temperatureImmunity, THERMO_EFFECT_TICKS, 0)
      const cap = lsoTempCapability(player)
      if (cap) {
        try {
          if (Math.abs(Number(cap.getTemperatureLevel()) - LSO.temperature.optimal) > 0.01) {
            cap.setTemperatureLevel(LSO.temperature.optimal)
          }
        } catch (e) {
          // capability API differs in this LSO build; the immunity effect still applies
        }
      }
      removeEffect(player, LSO.effects.heatStroke)
      removeEffect(player, LSO.effects.frostbite)
      removeEffect(player, LSO.effects.heatThirst)
      removeEffect(player, LSO.effects.coldHunger)
    }

    // Passive drain only while exposed to extreme biomes.
    if (tick % THERMO_DRAIN_INTERVAL == 0 && inExtremeBiome(player)) {
      if (!drainMagicule(player, THERMO_DRAIN)) {
        player.tell(Text.red('Thermoregulation toggled off: not enough magicules.'))
        instance.setToggled(false)
        instance.onToggleOff(player)
        instance.markDirty()
        return
      }
    }

    tickMastery(instance, entity, 30)
  })
  // Both ManasCore damage hooks are wired; whichever TensuraJS forwards works.
  applyCallback(thermo, THERMO_ID, ['onBeingDamaged'], function (instance, entity) { return thermoDamage(instance, entity, arguments) })
  applyCallback(thermo, THERMO_ID, ['onTakenDamage'], function (instance, entity) { return thermoDamage(instance, entity, arguments) })

  // -------------------------------------------------------------------
  // Purification & Sustenance (Common Skill)
  //   - Cleanses LSO's dirty-water "thirst" debuff.
  //   - Hydration depletes 50% slower per tier (tier 1: half of lost points
  //     are refunded; tier 2: every lost point is refunded, see below).
  //   - Tier 2 (True Sustenance): converts magicules directly into hydration,
  //     removing the need to drink.
  // -------------------------------------------------------------------
  const PURIFY_ID = 'kubejs:purification'
  const SUSTENANCE_COST_PER_POINT = 5.0

  const purify = event.create(PURIFY_ID, SKILL_TYPES.common)
  applyCallback(purify, PURIFY_ID, ['icon', 'skillIcon'], 'kubejs:textures/skill/common/purification.png')
  applyCallback(purify, PURIFY_ID, ['checkAcquiringRequirement', 'meetEPRequirement'], (player, ep) => ep >= 5000.0)
  applyCallback(purify, PURIFY_ID, ['acquiringMagiculeCost', 'getAcquiringMagiculeCost', 'learningCost'], 60.0)
  applyCallback(purify, PURIFY_ID, ['canBeToggled'], (instance, entity) => true)
  applyCallback(purify, PURIFY_ID, ['canTick'], (instance, entity) => instance.isToggled())
  applyCallback(purify, PURIFY_ID, ['onToggleOn'], (instance, entity) => {
    if (!isServerPlayer(entity)) return
    const level = hydrationLevel(entity)
    if (!isNaN(level)) instance.getOrCreateTag().putInt('lastHydration', level)
  })
  applyCallback(purify, PURIFY_ID, ['onTick'], (instance, entity) => {
    if (!isServerPlayer(entity)) return
    const player = entity
    if (player.tickCount % 20 != 0) return

    const tier = tierOf(instance, entity)

    // Spiritual digestion: the dirty-water debuff never takes hold.
    removeEffect(player, LSO.effects.thirst)

    const current = hydrationLevel(player)
    if (!isNaN(current)) {
      const tag = instance.getOrCreateTag()
      const last = tag.contains('lastHydration') ? tag.getInt('lastHydration') : current

      if (current < last) {
        // Hydration dropped since last check. Refund half the loss at tier 1
        // (probabilistic per point => 50% slower on average), all of it at tier 2.
        const lost = last - current
        let refund = 0
        for (let i = 0; i < lost; i++) {
          if (tier >= 2 || Math.random() < 0.5) refund++
        }
        if (tier >= 2 && refund > 0) {
          // True Sustenance: hydration is paid for with magicules instead.
          if (!drainMagicule(player, refund * SUSTENANCE_COST_PER_POINT)) refund = 0
        }
        if (refund > 0) addHydration(player, refund)
      }

      // True Sustenance also tops the bar back up from magicule reserves.
      if (tier >= 2) {
        const now = hydrationLevel(player)
        if (!isNaN(now) && now < LSO.hydration.max && drainMagicule(player, SUSTENANCE_COST_PER_POINT)) {
          addHydration(player, 1)
        }
      }

      const after = hydrationLevel(player)
      tag.putInt('lastHydration', isNaN(after) ? current : after)
    }

    tickMastery(instance, entity, 60)
  })

  // -------------------------------------------------------------------
  // Adaptive Carapace / Magic Armament (Intrinsic Passive)
  //   - Per-limb damage reduction applied before LSO locational damage.
  //   - Flat resistance to blunt hits from giant mobs so they fall under
  //     LSO's limb-break threshold.
  // -------------------------------------------------------------------
  const CARAPACE_ID = 'kubejs:adaptive_carapace'
  // Base reduction per limb; mastered skill adds CARAPACE_MASTERY_BONUS.
  const CARAPACE_DR = { head: 0.25, torso: 0.15, arms: 0.10, legs: 0.10 }
  const CARAPACE_MASTERY_BONUS = 0.10
  const CARAPACE_FLAT_VS_GIANTS = 4.0
  const GIANT_HEIGHT = 2.5

  // Best-effort limb inference from the damage source. LSO rolls the exact
  // limb later; this picks the limb the hit is most likely to land on.
  function inferLimb(source, victim) {
    const id = damageTypeId(source)
    if (id == 'fall' || id == 'stalagmite' || id == 'sweetBerryBush') return 'legs'
    if (id == 'fallingBlock' || id == 'fallingAnvil' || id == 'fallingStalactite') return 'head'
    if (id == 'flyIntoWall') return 'head'
    const attacker = source.getDirectEntity()
    if (attacker) {
      // Compare the attacker's eye height to the victim's to guess high / low hits.
      const dy = attacker.getEyeY() - victim.getY()
      if (dy > victim.getBbHeight() * 0.85) return 'head'
      if (dy < victim.getBbHeight() * 0.35) return 'legs'
      return victim.isBlocking() ? 'arms' : 'torso'
    }
    return 'torso'
  }

  function isGiantMob(attacker) {
    if (!attacker || !attacker.isLiving() || attacker.isPlayer()) return false
    const type = String(attacker.type)
    if (type.startsWith('legendarymonsters:')) return true
    return attacker.getBbHeight() >= GIANT_HEIGHT
  }

  function carapaceDamage(instance, entity, args) {
    if (!instance.isToggled()) return true
    const dmg = normalizeDamage(args)
    const source = dmg.source
    if (!source || isNaN(dmg.amount)) return true
    const id = damageTypeId(source)
    // Only physical hits get armament; environmental / thermal damage is Thermoregulation's job.
    if (NON_PHYSICAL_DAMAGE.indexOf(id) >= 0) return true

    let amount = dmg.amount
    const limb = inferLimb(source, entity)
    let dr = CARAPACE_DR[limb] || CARAPACE_DR.torso
    if (tierOf(instance, entity) >= 2) dr += CARAPACE_MASTERY_BONUS
    amount = amount * (1.0 - dr)

    // Fracture guard: giant blunt hits lose a flat chunk before LSO's limb check.
    // A direct hit has the attacker itself as the direct entity; a projectile does not.
    const attacker = source.getDirectEntity()
    const isMelee = attacker && source.getEntity() && attacker.equals(source.getEntity())
    if (isMelee && isGiantMob(attacker)) {
      amount = Math.max(0.0, amount - CARAPACE_FLAT_VS_GIANTS)
    }

    dmg.setAmount(amount)
    instance.getOrCreateTag().putString('lastLimb', limb)
    return dmg.result()
  }

  const carapace = event.create(CARAPACE_ID, SKILL_TYPES.intrinsic)
  applyCallback(carapace, CARAPACE_ID, ['icon', 'skillIcon'], 'kubejs:textures/skill/intrinsic/adaptive_carapace.png')
  applyCallback(carapace, CARAPACE_ID, ['canBeToggled'], (instance, entity) => true)
  applyCallback(carapace, CARAPACE_ID, ['canTick'], (instance, entity) => instance.isToggled())
  applyCallback(carapace, CARAPACE_ID, ['onTick'], (instance, entity) => {
    if (!isServerPlayer(entity)) return
    if (entity.tickCount % 20 != 0) return
    tickMastery(instance, entity, 120)
  })
  // onTakenDamage carries a Changeable amount (the only hook that can rescale);
  // onBeingDamaged is wired too in case TensuraJS forwards an event object there.
  applyCallback(carapace, CARAPACE_ID, ['onTakenDamage'], function (instance, entity) { return carapaceDamage(instance, entity, arguments) })
  applyCallback(carapace, CARAPACE_ID, ['onBeingDamaged'], function (instance, entity) { return carapaceDamage(instance, entity, arguments) })
})
