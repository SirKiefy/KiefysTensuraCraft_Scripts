// priority: 100
//
// kubejs/startup_scripts/skills.js
// ---------------------------------
// Custom TensuraJS skills that bridge Tensura magicule mechanics into
// Legendary Survival Overhaul (LSO) body systems. See Claude.md §1.
//
//   kubejs:thermoregulation   (Extra Skill)      - heat / cold magicule flow control
//   kubejs:purification       (Common Skill)     - spiritual digestion, thirst & parasites
//   kubejs:adaptive_carapace  (Intrinsic Skill)  - per-limb magicule armament
//
// Skill tiers map onto Tensura mastery: an un-mastered skill is Tier 1,
// a mastered skill (instance.isMastered(entity)) is Tier 2 / "True" tier.
//
// Every cross-mod Java class is resolved lazily and null-checked, so a
// missing or renamed LSO / Tensura class degrades to a no-op with one
// warning instead of crashing the server (Claude.md §4 NBT Safety).

// ---------------------------------------------------------------------
// 0. Registry / API wiring (the only block that should ever need edits)
// ---------------------------------------------------------------------
// TensuraJS exposes the ManasCore skill registry to StartupEvents.registry.
// If a ProbeJS dump shows TensuraJS aliasing it under another id
// (e.g. 'tensura:skill'), change SKILL_REGISTRY only.
const SKILL_REGISTRY = 'manascore:skills'

// Fully-qualified classes used for the LSO / Tensura bridge.
const JAVA = {
  temperatureUtil: 'sfiomn.legendarysurvivaloverhaul.api.temperature.TemperatureUtil',
  thirstUtil: 'sfiomn.legendarysurvivaloverhaul.api.thirst.ThirstUtil',
  skillHelper: 'com.github.manasmods.tensura.ability.SkillHelper'
}

// LSO ids referenced by the skills.
const LSO = {
  ns: 'legendarysurvivaloverhaul',
  effects: {
    heatResistance: 'legendarysurvivaloverhaul:heat_resistance',
    coldResistance: 'legendarysurvivaloverhaul:cold_resistance',
    heatStroke: 'legendarysurvivaloverhaul:heat_stroke',
    frostbite: 'legendarysurvivaloverhaul:frostbite',
    parasites: 'legendarysurvivaloverhaul:parasites'
  },
  damage: {
    hyperthermia: 'hyperthermia',
    hypothermia: 'hypothermia'
  },
  // LSO body temperature runs 0..25; 12 is the optimal "50% baseline".
  temperature: { min: 0, optimal: 12, max: 25 },
  // LSO thirst runs 0..20 like vanilla hunger.
  thirst: { max: 20 }
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

// LSO exposes its API through static `internal` singletons.
function lsoTemperature() {
  const c = loadJava('temperatureUtil')
  return c ? c.internal : null
}
function lsoThirst() {
  const c = loadJava('thirstUtil')
  return c ? c.internal : null
}

function isServerPlayer(entity) {
  return entity && entity.isPlayer() && !entity.level.isClientSide()
}

// Tier helpers: 1 = base, 2 = mastered.
function tierOf(instance, entity) {
  return instance.isMastered(entity) ? 2 : 1
}

function drainMagicule(entity, amount) {
  const helper = loadJava('skillHelper')
  if (!helper) return false
  try {
    helper.drainMagicule(entity, amount)
    return true
  } catch (e) {
    console.warn(`[skills.js] drainMagicule failed: ${e}`)
    return false
  }
}

function outOfMagicule(entity, instance) {
  const helper = loadJava('skillHelper')
  if (!helper) return false
  try {
    return helper.outOfMagicule(entity, instance)
  } catch (e) {
    return false
  }
}

function applyEffect(entity, effectId, duration, amplifier) {
  entity.potionEffects.add(effectId, duration, amplifier, false, false)
}

function removeEffect(entity, effectId) {
  if (entity.potionEffects.isActive(effectId)) entity.removeEffect(effectId)
}

// Award a mastery point every `every` ticks the skill is active.
function tickMastery(skill, instance, entity, every) {
  const tag = instance.getOrCreateTag()
  const t = tag.getInt('activatedTimes')
  if (t % every === 0) skill.addMasteryPoint(instance, entity)
  tag.putInt('activatedTimes', t + 1)
}

// "Extreme biome" = Nether, or a biome whose base temperature is icy / scorching.
function inExtremeBiome(entity) {
  const level = entity.level
  if (dimensionId(level) == 'minecraft:the_nether') return true
  const biome = level.getBiome(entity.blockPosition())
  if (!biome) return false
  const temp = biome.value().getBaseTemperature()
  return temp <= 0.15 || temp >= 1.5
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

// Damage that no physical coating can stop (vanilla msgIds of #bypasses_armor
// minus fall / falling blocks, which the carapace does absorb).
const NON_PHYSICAL_DAMAGE = [
  'drown', 'starve', 'wither', 'outOfWorld', 'genericKill', 'magic', 'indirectMagic',
  'dryout', 'freeze', 'onFire', 'inFire', 'lava', 'hotFloor', 'sonic_boom', 'cramming',
  'inWall', 'dragonBreath', 'thorns', 'dehydration'
]

// ---------------------------------------------------------------------
// 2. Skill registration
// ---------------------------------------------------------------------
StartupEvents.registry(SKILL_REGISTRY, event => {

  // -------------------------------------------------------------------
  // Thermoregulation (Extra Skill)
  //   Tier 1 - Thermal Resistance: halves hyper/hypothermia tick damage,
  //            neutralises biome temperature penalties (LSO resistance effects).
  //   Tier 2 - Absolute Thermal Control: immune to LSO temperature extremes,
  //            body temperature locked at optimal, temperature debuffs removed.
  //   Cost   - 2 magicules per 100 ticks while in an extreme biome.
  // -------------------------------------------------------------------
  const THERMO_DRAIN = 2.0
  const THERMO_DRAIN_INTERVAL = 100

  event.create('kubejs:thermoregulation', 'extra')
    .icon('kubejs:textures/skill/extra/thermoregulation.png')
    .learningCost(120.0)
    .meetEPRequirement((player, ep) => ep >= 20000.0)
    .canBeToggled((instance, entity) => true)
    .canTick((instance, entity) => instance.isToggled())
    .onToggleOff((instance, entity) => {
      removeEffect(entity, LSO.effects.heatResistance)
      removeEffect(entity, LSO.effects.coldResistance)
    })
    .onTick((instance, entity) => {
      if (!isServerPlayer(entity)) return
      const player = entity
      if (player.age % 20 != 0) return // throttle: once a second

      const tier = tierOf(instance, entity)

      // Tier 1: LSO's own resistance effects offset ambient heat / cold.
      applyEffect(player, LSO.effects.heatResistance, 60, tier - 1)
      applyEffect(player, LSO.effects.coldResistance, 60, tier - 1)

      // Tier 2: hard-lock body temperature and strip temperature debuffs.
      if (tier >= 2) {
        const tempApi = lsoTemperature()
        if (tempApi) {
          try {
            if (tempApi.getTemperatureLevel(player) != LSO.temperature.optimal) {
              tempApi.setTemperatureLevel(player, LSO.temperature.optimal)
            }
          } catch (e) {
            console.warn(`[skills.js] Thermoregulation temperature lock failed: ${e}`)
          }
        }
        removeEffect(player, LSO.effects.heatStroke)
        removeEffect(player, LSO.effects.frostbite)
        removeEffect(player, 'minecraft:slowness')
      }

      // Passive drain only while exposed to extreme biomes.
      if (player.age % THERMO_DRAIN_INTERVAL == 0 && inExtremeBiome(player)) {
        drainMagicule(player, THERMO_DRAIN)
        if (outOfMagicule(player, instance)) {
          player.tell(Text.red('Thermoregulation toggled off: not enough magicules.'))
          instance.setToggled(false)
          instance.onToggleOff(player)
          instance.markDirty()
          return
        }
      }

      tickMastery(instance.getSkill(), instance, entity, 30)
    })
    // Runs before LSO resolves temperature damage.
    .onBeingDamaged((instance, entity, damageEvent) => {
      if (!instance.isToggled()) return
      const id = damageTypeId(damageEvent.getSource())
      if (id != LSO.damage.hyperthermia && id != LSO.damage.hypothermia) return
      if (tierOf(instance, entity) >= 2) {
        damageEvent.setCanceled(true)          // Absolute Thermal Control: immune
      } else {
        damageEvent.setAmount(damageEvent.getAmount() * 0.5) // Thermal Resistance: halve
      }
    })

  // -------------------------------------------------------------------
  // Purification & Sustenance (Common Skill)
  //   - Cleanses LSO parasite / infection effects from untreated water.
  //   - Thirst depletes 50% slower per tier (tier 1: half of lost points
  //     are refunded; tier 2: every lost point is refunded, see below).
  //   - Tier 2 (True Sustenance): converts magicules directly into hydration,
  //     removing the need to drink.
  // -------------------------------------------------------------------
  const SUSTENANCE_COST_PER_POINT = 5.0

  event.create('kubejs:purification', 'common')
    .icon('kubejs:textures/skill/common/purification.png')
    .learningCost(60.0)
    .meetEPRequirement((player, ep) => ep >= 5000.0)
    .canBeToggled((instance, entity) => true)
    .canTick((instance, entity) => instance.isToggled())
    .onToggleOn((instance, entity) => {
      const thirstApi = lsoThirst()
      if (thirstApi && isServerPlayer(entity)) {
        instance.getOrCreateTag().putInt('lastThirst', thirstApi.getThirstLevel(entity))
      }
    })
    .onTick((instance, entity) => {
      if (!isServerPlayer(entity)) return
      const player = entity
      if (player.age % 20 != 0) return

      const tier = tierOf(instance, entity)

      // Spiritual digestion: parasites / stomach sickness never take hold.
      removeEffect(player, LSO.effects.parasites)

      const thirstApi = lsoThirst()
      if (thirstApi) {
        try {
          const tag = instance.getOrCreateTag()
          const current = thirstApi.getThirstLevel(player)
          const last = tag.contains('lastThirst') ? tag.getInt('lastThirst') : current

          if (current < last) {
            // Thirst dropped since last check. Refund half the loss at tier 1
            // (probabilistic per point => 50% slower on average), all of it at tier 2.
            const lost = last - current
            let refund = 0
            for (let i = 0; i < lost; i++) {
              if (tier >= 2 || Math.random() < 0.5) refund++
            }
            if (tier >= 2) {
              // True Sustenance: hydration is paid for with magicules instead.
              if (!outOfMagicule(player, instance)) {
                drainMagicule(player, refund * SUSTENANCE_COST_PER_POINT)
              } else {
                refund = 0
              }
            }
            if (refund > 0) thirstApi.addThirstLevel(player, refund)
          }

          // True Sustenance also tops the bar back up from magicule reserves.
          if (tier >= 2) {
            const now = thirstApi.getThirstLevel(player)
            if (now < LSO.thirst.max && !outOfMagicule(player, instance)) {
              drainMagicule(player, SUSTENANCE_COST_PER_POINT)
              thirstApi.addThirstLevel(player, 1)
            }
          }

          tag.putInt('lastThirst', thirstApi.getThirstLevel(player))
        } catch (e) {
          console.warn(`[skills.js] Purification thirst bridge failed: ${e}`)
        }
      }

      tickMastery(instance.getSkill(), instance, entity, 60)
    })

  // -------------------------------------------------------------------
  // Adaptive Carapace / Magic Armament (Intrinsic Passive)
  //   - Per-limb damage reduction applied before LSO locational damage.
  //   - Flat resistance to blunt hits from giant mobs so they fall under
  //     LSO's fracture threshold.
  // -------------------------------------------------------------------
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

  event.create('kubejs:adaptive_carapace', 'intrinsic')
    .icon('kubejs:textures/skill/intrinsic/adaptive_carapace.png')
    .canBeToggled((instance, entity) => true)
    .canTick((instance, entity) => instance.isToggled())
    .onTick((instance, entity) => {
      if (!isServerPlayer(entity)) return
      if (entity.age % 20 != 0) return
      tickMastery(instance.getSkill(), instance, entity, 120)
    })
    .onBeingDamaged((instance, entity, damageEvent) => {
      if (!instance.isToggled()) return
      const source = damageEvent.getSource()
      const id = damageTypeId(source)
      // Only physical hits get armament; environmental / thermal damage is Thermoregulation's job.
      if (id == LSO.damage.hyperthermia || id == LSO.damage.hypothermia) return
      if (NON_PHYSICAL_DAMAGE.indexOf(id) >= 0) return

      let amount = damageEvent.getAmount()
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

      damageEvent.setAmount(amount)
      instance.getOrCreateTag().putString('lastLimb', limb)
    })
})
