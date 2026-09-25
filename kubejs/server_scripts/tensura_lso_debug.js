// priority: 50
//
// kubejs/server_scripts/tensura_lso_debug.js
// ------------------------------------------
// In-game diagnostics for the Tensura <-> LSO bridge. Everything here is
// read-only except `learn` and `hurt`, which exist to exercise the bridge.
// Requires permission level 2 (op / singleplayer with cheats).
//
//   /tensuralso status            what loaded, what the player has, LSO body state
//   /tensuralso skills [filter]   list ManasCore skill ids (default filter "tensura:")
//   /tensuralso learn <skill id>  learn a skill by id, e.g. kubejs:thermoregulation
//   /tensuralso limbs             LSO limb health per body part
//   /tensuralso hurt <part> <hp>  damage one limb (HEAD, CHEST, LEFT_ARM, ...)
//   /tensuralso temp              LSO body / world temperature and hydration
//
// The bridge script publishes its helpers on global.tensuraLso; this file
// only adds the command layer, so removing it never affects gameplay.

var DEBUG_JAVA = {
  skillApi: [
    'io.github.manasmods.manascore.skill.api.SkillAPI',
    'com.github.manasmods.manascore.api.skills.SkillAPI'
  ],
  tensuraStorages: ['io.github.manasmods.tensura.storage.TensuraStorages'],
  bodyDamageUtil: ['sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyDamageUtil'],
  bodyPartEnum: ['sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyPartEnum'],
  temperatureUtil: ['sfiomn.legendarysurvivaloverhaul.api.temperature.TemperatureUtil'],
  temperatureEnum: ['sfiomn.legendarysurvivaloverhaul.api.temperature.TemperatureEnum'],
  capabilityUtil: ['sfiomn.legendarysurvivaloverhaul.util.CapabilityUtil'],
  resourceLocation: ['net.minecraft.resources.ResourceLocation']
}

var CUSTOM_SKILLS = ['kubejs:thermoregulation', 'kubejs:purification', 'kubejs:adaptive_carapace']

var _dbgClasses = {}
var _dbgLoadedName = {}
var _dbgLoadErrors = {}
function dbgLoad(key) {
  if (_dbgClasses[key] !== undefined) return _dbgClasses[key]
  var found = null
  var candidates = DEBUG_JAVA[key]
  var errors = []
  for (var i = 0; i < candidates.length && !found; i++) {
    try {
      found = Java.loadClass(candidates[i])
      _dbgLoadedName[key] = candidates[i]
    } catch (e) {
      errors.push(candidates[i] + ' -> ' + e)
    }
  }
  _dbgLoadErrors[key] = errors.join('; ')
  _dbgClasses[key] = found
  return found
}

function dbgRl(id) {
  var c = dbgLoad('resourceLocation')
  if (!c) return null
  try { return typeof c.parse === 'function' ? c.parse(id) : c.tryParse(id) } catch (e) { return null }
}

function dbgUnwrap(v) {
  if (v && typeof v.isPresent === 'function') return v.isPresent() ? v.get() : null
  return v || null
}

function say(ctx, text) {
  ctx.getSource().sendSystemMessage(Text.string(String(text)))
}

function fmt(n, digits) {
  return isNaN(n) ? '?' : Number(n).toFixed(digits === undefined ? 1 : digits)
}

function bridge() {
  return (typeof global !== 'undefined' && global.tensuraLso) ? global.tensuraLso : null
}

// --- readers ---------------------------------------------------------
function skillRegistry() {
  var api = dbgLoad('skillApi')
  if (!api) return null
  try { return api.getSkillRegistry() } catch (e) { return null }
}

function skillStorage(player) {
  var api = dbgLoad('skillApi')
  if (!api) return null
  try { return api.getSkillsFrom(player) } catch (e) { return null }
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
  var body = dbgLoad('bodyDamageUtil')
  var parts = dbgLoad('bodyPartEnum')
  if (!body || !parts) return ['  BodyDamageUtil / BodyPartEnum not loaded']
  var lines = []
  var values = []
  try { values = parts.values() } catch (e) { return ['  BodyPartEnum.values() failed'] }
  for (var i = 0; i < values.length; i++) {
    var part = values[i]
    var max = NaN, ratio = NaN
    try { max = Number(body.getMaxHealth(player, part)) } catch (e) { /* ignore */ }
    try { ratio = Number(body.getHealthRatio(player, part)) } catch (e) { /* ignore */ }
    var cur = isNaN(max) || isNaN(ratio) ? NaN : ratio * max
    lines.push(`  ${String(part.name())}: ${fmt(cur)} / ${fmt(max)}${cur <= 0 ? '  [BROKEN]' : ''}`)
  }
  return lines
}

function tempLines(player) {
  var lines = []
  var util = dbgLoad('temperatureUtil')
  var capUtil = dbgLoad('capabilityUtil')
  if (util) {
    try {
      var world = Number(util.getWorldTemperature(player.level, player.blockPosition()))
      lines.push(`  world temperature here: ${fmt(world)} (${String(util.getTemperatureEnum(world))})`)
    } catch (e) { lines.push(`  TemperatureUtil.getWorldTemperature failed: ${e}`) }
  } else {
    lines.push('  TemperatureUtil not loaded')
  }
  if (capUtil) {
    try {
      var cap = capUtil.getTempCapability(player)
      var level = Number(cap.getTemperatureLevel())
      var band = util ? String(util.getTemperatureEnum(level)) : '?'
      lines.push(`  body temperature: ${fmt(level)} (${band}; NORMAL is 16-24, optimal 20)`)
    } catch (e) { lines.push(`  temperature capability unreadable: ${e}`) }
    try {
      var thirst = capUtil.getThirstCapability(player)
      lines.push(`  hydration: ${thirst.getHydrationLevel()} / 20, saturation ${fmt(thirst.getSaturationLevel())}`)
    } catch (e) { lines.push(`  thirst capability unreadable: ${e}`) }
  } else {
    lines.push('  CapabilityUtil not loaded (LSO 2.4 may use a different accessor; see docs/SESSION_HANDOFF.md)')
  }
  var effects = ['legendarysurvivaloverhaul:heat_resistance', 'legendarysurvivaloverhaul:cold_resistance',
    'legendarysurvivaloverhaul:temperature_immunity', 'legendarysurvivaloverhaul:heat_immunity',
    'legendarysurvivaloverhaul:cold_immunity', 'legendarysurvivaloverhaul:heat_stroke',
    'legendarysurvivaloverhaul:frostbite', 'legendarysurvivaloverhaul:thirst']
  var active = []
  for (var i = 0; i < effects.length; i++) {
    try { if (player.potionEffects.isActive(effects[i])) active.push(effects[i].split(':')[1]) } catch (e) { /* not registered */ }
  }
  lines.push(`  LSO effects active: ${active.length ? active.join(', ') : 'none'}`)
  return lines
}

// --- commands --------------------------------------------------------
ServerEvents.commandRegistry(event => {
  var Commands = event.commands
  var Arguments = event.arguments

  function status(ctx) {
    try {
      return statusBody(ctx)
    } catch (e) {
      say(ctx, `status failed: ${e}`)
      return 0
    }
  }

  function statusBody(ctx) {
    var player = ctx.getSource().getPlayerOrException()
    say(ctx, '--- Tensura <-> LSO bridge status ---')

    say(ctx, 'Java classes:')
    var keys = Object.keys(DEBUG_JAVA)
    for (var i = 0; i < keys.length; i++) {
      var c = dbgLoad(keys[i])
      say(ctx, `  ${keys[i]}: ${c ? 'OK (' + _dbgLoadedName[keys[i]] + ')' : 'MISSING - ' + _dbgLoadErrors[keys[i]]}`)
    }
    say(ctx, `  bridge script helpers: ${bridge() ? 'OK (tensura_lso_bridge.js loaded)' : 'MISSING - tensura_lso_bridge.js did not load, run /kubejs errors server'}`)
    var br = bridge()
    if (br && typeof br.tickErrors === 'function') say(ctx, `  bridge tick errors: ${br.tickErrors()}${br.tickErrors() ? ' - last: ' + br.lastTickError() : ''}`)

    say(ctx, 'Custom skills in the ManasCore registry:')
    var registry = skillRegistry()
    for (var i = 0; i < CUSTOM_SKILLS.length; i++) {
      var present = 'unknown (SkillAPI missing)'
      if (registry) {
        try { present = registry.contains(dbgRl(CUSTOM_SKILLS[i])) ? 'registered' : 'NOT registered - skills.js failed, run /kubejs errors startup' } catch (e) { present = `lookup failed: ${e}` }
      }
      say(ctx, `  ${CUSTOM_SKILLS[i]}: ${present}`)
    }

    say(ctx, `Player ${player.username}:`)
    var storages = dbgLoad('tensuraStorages')
    if (storages) {
      try {
        var ex = storages.getExistenceFrom(player)
        say(ctx, `  magicules: ${fmt(ex.getMagicule())}, EP: ${fmt(ex.getEP(), 0)}`)
      } catch (e) { say(ctx, `  Tensura existence unreadable: ${e}`) }
    }
    var storage = skillStorage(player)
    if (storage) {
      for (var i = 0; i < CUSTOM_SKILLS.length; i++) {
        var inst = null
        try { inst = dbgUnwrap(storage.getSkill(dbgRl(CUSTOM_SKILLS[i]))) } catch (e) { inst = null }
        say(ctx, `  ${CUSTOM_SKILLS[i]}: ${inst ? describeInstance(player, inst) : 'not learned (try /tensuralso learn ' + CUSTOM_SKILLS[i] + ')'}`)
      }
      var b = bridge()
      if (b && b.SKILLS && typeof b.activeSkill === 'function') {
        var groups = Object.keys(b.SKILLS)
        var active = []
        var learnedOnly = []
        for (var g = 0; g < groups.length; g++) {
          var ids = b.SKILLS[groups[g]]
          var activeInst = null
          try { activeInst = b.activeSkill(player, ids) } catch (e) { say(ctx, `  activeSkill(${groups[g]}) threw: ${e}`) }
          if (activeInst) {
            var activeId = '?'
            try { activeId = String(activeInst.getSkillId()) } catch (e) { /* ignore */ }
            active.push(`${groups[g]} <- ${activeId}`)
            continue
          }
          for (var k = 0; k < ids.length; k++) {
            var li = null
            try { li = dbgUnwrap(storage.getSkill(dbgRl(ids[k]))) } catch (e) { li = null }
            if (li) learnedOnly.push(`${ids[k]} (${describeInstance(player, li)})`)
          }
        }
        say(ctx, `  bridge bindings active: ${active.length ? active.join('; ') : 'none'}`)
        if (learnedOnly.length) say(ctx, `  learned but NOT active (toggle them on): ${learnedOnly.join('; ')}`)
      } else {
        say(ctx, '  bridge helpers missing: tensura_lso_bridge.js did not load (run /kubejs errors server)')
      }
      var count = 0
      try { count = storage.getLearnedSkills().size() } catch (e) { /* ignore */ }
      say(ctx, `  learned skills total: ${count} (list ids with /tensuralso skills)`)
    } else {
      say(ctx, '  skill storage unreadable (SkillAPI missing?)')
    }

    say(ctx, 'LSO body:')
    var limbs = limbLines(player)
    for (var i = 0; i < limbs.length; i++) say(ctx, limbs[i])
    var temps = tempLines(player)
    for (var i = 0; i < temps.length; i++) say(ctx, temps[i])
    return 1
  }

  function listSkills(ctx, filter) {
    var registry = skillRegistry()
    if (!registry) { say(ctx, 'SkillAPI not loaded; cannot list skills.'); return 0 }
    var wanted = (filter || 'tensura:').toLowerCase()
    var ids = []
    try {
      var it = registry.getIds().iterator()
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

  function learn(ctx, id) {
    var player = ctx.getSource().getPlayerOrException()
    var storage = skillStorage(player)
    var rl = dbgRl(String(id).trim())
    if (!storage || !rl) { say(ctx, 'SkillAPI not loaded or bad id.'); return 0 }
    var registry = skillRegistry()
    try {
      if (registry && !registry.contains(rl)) { say(ctx, `${rl} is not a registered skill. Use /tensuralso skills <filter> to search.`); return 0 }
      var ok = storage.learnSkill(rl)
      say(ctx, `${rl}: ${ok ? 'learned' : 'not learned (already known, or the skill refused)'}`)
      return ok ? 1 : 0
    } catch (e) { say(ctx, `learnSkill failed: ${e}`); return 0 }
  }

  function hurt(ctx, partName, amount) {
    var player = ctx.getSource().getPlayerOrException()
    var body = dbgLoad('bodyDamageUtil')
    var parts = dbgLoad('bodyPartEnum')
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

  event.register(
    Commands.literal('tensuralso')
      .requires(source => source.hasPermission(2))
      .executes(ctx => status(ctx))
      .then(Commands.literal('status').executes(ctx => status(ctx)))
      .then(Commands.literal('skills')
        .executes(ctx => listSkills(ctx, 'tensura:'))
        .then(Commands.argument('filter', Arguments.GREEDY_STRING.create(event))
          .executes(ctx => listSkills(ctx, Arguments.GREEDY_STRING.getResult(ctx, 'filter')))))
      .then(Commands.literal('learn')
        .then(Commands.argument('skill', Arguments.GREEDY_STRING.create(event))
          .executes(ctx => learn(ctx, Arguments.GREEDY_STRING.getResult(ctx, 'skill')))))
      .then(Commands.literal('limbs').executes(ctx => {
        var lines = limbLines(ctx.getSource().getPlayerOrException())
        for (var i = 0; i < lines.length; i++) say(ctx, lines[i])
        return 1
      }))
      .then(Commands.literal('temp').executes(ctx => {
        var lines = tempLines(ctx.getSource().getPlayerOrException())
        for (var i = 0; i < lines.length; i++) say(ctx, lines[i])
        return 1
      }))
      .then(Commands.literal('hurt')
        .then(Commands.argument('part', Arguments.WORD.create(event))
          .then(Commands.argument('amount', Arguments.FLOAT.create(event))
            .executes(ctx => hurt(ctx, Arguments.WORD.getResult(ctx, 'part'), Arguments.FLOAT.getResult(ctx, 'amount'))))))
  )
})
