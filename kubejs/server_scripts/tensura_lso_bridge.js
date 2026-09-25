// priority: 100
//
// kubejs/server_scripts/tensura_lso_bridge.js
// -------------------------------------------
// Real-time bridge between Tensura skills and Legendary Survival Overhaul
// (LSO) body systems. See Claude.md §2.
//
//   A. Locational healing   - Self / Ultra-Speed / Infinite Regeneration heal
//                             LSO limbs directly (LSO bypasses player.heal()).
//   B. Temperature clamping - heat / cold resistance skills clamp LSO body
//                             temperature away from hyperthermia / freezing.
//   C. Thirst & sustenance  - Purification / Abnormal Condition Resistance
//                             cleanse water-borne parasites on drinking.
//
// Player checks run every CHECK_INTERVAL ticks (never every tick), and every
// capability / persistent-data access is null-checked so a missing mod class
// or a player mid-respawn degrades to a no-op instead of a crash (§4).

// ---------------------------------------------------------------------
// 0. Configuration
// ---------------------------------------------------------------------
const CHECK_INTERVAL = 20          // ticks between per-player checks
const SELF_REGEN_INTERVAL = 60     // Self-Regeneration cadence
const ULTRA_REGEN_HEAL = 2.0       // HP spread across damaged limbs per check
const SELF_REGEN_HEAL = 1.0        // HP to the most damaged limb per cadence
const BLEED_CUT_FACTOR = 0.5       // Ultra-Speed: bleeding timer multiplier

// Tensura / custom skill ids that drive each binding. Unknown ids are
// skipped silently, so extra candidates are harmless.
const SKILLS = {
  selfRegen: ['tensura:self_regeneration'],
  ultraRegen: ['tensura:ultraspeed_regeneration'],
  infiniteRegen: ['tensura:infinite_regeneration'],
  heat: [
    'kubejs:thermoregulation',
    'tensura:flame_attack_resistance',
    'tensura:flame_attack_nullification',
    'tensura:heat_resistance',
    'tensura:thermal_fluctuation_resistance',
    'tensura:thermal_fluctuation_nullification'
  ],
  cold: [
    'kubejs:thermoregulation',
    'tensura:cold_resistance',
    'tensura:thermal_fluctuation_resistance',
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

// LSO effect ids. Each entry lists candidates; the first that exists is used.
const LSO_EFFECTS = {
  parasites: ['legendarysurvivaloverhaul:parasites'],
  bleeding: ['legendarysurvivaloverhaul:bleeding', 'legendarysurvivaloverhaul:bleed'],
  fracture: ['legendarysurvivaloverhaul:fracture', 'legendarysurvivaloverhaul:fractured', 'legendarysurvivaloverhaul:broken_bone']
}

// LSO body temperature is an integer scale (0..25 by default, 12 optimal).
// Bounds are read from LSO's TemperatureEnum when available; these are the
// fallbacks if that class cannot be resolved.
const TEMP = {
  optimal: 12,
  hyperthermiaFrom: 20,   // first HEAT_STROKE level
  freezingTo: 5           // last FROSTBITE level
}

// Java classes, listed as candidates so a package move between mod versions
// only needs an extra entry here.
const JAVA_CANDIDATES = {
  skillApi: [
    'com.github.manasmods.manascore.api.skills.SkillAPI',
    'com.github.manasmods.manascore.api.skill.SkillAPI',
    'io.github.manasmods.manascore.skill.api.SkillAPI'
  ],
  bodyDamageUtil: ['sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyDamageUtil'],
  bodyPartEnum: ['sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyPartEnum'],
  temperatureUtil: ['sfiomn.legendarysurvivaloverhaul.api.temperature.TemperatureUtil'],
  temperatureEnum: ['sfiomn.legendarysurvivaloverhaul.api.temperature.TemperatureEnum']
}

// ---------------------------------------------------------------------
// 1. Java access helpers (lazy, cached, never throwing)
// ---------------------------------------------------------------------
const _classes = {}
function loadFirst(key) {
  if (_classes[key] !== undefined) return _classes[key]
  let found = null
  const candidates = JAVA_CANDIDATES[key] || []
  for (let i = 0; i < candidates.length && !found; i++) {
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

// Invoke a Java method by name with up to three positional arguments.
function invoke(target, name, args) {
  switch (args.length) {
    case 0: return target[name]()
    case 1: return target[name](args[0])
    case 2: return target[name](args[0], args[1])
    default: return target[name](args[0], args[1], args[2])
  }
}

// Call the first method name on `target` that exists; remembers which one worked.
const _methodCache = {}
function callFirst(cacheKey, target, names, args) {
  if (!target) return undefined
  const known = _methodCache[cacheKey]
  if (known) return invoke(target, known, args)
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    if (typeof target[name] !== 'function') continue
    try {
      const result = invoke(target, name, args)
      _methodCache[cacheKey] = name
      return result
    } catch (e) {
      // wrong overload or missing method; try the next name
    }
  }
  return undefined
}

let _resourceLocation
function toResourceLocation(id) {
  if (_resourceLocation === undefined) {
    try {
      _resourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
    } catch (e) {
      _resourceLocation = null
    }
  }
  if (!_resourceLocation) return null
  return typeof _resourceLocation.parse === 'function' ? _resourceLocation.parse(id) : _resourceLocation.tryParse(id)
}

// ---------------------------------------------------------------------
// 2. Tensura skill lookup
// ---------------------------------------------------------------------
const _skillCache = {}
function resolveSkill(id) {
  if (_skillCache[id] !== undefined) return _skillCache[id]
  let skill = null
  const api = loadFirst('skillApi')
  if (api) {
    try {
      const registry = api.getSkillRegistry()
      const rl = toResourceLocation(id)
      const value = rl ? registry.get(rl) : null
      // 1.21 registries may hand back an Optional instead of a nullable value.
      skill = value && typeof value.isPresent === 'function' ? (value.isPresent() ? value.get() : null) : (value || null)
    } catch (e) {
      skill = null
    }
  }
  _skillCache[id] = skill
  return skill
}

// Returns the ManasSkillInstance if the player has any of `ids` learned and
// active (toggled on, or not toggleable), else null.
function activeSkill(player, ids) {
  const api = loadFirst('skillApi')
  if (!api) return null
  let storage = null
  try {
    storage = api.getSkillsFrom(player)
  } catch (e) {
    return null
  }
  if (!storage) return null

  for (let i = 0; i < ids.length; i++) {
    const skill = resolveSkill(ids[i])
    if (!skill) continue
    let instance = null
    try {
      const opt = storage.getSkill(skill)
      instance = opt && typeof opt.isPresent === 'function' ? (opt.isPresent() ? opt.get() : null) : (opt || null)
    } catch (e) {
      instance = null
    }
    if (!instance) continue
    let toggleable = false
    try { toggleable = skill.canBeToggled(instance, player) } catch (e) { toggleable = false }
    if (!toggleable || instance.isToggled()) return instance
  }
  return null
}

// ---------------------------------------------------------------------
// 3. LSO adapters
// ---------------------------------------------------------------------
function lsoBody() {
  const c = loadFirst('bodyDamageUtil')
  return c ? c.internal : null
}
function lsoTemp() {
  const c = loadFirst('temperatureUtil')
  return c ? c.internal : null
}

let _bodyParts = null
function bodyParts() {
  if (_bodyParts) return _bodyParts
  const e = loadFirst('bodyPartEnum')
  if (!e) return []
  try {
    _bodyParts = e.values()
  } catch (err) {
    _bodyParts = []
  }
  return _bodyParts
}

function limbHealth(body, player, part) {
  const v = callFirst('limbHealth', body, ['getBodyPartHealth', 'getHealth'], [player, part])
  return typeof v === 'number' ? v : Number(v)
}
function limbMaxHealth(body, player, part) {
  const v = callFirst('limbMax', body, ['getBodyPartMaxHealth', 'getMaxBodyPartHealth', 'getMaxHealth'], [player, part])
  return typeof v === 'number' ? v : Number(v)
}
function healLimb(body, player, part, amount) {
  if (!(amount > 0)) return
  const r = callFirst('limbHeal', body, ['healBodyPartByPlayer', 'healBodyPart', 'addBodyPartHealth'], [player, part, amount])
  if (r === undefined && !_methodCache['limbHeal']) {
    // No heal method matched: fall back to a clamped set.
    const cur = limbHealth(body, player, part)
    const max = limbMaxHealth(body, player, part)
    if (!isNaN(cur) && !isNaN(max)) {
      callFirst('limbSet', body, ['setBodyPartHealth'], [player, part, Math.min(max, cur + amount)])
    }
  }
}

// Collects { part, health, max } for every limb below max health.
function damagedLimbs(body, player) {
  const out = []
  const parts = bodyParts()
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const health = limbHealth(body, player, part)
    const max = limbMaxHealth(body, player, part)
    if (isNaN(health) || isNaN(max)) continue
    if (health < max) out.push({ part: part, health: health, max: max })
  }
  return out
}

// Resolve the first effect id from a candidate list that is actually registered.
const _effectCache = {}
function effectId(key) {
  if (_effectCache[key] !== undefined) return _effectCache[key]
  let found = null
  const ids = LSO_EFFECTS[key] || []
  for (let i = 0; i < ids.length && !found; i++) {
    try {
      if (Registry.MOB_EFFECT ? Registry.MOB_EFFECT.containsKey(ids[i]) : true) found = ids[i]
    } catch (e) {
      found = ids[i] // registry lookup unavailable; trust the id and guard uses
    }
  }
  _effectCache[key] = found
  return found
}

function clearEffect(player, key) {
  const id = effectId(key)
  if (!id) return
  try {
    if (player.potionEffects.isActive(id)) player.removeEffect(id)
  } catch (e) {
    // effect id not registered
  }
}

function scaleEffectDuration(player, key, factor) {
  const id = effectId(key)
  if (!id) return
  try {
    if (!player.potionEffects.isActive(id)) return
    const inst = player.getEffect(id)
    if (!inst) return
    const newDuration = Math.floor(inst.getDuration() * factor)
    const amplifier = inst.getAmplifier()
    player.removeEffect(id)
    if (newDuration > 0) player.potionEffects.add(id, newDuration, amplifier, false, false)
  } catch (e) {
    // effect id not registered
  }
}

// Temperature bounds from LSO's enum, falling back to TEMP constants.
let _bounds = null
function tempBounds() {
  if (_bounds) return _bounds
  _bounds = { max: TEMP.hyperthermiaFrom - 1, min: TEMP.freezingTo + 1, optimal: TEMP.optimal }
  const e = loadFirst('temperatureEnum')
  if (e) {
    try {
      const heatLow = callFirst('heatLow', e.HEAT_STROKE, ['getLowerBound', 'getMin', 'getLower'], [])
      const frostHigh = callFirst('frostHigh', e.FROSTBITE, ['getUpperBound', 'getMax', 'getUpper'], [])
      if (typeof heatLow === 'number') _bounds.max = heatLow - 1
      if (typeof frostHigh === 'number') _bounds.min = frostHigh + 1
    } catch (err) {
      // keep fallbacks
    }
  }
  return _bounds
}

// ---------------------------------------------------------------------
// 4. Per-player bindings
// ---------------------------------------------------------------------
function handleRegeneration(player) {
  const infinite = activeSkill(player, SKILLS.infiniteRegen)
  const ultra = infinite ? null : activeSkill(player, SKILLS.ultraRegen)
  const self = (infinite || ultra) ? null : activeSkill(player, SKILLS.selfRegen)
  if (!infinite && !ultra && !self) return

  const body = lsoBody()
  if (!body) return

  // Infinite Regeneration: cleanse statuses and restore every limb.
  if (infinite) {
    clearEffect(player, 'bleeding')
    clearEffect(player, 'fracture')
    const limbs = damagedLimbs(body, player)
    for (let i = 0; i < limbs.length; i++) {
      healLimb(body, player, limbs[i].part, limbs[i].max - limbs[i].health)
    }
    return
  }

  // Ultra-Speed Regeneration: 2 HP shared across damaged limbs, bleeding halved.
  if (ultra) {
    scaleEffectDuration(player, 'bleeding', BLEED_CUT_FACTOR)
    const limbs = damagedLimbs(body, player)
    if (limbs.length === 0) return
    const share = ULTRA_REGEN_HEAL / limbs.length
    for (let i = 0; i < limbs.length; i++) {
      healLimb(body, player, limbs[i].part, Math.min(share, limbs[i].max - limbs[i].health))
    }
    return
  }

  // Self-Regeneration: 1 HP to the most damaged limb every 60 ticks.
  if (self && player.age % SELF_REGEN_INTERVAL === 0) {
    const limbs = damagedLimbs(body, player)
    if (limbs.length === 0) return
    let worst = limbs[0]
    for (let i = 1; i < limbs.length; i++) {
      if (limbs[i].health / limbs[i].max < worst.health / worst.max) worst = limbs[i]
    }
    healLimb(body, player, worst.part, Math.min(SELF_REGEN_HEAL, worst.max - worst.health))
  }
}

function handleTemperature(player) {
  const lock = activeSkill(player, SKILLS.thermalLock)
  const heat = lock ? null : activeSkill(player, SKILLS.heat)
  const cold = lock ? null : activeSkill(player, SKILLS.cold)
  if (!lock && !heat && !cold) return

  const temp = lsoTemp()
  if (!temp) return

  let level = callFirst('tempGet', temp, ['getTemperatureLevel', 'getTemperature'], [player])
  if (typeof level !== 'number') level = Number(level)
  if (isNaN(level)) return

  const bounds = tempBounds()
  let target = level
  if (lock) {
    target = bounds.optimal
  } else {
    if (heat && level > bounds.max) target = bounds.max
    if (cold && level < bounds.min) target = bounds.min
  }
  if (target !== level) {
    callFirst('tempSet', temp, ['setTemperatureLevel', 'setTemperature'], [player, target])
  }
}

function handlePurification(player) {
  if (!activeSkill(player, SKILLS.purify)) return
  clearEffect(player, 'parasites')
}

// ---------------------------------------------------------------------
// 5. Events
// ---------------------------------------------------------------------
PlayerEvents.tick(event => {
  const player = event.player
  if (!player || player.level.isClientSide()) return
  if (player.age % CHECK_INTERVAL !== 0) return
  if (!player.isAlive()) return

  // Persistent data is used as a per-player scratch space; guard it too.
  const data = player.persistentData
  if (!data) return

  try {
    handleRegeneration(player)
    handleTemperature(player)
    handlePurification(player)
    data.putLong('tensuraLsoBridgeLastCheck', player.age)
  } catch (e) {
    console.error(`[tensura_lso_bridge] tick handler failed for ${player.username}: ${e}`)
  }
})

// Drinking: LSO applies parasites when a drink finishes. Cleanse one tick
// later so the removal lands after LSO's own handler.
ItemEvents.foodEaten(event => {
  const player = event.player
  if (!player || player.level.isClientSide()) return
  if (!activeSkill(player, SKILLS.purify)) return
  const server = player.server
  if (!server) return
  server.scheduleInTicks(1, () => {
    if (player.isAlive()) clearEffect(player, 'parasites')
  })
})
