// priority: 100
//
// kubejs/server_scripts/tensura_lso_bridge.js
// -------------------------------------------
// Real-time bridge between Tensura skills and Legendary Survival Overhaul
// (LSO) body systems. See Claude.md §2.
//
//   A. Locational healing   - Self / Ultra-Speed / Infinite Regeneration heal
//                             LSO limbs directly (LSO bypasses player.heal()).
//   B. Temperature           - resistance skills apply LSO's heat / cold
//                             resistance effects and negate LSO hyperthermia /
//                             hypothermia damage; nullification skills apply
//                             LSO's immunity effects. Effects are removed the
//                             check after the skill is toggled off.
//   C. Thirst & sustenance  - Purification / Abnormal Condition Resistance
//                             cleanse LSO's dirty-water debuff.
//   D. Diagnostics          - /tensuralso status | skills | learn | limbs |
//                             temp | hurt | class  (op level 2)
//
// Limb pools already scale with Tensura max health: LSO's default
// "Body Part Health Mode = DYNAMIC" (config/legendarysurvivaloverhaul,
// section body-parts-health) recomputes every limb's max health from the
// player's stable max health every 20 ticks. Keep that config on DYNAMIC.
//
// Player checks run every CHECK_INTERVAL ticks (never every tick), and every
// capability / persistent-data access is null-checked so a missing mod class
// or a player mid-respawn degrades to a no-op instead of a crash (§4).
//
// KubeJS notes: server scripts cannot write to `global` (the script fails
// to load), and each file has its own scope, which is why the diagnostics
// command lives in this file. Rhino treats const/let as function-scoped, so
// declarations inside functions use var.

// ---------------------------------------------------------------------
// 0. Configuration
// ---------------------------------------------------------------------
const CHECK_INTERVAL = 20          // ticks between per-player checks
const SELF_REGEN_INTERVAL = 60     // Self-Regeneration cadence
const ULTRA_REGEN_HEAL = 2.0       // HP spread across damaged limbs per check
const SELF_REGEN_HEAL = 1.0        // HP to the most damaged limb per cadence
const EFFECT_REFRESH_TICKS = 45    // duration of the LSO effects we re-apply
const APPLIED_KEY = 'tensuraLsoAppliedEffects' // persistentData: effects the bridge applied last check

// Tensura / custom skill ids that drive each binding. Unknown ids are
// skipped silently, so extra candidates are harmless.
// VERIFIED in-game (1.21.1, /tensura edit ability grant autocomplete):
//   tensura:self_regeneration, tensura:ultraspeed_regeneration,
//   tensura:infinite_regeneration, tensura:heat_resistance,
//   tensura:cold_resistance, tensura:flame_attack_resistance,
//   tensura:thermal_fluctuation_resistance, tensura:abnormal_condition_resistance,
//   tensura:poison_resistance.
// The *_nullification ids are still guesses; check with /tensuralso skills null.
const SKILLS = {
  selfRegen: ['tensura:self_regeneration'],
  ultraRegen: ['tensura:ultraspeed_regeneration'],
  infiniteRegen: ['tensura:infinite_regeneration'],
  // Resistance tier (Claude.md §2B): LSO heat/cold *resistance* effects plus
  // LSO hyperthermia / hypothermia damage negated. kubejs:thermoregulation
  // is not listed because skills.js implements its own tiers.
  heat: [
    'tensura:heat_resistance',
    'tensura:flame_attack_resistance',
    'tensura:thermal_fluctuation_resistance'
  ],
  cold: [
    'tensura:cold_resistance',
    'tensura:thermal_fluctuation_resistance'
  ],
  // Nullification tier: LSO heat / cold *immunity* effects.
  heatImmune: [
    'tensura:heat_nullification',
    'tensura:flame_attack_nullification'
  ],
  coldImmune: [
    'tensura:cold_nullification'
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

// DamageType msgIds are "<modid>.<name>" (ModDamageTypes.bootstrap).
const LSO_DAMAGE = {
  hyperthermia: 'legendarysurvivaloverhaul.hyperthermia',
  hypothermia: 'legendarysurvivaloverhaul.hypothermia'
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
  heatResistance: 'legendarysurvivaloverhaul:heat_resistance',
  coldResistance: 'legendarysurvivaloverhaul:cold_resistance',
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
// only needs an extra entry here. First entry = verified name.
//   capabilityUtil: LSO 2.3 (Forge) name is util.CapabilityUtil; the 2.4
//   NeoForge build does not have it (confirmed in-game). The other entries
//   are guesses; use `/tensuralso class <fqcn>` to test names without editing.
const JAVA_CANDIDATES = {
  skillApi: [
    'io.github.manasmods.manascore.skill.api.SkillAPI',
    'com.github.manasmods.manascore.api.skills.SkillAPI'
  ],
  tensuraStorages: ['io.github.manasmods.tensura.storage.TensuraStorages'],
  bodyDamageUtil: ['sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyDamageUtil'],
  bodyPartEnum: ['sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyPartEnum'],
  temperatureUtil: ['sfiomn.legendarysurvivaloverhaul.api.temperature.TemperatureUtil'],
  temperatureEnum: ['sfiomn.legendarysurvivaloverhaul.api.temperature.TemperatureEnum'],
  capabilityUtil: [
    'sfiomn.legendarysurvivaloverhaul.util.CapabilityUtil',
    'sfiomn.legendarysurvivaloverhaul.util.AttachmentUtil',
    'sfiomn.legendarysurvivaloverhaul.common.attachment.AttachmentUtil',
    'sfiomn.legendarysurvivaloverhaul.registry.AttachmentRegistry'
  ],
  resourceLocation: ['net.minecraft.resources.ResourceLocation']
}

// ---------------------------------------------------------------------
// 1. Java access helpers (lazy, cached, never throwing)
// ---------------------------------------------------------------------
// Java.loadClass returns a wrapper exposing the class's STATIC members only
// (no getName()); the resolved name is remembered in _loadedName instead.
var _classes = {}
var _loadedName = {}
var _loadErrors = {}
function loadFirst(key) {
  if (_classes[key] !== undefined) return _classes[key]
  var found = null
  var candidates = JAVA_CANDIDATES[key] || []
  var errors = []
  for (var i = 0; i < candidates.length && !found; i++) {
    try {
      found = Java.loadClass(candidates[i])
      _loadedName[key] = candidates[i]
    } catch (e) {
      errors.push(candidates[i] + ' -> ' + e)
    }
  }
  _loadErrors[key] = errors.join('; ')
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
function skillStorage(player) {
  var api = loadFirst('skillApi')
  if (!api) return null
  try {
    return api.getSkillsFrom(player)
  } catch (e) {
    return null
  }
}

function learnedSkill(storage, id) {
  var rl = toResourceLocation(id)
  if (!storage || !rl) return null
  try {
    return unwrap(storage.getSkill(rl))
  } catch (e) {
    return null
  }
}

// Returns the ManasSkillInstance if the player has any of `ids` learned and
// active (toggled on, or not toggleable), else null.
function activeSkill(player, ids) {
  var storage = skillStorage(player)
  if (!storage) return null
  for (var i = 0; i < ids.length; i++) {
    var instance = learnedSkill(storage, ids[i])
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
var _bodyParts = null
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

function anyLimbBroken(body, player) {
  var parts = bodyParts()
  for (var i = 0; i < parts.length; i++) {
    var health = limbHealth(body, player, parts[i])
    if (!isNaN(health) && health <= 0.001) return true
  }
  return false
}

// Effect id -> registered? (cached). Unknown ids are never applied.
var _effectKnown = {}
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

function hasEffect(player, id) {
  try { return player.potionEffects.isActive(id) } catch (e) { return false }
}

function clearEffect(player, id) {
  if (!effectExists(id)) return
  try {
    if (player.potionEffects.isActive(id)) player.removeEffect(id)
  } catch (e) {
    // effect id not registered
  }
}

// Re-applies only when the remaining duration is short, so the HUD icon
// does not flicker from a remove/add every check.
function applyEffect(player, id, duration, amplifier) {
  if (!effectExists(id)) return
  try {
    var current = player.potionEffects.getActive(id)
    if (current && current.getDuration() > CHECK_INTERVAL + 5 && current.getAmplifier() >= amplifier) return
    player.potionEffects.add(id, duration, amplifier, false, false)
  } catch (e) {
    // effect id not registered
  }
}

// Temperature bounds from LSO's enum, falling back to TEMP constants.
var _bounds = null
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

// LSO 2.3 exposed the per-player data through util.CapabilityUtil
// (getTempCapability / getThirstCapability). LSO 2.4 (NeoForge) has
// util.AttachmentUtil instead (confirmed in-game); its method names are
// probed from this list. `/tensuralso status` prints which names exist.
const ACCESSOR_NAMES = {
  temp: ['getTempCapability', 'getTemperatureCapability', 'getTempAttachment', 'getTemperatureAttachment',
    'getTemperature', 'getTemperatureData', 'getTempData', 'temperature'],
  thirst: ['getThirstCapability', 'getThirstAttachment', 'getThirst', 'getThirstData', 'getHydrationAttachment',
    'getHydration', 'thirst'],
  body: ['getBodyDamageCapability', 'getBodyDamageAttachment', 'getBodyDamage', 'getBodyDamageData', 'bodyDamage']
}

var _accessor = {}
function accessorName(kind) {
  if (_accessor[kind] !== undefined) return _accessor[kind]
  var util = loadFirst('capabilityUtil')
  var found = null
  if (util) {
    var names = ACCESSOR_NAMES[kind]
    for (var i = 0; i < names.length && !found; i++) {
      try { if (typeof util[names[i]] === 'function') found = names[i] } catch (e) { /* not there */ }
    }
  }
  _accessor[kind] = found
  return found
}

function accessor(kind, player) {
  var util = loadFirst('capabilityUtil')
  var name = accessorName(kind)
  if (!util || !name) return null
  try { return util[name](player) } catch (e) { return null }
}

function tempCapability(player) { return accessor('temp', player) }
function thirstCapability(player) { return accessor('thirst', player) }

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

  // Infinite Regeneration: restore every limb, then shed the limb maluses
  // once nothing is broken any more (never fight LSO while a limb is at 0).
  if (infinite) {
    var all = damagedLimbs(body, player)
    for (var i = 0; i < all.length; i++) {
      healLimb(body, player, all[i].part, all[i].max - all[i].health)
    }
    if (all.length > 0 && !anyLimbBroken(body, player)) {
      for (var m = 0; m < LSO_EFFECTS.limbMalus.length; m++) clearEffect(player, LSO_EFFECTS.limbMalus[m])
    }
    return
  }

  // Ultra-Speed Regeneration: 2 HP shared across damaged limbs every check.
  if (ultra) {
    var damaged = damagedLimbs(body, player)
    if (damaged.length === 0) return
    var share = ULTRA_REGEN_HEAL / damaged.length
    for (var u = 0; u < damaged.length; u++) {
      healLimb(body, player, damaged[u].part, Math.min(share, damaged[u].max - damaged[u].health))
    }
    return
  }

  // Self-Regeneration: 1 HP to the most damaged limb every 60 ticks.
  if (self && player.tickCount % SELF_REGEN_INTERVAL === 0) {
    var limbs = damagedLimbs(body, player)
    if (limbs.length === 0) return
    var worst = limbs[0]
    for (var s = 1; s < limbs.length; s++) {
      if (limbs[s].health / limbs[s].max < worst.health / worst.max) worst = limbs[s]
    }
    healLimb(body, player, worst.part, Math.min(SELF_REGEN_HEAL, worst.max - worst.health))
  }
}

// Effects the bridge applied last check are remembered per player so they
// are removed the moment the driving skill is toggled off (LSO's immunity
// effects are plain timed effects, but this makes the switch instant).
function appliedEffects(data) {
  var raw = data.contains(APPLIED_KEY) ? String(data.getString(APPLIED_KEY)) : ''
  return raw ? raw.split(',') : []
}

function syncEffects(player, data, wanted) {
  var previous = appliedEffects(data)
  for (var i = 0; i < previous.length; i++) {
    if (wanted.indexOf(previous[i]) < 0) clearEffect(player, previous[i])
  }
  for (var j = 0; j < wanted.length; j++) applyEffect(player, wanted[j], EFFECT_REFRESH_TICKS, 0)
  data.putString(APPLIED_KEY, wanted.join(','))
}

function thermalState(player) {
  var lock = activeSkill(player, SKILLS.thermalLock)
  return {
    lock: lock,
    heatImmune: lock ? null : activeSkill(player, SKILLS.heatImmune),
    coldImmune: lock ? null : activeSkill(player, SKILLS.coldImmune),
    heat: lock ? null : activeSkill(player, SKILLS.heat),
    cold: lock ? null : activeSkill(player, SKILLS.cold)
  }
}

function handleTemperature(player, data) {
  var st = thermalState(player)
  var wanted = []

  // Primary path: LSO's own effects (no capability access needed).
  if (st.lock) {
    wanted.push(LSO_EFFECTS.temperatureImmunity)
  } else {
    if (st.heatImmune) wanted.push(LSO_EFFECTS.heatImmunity)
    else if (st.heat) wanted.push(LSO_EFFECTS.heatResistance)
    if (st.coldImmune) wanted.push(LSO_EFFECTS.coldImmunity)
    else if (st.cold) wanted.push(LSO_EFFECTS.coldResistance)
  }
  syncEffects(player, data, wanted)
  if (wanted.length === 0) return

  if (st.lock || st.heatImmune) clearEffect(player, LSO_EFFECTS.heatStroke)
  if (st.lock || st.coldImmune) clearEffect(player, LSO_EFFECTS.frostbite)

  // Secondary path: clamp the stored body temperature when the capability is reachable.
  var cap = tempCapability(player)
  if (!cap) return
  var level
  try { level = Number(cap.getTemperatureLevel()) } catch (e) { return }
  if (isNaN(level)) return

  var bounds = tempBounds()
  var target = level
  if (st.lock) {
    target = bounds.optimal
  } else {
    if ((st.heat || st.heatImmune) && level > bounds.max) target = bounds.max
    if ((st.cold || st.coldImmune) && level < bounds.min) target = bounds.min
  }
  if (Math.abs(target - level) > 0.01) {
    try { cap.setTemperatureLevel(target) } catch (e) { /* capability API differs */ }
  }
}

function handlePurification(player) {
  if (!activeSkill(player, SKILLS.purify)) return
  clearEffect(player, LSO_EFFECTS.thirst)
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
    handleTemperature(player, data)
    handlePurification(player)
    data.putLong('tensuraLsoBridgeLastCheck', player.tickCount)
  } catch (e) {
    _tickErrors++
    _lastTickError = String(e)
    if (_tickErrors <= 5 || _tickErrors % 600 === 0) console.error(`[tensura_lso_bridge] tick handler failed for ${player.username} (${_tickErrors}x): ${e}`)
  }
})

// Resistance-tier skills negate LSO's hyperthermia / hypothermia organ
// damage (Claude.md §2B); the temperature debuff itself stays visible.
EntityEvents.beforeHurt('minecraft:player', event => {
  var player = event.entity
  if (!player || player.level.isClientSide()) return
  var id = ''
  try { id = String(event.source.getMsgId()) } catch (e) { return }
  if (id !== LSO_DAMAGE.hyperthermia && id !== LSO_DAMAGE.hypothermia) return
  var st = thermalState(player)
  var negate = st.lock ||
    (id === LSO_DAMAGE.hyperthermia && (st.heat || st.heatImmune)) ||
    (id === LSO_DAMAGE.hypothermia && (st.cold || st.coldImmune))
  if (negate) event.setDamage(0)
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

// ---------------------------------------------------------------------
// 6. Diagnostics: /tensuralso (op level 2)
// ---------------------------------------------------------------------
//   /tensuralso status            what loaded, what the player has, LSO body state
//   /tensuralso skills [filter]   list ManasCore skill ids (default filter "tensura:")
//   /tensuralso learn <skill id>  learn a skill by id (or use /tensura edit ability grant)
//   /tensuralso limbs             LSO limb health per body part
//   /tensuralso hurt <part> <hp>  damage one limb (HEAD, CHEST, LEFT_ARM, ...)
//   /tensuralso temp              LSO body / world temperature and hydration
//   /tensuralso class <fqcn>      try to load a Java class by name
const CUSTOM_SKILLS = ['kubejs:thermoregulation', 'kubejs:purification', 'kubejs:adaptive_carapace']

function say(ctx, text) {
  ctx.getSource().sendSystemMessage(Text.string(String(text)))
}

function fmt(n, digits) {
  return isNaN(n) ? '?' : Number(n).toFixed(digits === undefined ? 1 : digits)
}

function describeInstance(player, instance) {
  var out = 'learned'
  try {
    if (instance.canBeToggled(player)) out += instance.isToggled() ? ', toggled ON' : ', toggled off'
  } catch (e) { /* ignore */ }
  try { out += `, mastery ${fmt(instance.getMastery(), 0)}${instance.isMastered(player) ? ' (mastered)' : ''}` } catch (e) { /* ignore */ }
  return out
}

function limbLines(player) {
  var body = loadFirst('bodyDamageUtil')
  var parts = bodyParts()
  if (!body || parts.length === 0) return ['  BodyDamageUtil / BodyPartEnum not loaded']
  var lines = []
  for (var i = 0; i < parts.length; i++) {
    var max = limbMaxHealth(body, player, parts[i])
    var cur = limbHealth(body, player, parts[i])
    lines.push(`  ${String(parts[i].name())}: ${fmt(cur)} / ${fmt(max)}${cur <= 0.001 ? '  [BROKEN]' : ''}`)
  }
  return lines
}

function tempLines(player) {
  var lines = []
  var util = loadFirst('temperatureUtil')
  if (util) {
    try {
      var world = Number(util.getWorldTemperature(player.level, player.blockPosition()))
      lines.push(`  world temperature here: ${fmt(world)} (${String(util.getTemperatureEnum(world))})`)
    } catch (e) { lines.push(`  TemperatureUtil.getWorldTemperature failed: ${e}`) }
  } else {
    lines.push('  TemperatureUtil not loaded')
  }
  var cap = tempCapability(player)
  if (cap) {
    try {
      var level = Number(cap.getTemperatureLevel())
      lines.push(`  body temperature: ${fmt(level)} (${util ? String(util.getTemperatureEnum(level)) : '?'}; NORMAL is 16-24, optimal 20)`)
    } catch (e) { lines.push(`  temperature capability unreadable: ${e}`) }
  } else {
    lines.push(`  body temperature: no accessor. ${_loadedName.capabilityUtil || 'no util class'} has none of [${ACCESSOR_NAMES.temp.join(', ')}]`)
  }
  var thirst = thirstCapability(player)
  if (thirst) {
    try {
      lines.push(`  hydration: ${thirst.getHydrationLevel()} / 20, saturation ${fmt(thirst.getSaturationLevel())}`)
    } catch (e) { lines.push(`  thirst data unreadable via ${accessorName('thirst')}: ${e}`) }
  } else {
    lines.push(`  hydration: no accessor. ${_loadedName.capabilityUtil || 'no util class'} has none of [${ACCESSOR_NAMES.thirst.join(', ')}]`)
  }
  var applied = appliedEffects(player.persistentData)
  lines.push(`  effects applied by the bridge: ${applied.length ? applied.join(', ') : 'none'}`)
  var effects = [LSO_EFFECTS.heatResistance, LSO_EFFECTS.coldResistance, LSO_EFFECTS.temperatureImmunity,
    LSO_EFFECTS.heatImmunity, LSO_EFFECTS.coldImmunity, LSO_EFFECTS.heatStroke, LSO_EFFECTS.frostbite,
    LSO_EFFECTS.thirst].concat(LSO_EFFECTS.limbMalus)
  var active = []
  for (var i = 0; i < effects.length; i++) {
    if (hasEffect(player, effects[i])) active.push(effects[i].split(':')[1])
  }
  lines.push(`  LSO effects active: ${active.length ? active.join(', ') : 'none'}`)
  return lines
}

function statusBody(ctx) {
  var player = ctx.getSource().getPlayerOrException()
  say(ctx, '--- Tensura <-> LSO bridge status ---')

  say(ctx, 'Java classes:')
  var keys = Object.keys(JAVA_CANDIDATES)
  for (var i = 0; i < keys.length; i++) {
    var c = loadFirst(keys[i])
    say(ctx, `  ${keys[i]}: ${c ? 'OK (' + _loadedName[keys[i]] + ')' : 'MISSING - ' + _loadErrors[keys[i]]}`)
  }
  say(ctx, `  bridge tick errors: ${_tickErrors}${_tickErrors ? ' - last: ' + _lastTickError : ''}`)
  say(ctx, `  LSO accessor methods: temp=${accessorName('temp') || 'none'}, thirst=${accessorName('thirst') || 'none'}, body=${accessorName('body') || 'none'}`)

  say(ctx, 'Custom skills in the ManasCore registry:')
  var api = loadFirst('skillApi')
  for (var j = 0; j < CUSTOM_SKILLS.length; j++) {
    var present = 'unknown (SkillAPI missing)'
    if (api) {
      try { present = api.getSkillRegistry().contains(toResourceLocation(CUSTOM_SKILLS[j])) ? 'registered' : 'NOT registered - run /kubejs errors startup' } catch (e) { present = `lookup failed: ${e}` }
    }
    say(ctx, `  ${CUSTOM_SKILLS[j]}: ${present}`)
  }

  say(ctx, `Player ${player.username}:`)
  var storages = loadFirst('tensuraStorages')
  if (storages) {
    try {
      var ex = storages.getExistenceFrom(player)
      say(ctx, `  magicules: ${fmt(ex.getMagicule())}, EP: ${fmt(ex.getEP(), 0)}`)
    } catch (e) { say(ctx, `  Tensura existence unreadable: ${e}`) }
  }
  var storage = skillStorage(player)
  if (storage) {
    for (var k = 0; k < CUSTOM_SKILLS.length; k++) {
      var inst = learnedSkill(storage, CUSTOM_SKILLS[k])
      say(ctx, `  ${CUSTOM_SKILLS[k]}: ${inst ? describeInstance(player, inst) : 'not learned (/tensura edit ability grant ' + player.username + ' ' + CUSTOM_SKILLS[k] + ')'}`)
    }
    var groups = Object.keys(SKILLS)
    var active = []
    var learnedOnly = []
    for (var g = 0; g < groups.length; g++) {
      var ids = SKILLS[groups[g]]
      var activeInst = activeSkill(player, ids)
      if (activeInst) {
        var activeId = '?'
        var how = 'passive'
        try { activeId = String(activeInst.getSkillId()) } catch (e) { /* ignore */ }
        try { how = activeInst.canBeToggled(player) ? 'toggled ON' : 'passive, cannot be toggled' } catch (e) { /* ignore */ }
        active.push(`${groups[g]} <- ${activeId} (${how})`)
        continue
      }
      for (var n = 0; n < ids.length; n++) {
        var li = learnedSkill(storage, ids[n])
        if (li) learnedOnly.push(`${ids[n]} (${describeInstance(player, li)})`)
      }
    }
    say(ctx, `  bridge bindings active: ${active.length ? active.join('; ') : 'none'}`)
    if (learnedOnly.length) say(ctx, `  learned but NOT active (toggle them on): ${learnedOnly.join('; ')}`)
    var count = 0
    try { count = storage.getLearnedSkills().size() } catch (e) { /* ignore */ }
    say(ctx, `  learned skills total: ${count} (list ids with /tensuralso skills)`)
  } else {
    say(ctx, '  skill storage unreadable (SkillAPI missing?)')
  }

  say(ctx, 'LSO body:')
  var limbs = limbLines(player)
  for (var l = 0; l < limbs.length; l++) say(ctx, limbs[l])
  var temps = tempLines(player)
  for (var t = 0; t < temps.length; t++) say(ctx, temps[t])
  return 1
}

function listSkills(ctx, filter) {
  var api = loadFirst('skillApi')
  if (!api) { say(ctx, 'SkillAPI not loaded; cannot list skills.'); return 0 }
  var wanted = (filter || 'tensura:').toLowerCase()
  var ids = []
  try {
    var it = api.getSkillRegistry().getIds().iterator()
    while (it.hasNext()) {
      var id = String(it.next())
      if (id.toLowerCase().indexOf(wanted) >= 0) ids.push(id)
    }
  } catch (e) { say(ctx, `registry.getIds() failed: ${e}`); return 0 }
  ids.sort()
  say(ctx, `${ids.length} skill id(s) matching "${wanted}":`)
  var limit = 80
  for (var i = 0; i < Math.min(ids.length, limit); i++) say(ctx, `  ${ids[i]}`)
  if (ids.length > limit) say(ctx, `  ... ${ids.length - limit} more; narrow the filter (e.g. /tensuralso skills regen)`)
  return ids.length
}

function learnCommand(ctx, id) {
  var player = ctx.getSource().getPlayerOrException()
  var storage = skillStorage(player)
  var rl = toResourceLocation(String(id).trim())
  if (!storage || !rl) { say(ctx, 'SkillAPI not loaded or bad id.'); return 0 }
  try {
    var api = loadFirst('skillApi')
    if (api && !api.getSkillRegistry().contains(rl)) { say(ctx, `${rl} is not a registered skill. Use /tensuralso skills <filter> to search.`); return 0 }
    var ok = storage.learnSkill(rl)
    say(ctx, `${rl}: ${ok ? 'learned' : 'not learned (already known, or the skill refused)'}`)
    return ok ? 1 : 0
  } catch (e) { say(ctx, `learnSkill failed: ${e}`); return 0 }
}

function hurtCommand(ctx, partName, amount) {
  var player = ctx.getSource().getPlayerOrException()
  var body = loadFirst('bodyDamageUtil')
  var parts = loadFirst('bodyPartEnum')
  if (!body || !parts) { say(ctx, 'LSO body damage API not loaded.'); return 0 }
  try {
    var part = parts.get(String(partName))
    body.hurtBodyPart(player, part, Number(amount))
    say(ctx, `Dealt ${fmt(amount)} to ${String(part.name())}. Now:`)
    var limbs = limbLines(player)
    for (var i = 0; i < limbs.length; i++) say(ctx, limbs[i])
    return 1
  } catch (e) { say(ctx, `hurtBodyPart failed (valid parts: HEAD, CHEST, LEFT_ARM, RIGHT_ARM, LEFT_LEG, RIGHT_LEG, LEFT_FOOT, RIGHT_FOOT): ${e}`); return 0 }
}

function classCommand(ctx, name) {
  var fqcn = String(name).trim()
  try {
    var clazz = Java.loadClass(fqcn)
    var members = []
    try {
      var methods = clazz.class.getMethods()
      for (var i = 0; i < methods.length; i++) {
        var mod = methods[i].getModifiers()
        if ((mod & 8) !== 0) members.push(String(methods[i].getName())) // static only
      }
    } catch (e) { /* reflection blocked */ }
    if (!members.length) {
      var probe = ACCESSOR_NAMES.temp.concat(ACCESSOR_NAMES.thirst, ACCESSOR_NAMES.body)
      for (var p = 0; p < probe.length; p++) {
        try { if (typeof clazz[probe[p]] === 'function') members.push(probe[p]) } catch (e) { /* ignore */ }
      }
      if (members.length) members.push('(reflection blocked; only probed names listed)')
    }
    say(ctx, `${fqcn}: OK${members.length ? '; static methods: ' + members.join(', ') : ''}`)
    return 1
  } catch (e) {
    say(ctx, `${fqcn}: ${e}`)
    return 0
  }
}

ServerEvents.commandRegistry(event => {
  var Commands = event.commands
  var Arguments = event.arguments

  function guarded(fn) {
    return ctx => {
      try { return fn(ctx) } catch (e) { say(ctx, `command failed: ${e}`); return 0 }
    }
  }

  event.register(
    Commands.literal('tensuralso')
      .requires(source => source.hasPermission(2))
      .executes(guarded(statusBody))
      .then(Commands.literal('status').executes(guarded(statusBody)))
      .then(Commands.literal('skills')
        .executes(guarded(ctx => listSkills(ctx, 'tensura:')))
        .then(Commands.argument('filter', Arguments.GREEDY_STRING.create(event))
          .executes(guarded(ctx => listSkills(ctx, Arguments.GREEDY_STRING.getResult(ctx, 'filter'))))))
      .then(Commands.literal('learn')
        .then(Commands.argument('skill', Arguments.GREEDY_STRING.create(event))
          .executes(guarded(ctx => learnCommand(ctx, Arguments.GREEDY_STRING.getResult(ctx, 'skill'))))))
      .then(Commands.literal('limbs').executes(guarded(ctx => {
        var lines = limbLines(ctx.getSource().getPlayerOrException())
        for (var i = 0; i < lines.length; i++) say(ctx, lines[i])
        return 1
      })))
      .then(Commands.literal('temp').executes(guarded(ctx => {
        var lines = tempLines(ctx.getSource().getPlayerOrException())
        for (var i = 0; i < lines.length; i++) say(ctx, lines[i])
        return 1
      })))
      .then(Commands.literal('hurt')
        .then(Commands.argument('part', Arguments.WORD.create(event))
          .then(Commands.argument('amount', Arguments.FLOAT.create(event))
            .executes(guarded(ctx => hurtCommand(ctx, Arguments.WORD.getResult(ctx, 'part'), Arguments.FLOAT.getResult(ctx, 'amount')))))))
      .then(Commands.literal('class')
        .then(Commands.argument('name', Arguments.GREEDY_STRING.create(event))
          .executes(guarded(ctx => classCommand(ctx, Arguments.GREEDY_STRING.getResult(ctx, 'name'))))))
  )
})
