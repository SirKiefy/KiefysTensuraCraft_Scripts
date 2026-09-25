// priority: 100
//
// kubejs/server_scripts/tensura_lso_bridge.js
// -------------------------------------------
// Real-time bridge between Tensura skills and Legendary Survival Overhaul
// (LSO) body systems. See Claude.md §2.
//
//   A. Locational healing   - Self / Ultra-Speed / Infinite Regeneration heal
//                             LSO limbs directly (LSO bypasses player.heal()).
//   B. Temperature clamping - heat / cold resistance skills apply LSO's own
//                             immunity effects and clamp body temperature
//                             away from heat stroke / frostbite.
//   C. Thirst & sustenance  - Purification / Abnormal Condition Resistance
//                             cleanse LSO's dirty-water debuff.
//
// Limb pools already scale with Tensura max health: LSO's default
// "Body Part Health Mode = DYNAMIC" (config/legendarysurvivaloverhaul,
// section body-parts-health) recomputes every limb's max health from the
// player's stable max health every 20 ticks, so no script is needed for §D
// of the previous revision. Keep that config value on DYNAMIC.
//
// Player checks run every CHECK_INTERVAL ticks (never every tick), and every
// capability / persistent-data access is null-checked so a missing mod class
// or a player mid-respawn degrades to a no-op instead of a crash (§4).
//
// Verification status (see docs/SESSION_HANDOFF.md for sources):
//   VERIFIED   ManasCore 1.21.1 SkillAPI / Skills / ManasSkillInstance,
//              LSO 2.3.x BodyDamageUtil / BodyPartEnum / TemperatureEnum /
//              effect ids / damage ids, KubeJS 2101 events and bindings.
//   UNVERIFIED Tensura skill registry ids in SKILLS (closed source; the wiki
//              is unreachable from the dev environment) and the LSO 2.4
//              NeoForge capability accessor (CapabilityUtil is the 2.3 name).

// ---------------------------------------------------------------------
// 0. Configuration
// ---------------------------------------------------------------------
const CHECK_INTERVAL = 20          // ticks between per-player checks
const SELF_REGEN_INTERVAL = 60     // Self-Regeneration cadence
const ULTRA_REGEN_HEAL = 2.0       // HP spread across damaged limbs per check
const SELF_REGEN_HEAL = 1.0        // HP to the most damaged limb per cadence
const EFFECT_REFRESH_TICKS = 60    // duration of the LSO effects we re-apply

// Tensura / custom skill ids that drive each binding. Unknown ids are
// skipped silently, so extra candidates are harmless.
// VERIFIED in-game (1.21.1, /tensura edit ability grant autocomplete):
//   tensura:self_regeneration, tensura:ultraspeed_regeneration,
//   tensura:infinite_regeneration, tensura:heat_resistance,
//   tensura:cold_resistance, tensura:flame_attack_resistance,
//   tensura:thermal_fluctuation_resistance, tensura:abnormal_condition_resistance,
//   tensura:poison_resistance, tensura:water_attack_resistance.
// The *_nullification ids below are still guesses (not shown by the
// "resist" filter); check them with /tensuralso skills null.
const SKILLS = {
  selfRegen: ['tensura:self_regeneration'],
  ultraRegen: ['tensura:ultraspeed_regeneration'],
  infiniteRegen: ['tensura:infinite_regeneration'],
  heat: [
    'kubejs:thermoregulation',
    'tensura:heat_resistance',
    'tensura:flame_attack_resistance',
    'tensura:thermal_fluctuation_resistance',
    'tensura:heat_nullification',
    'tensura:flame_attack_nullification',
    'tensura:thermal_fluctuation_nullification'
  ],
  cold: [
    'kubejs:thermoregulation',
    'tensura:cold_resistance',
    'tensura:thermal_fluctuation_resistance',
    'tensura:cold_nullification',
    'tensura:thermal_fluctuation_nullification'
  ],
  // Full thermal immunity: body temperature locked at the optimal baseline.
  thermalLock: [
    'tensura:thermal_fluctuation_nullification',
    'tensura:multilayer_barrier'
  ],
  purify: [
    'kubejs:purification',
    'tensura:abnormal_condition_resistance',
    'tensura:abnormal_condition_nullification',
    'tensura:poison_resistance',
    'tensura:poison_nullification'
  ]
}

// LSO effect ids (sfiomn.legendarysurvivaloverhaul.registry.MobEffectRegistry).
// LSO has no bleeding / fracture effects: a limb at 0 HP is "broken" and
// adds broken hearts; the limb maluses below are what a broken limb inflicts.
const LSO_EFFECTS = {
  thirst: 'legendarysurvivaloverhaul:thirst',                       // dirty-water debuff
  heatImmunity: 'legendarysurvivaloverhaul:heat_immunity',
  coldImmunity: 'legendarysurvivaloverhaul:cold_immunity',
  temperatureImmunity: 'legendarysurvivaloverhaul:temperature_immunity',
  heatStroke: 'legendarysurvivaloverhaul:heat_stroke',
  frostbite: 'legendarysurvivaloverhaul:frostbite',
  limbMalus: [
    'legendarysurvivaloverhaul:hard_falling',
    'legendarysurvivaloverhaul:vulnerability',
    'legendarysurvivaloverhaul:headache'
  ]
}

// LSO body temperature scale (TemperatureEnum): FROSTBITE 0-10, COLD 10-16,
// NORMAL 16-24, HOT 24-30, HEAT_STROKE 30-40. Bounds are read from the enum
// when available; these are the fallbacks.
const TEMP = {
  optimal: 20.0,
  heatStrokeFrom: 30,   // HEAT_STROKE lower bound
  frostbiteTo: 10       // FROSTBITE upper bound
}

// Java classes, listed as candidates so a package move between mod versions
// only needs an extra entry here. First entry = verified 1.21.1 name.
const JAVA_CANDIDATES = {
  skillApi: [
    'io.github.manasmods.manascore.skill.api.SkillAPI',
    'com.github.manasmods.manascore.api.skills.SkillAPI'
  ],
  bodyDamageUtil: ['sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyDamageUtil'],
  bodyPartEnum: ['sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyPartEnum'],
  temperatureEnum: ['sfiomn.legendarysurvivaloverhaul.api.temperature.TemperatureEnum'],
  capabilityUtil: ['sfiomn.legendarysurvivaloverhaul.util.CapabilityUtil'],
  resourceLocation: ['net.minecraft.resources.ResourceLocation']
}

// ---------------------------------------------------------------------
// 1. Java access helpers (lazy, cached, never throwing)
// ---------------------------------------------------------------------
const _classes = {}
function loadFirst(key) {
  if (_classes[key] !== undefined) return _classes[key]
  var found = null
  var candidates = JAVA_CANDIDATES[key] || []
  for (var i = 0; i < candidates.length && !found; i++) {
    try {
      found = Java.loadClass(candidates[i])
    } catch (e) {
      // try the next candidate
    }
  }
  if (!found) console.warn(`[tensura_lso_bridge] None of ${candidates.join(', ')} could be loaded; '${key}' bridge disabled.`)
  _classes[key] = found
  return found
}

var _rlCache = {}
function toResourceLocation(id) {
  if (_rlCache[id] !== undefined) return _rlCache[id]
  var rl = null
  var clazz = loadFirst('resourceLocation')
  if (clazz) {
    try {
      rl = typeof clazz.parse === 'function' ? clazz.parse(id) : clazz.tryParse(id)
    } catch (e) {
      rl = null
    }
  }
  _rlCache[id] = rl
  return rl
}

// Optional<T> or nullable T -> T or null.
function unwrap(value) {
  if (value && typeof value.isPresent === 'function') return value.isPresent() ? value.get() : null
  return value || null
}

// ---------------------------------------------------------------------
// 2. Tensura skill lookup
// ---------------------------------------------------------------------
// Returns the ManasSkillInstance if the player has any of `ids` learned and
// active (toggled on, or not toggleable), else null.
//   SkillAPI.getSkillsFrom(entity)        -> Skills (never null, may be EMPTY)
//   Skills.getSkill(ResourceLocation)     -> Optional<ManasSkillInstance>
function activeSkill(player, ids) {
  var api = loadFirst('skillApi')
  if (!api) return null
  var storage = null
  try {
    storage = api.getSkillsFrom(player)
  } catch (e) {
    return null
  }
  if (!storage) return null

  for (var i = 0; i < ids.length; i++) {
    var rl = toResourceLocation(ids[i])
    if (!rl) continue
    var instance = null
    try {
      instance = unwrap(storage.getSkill(rl))
    } catch (e) {
      instance = null
    }
    if (!instance) continue
    var toggleable = false
    try { toggleable = instance.canBeToggled(player) } catch (e) { toggleable = false }
    if (!toggleable || instance.isToggled()) return instance
  }
  return null
}

// ---------------------------------------------------------------------
// 3. LSO adapters
// ---------------------------------------------------------------------
let _bodyParts = null
function bodyParts() {
  if (_bodyParts) return _bodyParts
  var e = loadFirst('bodyPartEnum')
  if (!e) return []
  try {
    _bodyParts = e.values()
  } catch (err) {
    _bodyParts = []
  }
  return _bodyParts
}

// BodyDamageUtil (static API):
//   getMaxHealth(player, part) -> float
//   getHealthRatio(player, part) -> float   (health / max)
//   healBodyPart(player, part, float)
function limbMaxHealth(body, player, part) {
  try { return Number(body.getMaxHealth(player, part)) } catch (e) { return NaN }
}
function limbHealth(body, player, part) {
  var max = limbMaxHealth(body, player, part)
  if (isNaN(max)) return NaN
  try { return Number(body.getHealthRatio(player, part)) * max } catch (e) { return NaN }
}
function healLimb(body, player, part, amount) {
  if (!(amount > 0)) return
  try {
    body.healBodyPart(player, part, amount)
  } catch (e) {
    console.warn(`[tensura_lso_bridge] BodyDamageUtil.healBodyPart failed: ${e}`)
  }
}

// Collects { part, health, max } for every limb below max health.
function damagedLimbs(body, player) {
  var out = []
  var parts = bodyParts()
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i]
    var max = limbMaxHealth(body, player, part)
    var health = limbHealth(body, player, part)
    if (isNaN(health) || isNaN(max)) continue
    if (health < max - 0.001) out.push({ part: part, health: health, max: max })
  }
  return out
}

// Effect id -> registered? (cached). Unknown ids are never applied.
const _effectKnown = {}
function effectExists(id) {
  if (_effectKnown[id] !== undefined) return _effectKnown[id]
  var ok = true
  try {
    ok = Registry.of('minecraft:mob_effect').contains(id)
  } catch (e) {
    ok = true // registry lookup unavailable; trust the id and guard uses
  }
  if (!ok) console.warn(`[tensura_lso_bridge] Effect ${id} is not registered; skipping it.`)
  _effectKnown[id] = ok
  return ok
}

function clearEffect(player, id) {
  if (!effectExists(id)) return
  try {
    if (player.potionEffects.isActive(id)) player.removeEffect(id)
  } catch (e) {
    // effect id not registered
  }
}

function applyEffect(player, id, duration, amplifier) {
  if (!effectExists(id)) return
  try {
    player.potionEffects.add(id, duration, amplifier, false, false)
  } catch (e) {
    // effect id not registered
  }
}

// Temperature bounds from LSO's enum, falling back to TEMP constants.
let _bounds = null
function tempBounds() {
  if (_bounds) return _bounds
  _bounds = { max: TEMP.heatStrokeFrom - 1, min: TEMP.frostbiteTo + 1, optimal: TEMP.optimal }
  var e = loadFirst('temperatureEnum')
  if (e) {
    try {
      _bounds.max = Number(e.HEAT_STROKE.getLowerBound()) - 1
      _bounds.min = Number(e.FROSTBITE.getUpperBound()) + 1
      _bounds.optimal = Number(e.NORMAL.getMiddle())
    } catch (err) {
      // keep fallbacks
    }
  }
  return _bounds
}

// LSO 2.3 exposes the temperature capability through CapabilityUtil; the
// 2.4 NeoForge build may differ, so this is best-effort on top of the
// immunity effects above.
function tempCapability(player) {
  var util = loadFirst('capabilityUtil')
  if (!util) return null
  try {
    return util.getTempCapability(player)
  } catch (e) {
    return null
  }
}

// ---------------------------------------------------------------------
// 4. Per-player bindings
// ---------------------------------------------------------------------
function handleRegeneration(player) {
  var infinite = activeSkill(player, SKILLS.infiniteRegen)
  var ultra = infinite ? null : activeSkill(player, SKILLS.ultraRegen)
  var self = (infinite || ultra) ? null : activeSkill(player, SKILLS.selfRegen)
  if (!infinite && !ultra && !self) return

  var body = loadFirst('bodyDamageUtil')
  if (!body) return

  // Infinite Regeneration: restore every limb and shed the limb maluses.
  if (infinite) {
    var limbs = damagedLimbs(body, player)
    for (var i = 0; i < limbs.length; i++) {
      healLimb(body, player, limbs[i].part, limbs[i].max - limbs[i].health)
    }
    for (var i = 0; i < LSO_EFFECTS.limbMalus.length; i++) clearEffect(player, LSO_EFFECTS.limbMalus[i])
    return
  }

  // Ultra-Speed Regeneration: 2 HP shared across damaged limbs every check.
  if (ultra) {
    var limbs = damagedLimbs(body, player)
    if (limbs.length === 0) return
    var share = ULTRA_REGEN_HEAL / limbs.length
    for (var i = 0; i < limbs.length; i++) {
      healLimb(body, player, limbs[i].part, Math.min(share, limbs[i].max - limbs[i].health))
    }
    return
  }

  // Self-Regeneration: 1 HP to the most damaged limb every 60 ticks.
  if (self && player.tickCount % SELF_REGEN_INTERVAL === 0) {
    var limbs = damagedLimbs(body, player)
    if (limbs.length === 0) return
    var worst = limbs[0]
    for (var i = 1; i < limbs.length; i++) {
      if (limbs[i].health / limbs[i].max < worst.health / worst.max) worst = limbs[i]
    }
    healLimb(body, player, worst.part, Math.min(SELF_REGEN_HEAL, worst.max - worst.health))
  }
}

function handleTemperature(player) {
  var lock = activeSkill(player, SKILLS.thermalLock)
  var heat = lock ? null : activeSkill(player, SKILLS.heat)
  var cold = lock ? null : activeSkill(player, SKILLS.cold)
  if (!lock && !heat && !cold) return

  // Primary path: LSO's own immunity effects (no capability access needed).
  if (lock) {
    applyEffect(player, LSO_EFFECTS.temperatureImmunity, EFFECT_REFRESH_TICKS, 0)
    clearEffect(player, LSO_EFFECTS.heatStroke)
    clearEffect(player, LSO_EFFECTS.frostbite)
  } else {
    if (heat) {
      applyEffect(player, LSO_EFFECTS.heatImmunity, EFFECT_REFRESH_TICKS, 0)
      clearEffect(player, LSO_EFFECTS.heatStroke)
    }
    if (cold) {
      applyEffect(player, LSO_EFFECTS.coldImmunity, EFFECT_REFRESH_TICKS, 0)
      clearEffect(player, LSO_EFFECTS.frostbite)
    }
  }

  // Secondary path: clamp the stored body temperature when the capability is reachable.
  var cap = tempCapability(player)
  if (!cap) return
  var level
  try { level = Number(cap.getTemperatureLevel()) } catch (e) { return }
  if (isNaN(level)) return

  var bounds = tempBounds()
  var target = level
  if (lock) {
    target = bounds.optimal
  } else {
    if (heat && level > bounds.max) target = bounds.max
    if (cold && level < bounds.min) target = bounds.min
  }
  if (Math.abs(target - level) > 0.01) {
    try { cap.setTemperatureLevel(target) } catch (e) { /* capability API differs */ }
  }
}

function handlePurification(player) {
  if (!activeSkill(player, SKILLS.purify)) return
  clearEffect(player, LSO_EFFECTS.thirst)
}

// Shared with tensura_lso_debug.js (/tensuralso status). Harmless if unused.
global.tensuraLso = {
  SKILLS: SKILLS,
  LSO_EFFECTS: LSO_EFFECTS,
  activeSkill: activeSkill,
  loadFirst: loadFirst,
  bodyParts: bodyParts,
  limbHealth: limbHealth,
  limbMaxHealth: limbMaxHealth,
  tempBounds: tempBounds,
  tempCapability: tempCapability,
  tickErrors: function () { return _tickErrors },
  lastTickError: function () { return _lastTickError }
}

// ---------------------------------------------------------------------
// 5. Events
// ---------------------------------------------------------------------
var _tickErrors = 0
var _lastTickError = ''

ServerEvents.loaded(event => {
  var keys = Object.keys(JAVA_CANDIDATES)
  var ok = []
  var missing = []
  for (var i = 0; i < keys.length; i++) {
    if (loadFirst(keys[i])) ok.push(keys[i])
    else missing.push(keys[i])
  }
  console.info(`[tensura_lso_bridge] loaded. classes OK: ${ok.join(', ') || 'none'}; MISSING: ${missing.join(', ') || 'none'}; body parts: ${bodyParts().length}`)
})

PlayerEvents.tick(event => {
  var player = event.player
  if (!player || player.level.isClientSide()) return
  if (player.tickCount % CHECK_INTERVAL !== 0) return
  if (!player.isAlive()) return

  // Persistent data is used as a per-player scratch space; guard it too.
  var data = player.persistentData
  if (!data) return

  try {
    handleRegeneration(player)
    handleTemperature(player)
    handlePurification(player)
    data.putLong('tensuraLsoBridgeLastCheck', player.tickCount)
  } catch (e) {
    _tickErrors++
    _lastTickError = String(e)
    if (_tickErrors <= 5 || _tickErrors % 600 === 0) console.error(`[tensura_lso_bridge] tick handler failed for ${player.username} (${_tickErrors}x): ${e}`)
  }
})

// Drinking: LSO applies the thirst debuff when a drink finishes. Cleanse on
// the eat event as well; the 20-tick check above catches anything that lands
// after this handler (LSO water-block drinking never raises an item event).
ItemEvents.foodEaten(event => {
  var entity = event.entity
  if (!entity || !entity.isPlayer() || entity.level.isClientSide()) return
  if (!activeSkill(entity, SKILLS.purify)) return
  clearEffect(entity, LSO_EFFECTS.thirst)
})
