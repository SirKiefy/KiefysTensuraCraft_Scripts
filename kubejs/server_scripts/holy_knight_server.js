// priority: 90
//
// kubejs/server_scripts/holy_knight_server.js
// --------------------------------------------
// Server-side half of the holy-knight content pack:
//   1. Summoned weapons (Excalibur / Clarent / Rhongomyniad) expire on
//      time and cannot be dropped.
//   2. Weapon passives while held (auras, Photon "held" effects) and
//      on-hit effects (holy burst, blood drain, piercing thrust).
//   3. Boss AI goals for the three EntityJS bosses.
//   4. Boss bars for the bosses, shown to players within 48 blocks.
//
// Server scripts do not share scope with startup scripts, so this file
// has its own small helpers (KubeJS wrappers work fine here).
// Rhino: const/let are function-scoped, so functions use var. Top-level
// const names are shared across server scripts, so they are prefixed HKS.

const HKS = {
  summonKey: 'kubejs_summon',
  untilKey: 'kubejs_summon_until',
  bossBarRange: 48,
  photon: true,
  weapons: {
    'kubejs:excalibur': { fx: 'excalibur_held', trail: 'minecraft:end_rod', aura: 'gold' },
    'kubejs:clarent': { fx: 'clarent_held', trail: 'minecraft:soul_fire_flame', aura: 'red' },
    'kubejs:rhongomyniad': { fx: 'rhongomyniad_held', trail: 'minecraft:electric_spark', aura: 'blue' }
  },
  bosses: {
    'kubejs:fallen_paladin': { name: 'Mordred, the Fallen Paladin', color: 'RED' },
    'kubejs:lion_king': { name: 'Leonis, Lion King of the Holy Order', color: 'YELLOW' },
    'kubejs:archdemon_executor': { name: 'Balor, Archdemon Executor', color: 'PURPLE' }
  }
}

// ---------------------------------------------------------------------
// 0. Helpers
// ---------------------------------------------------------------------
function hksCmd(entity, command) {
  try { entity.server.runCommandSilent(command) } catch (e) { /* no server */ }
}

function hksFx(entity, name, autoRotate) {
  if (!HKS.photon) return
  hksCmd(entity, `photon fx kubejs:${name} entity ${String(entity.getUUID())} 0 0 0 0 0 0 1 1 1 0 false false ${autoRotate || 'none'}`)
}

function hksFxRemove(entity, name) {
  if (!HKS.photon) return
  hksCmd(entity, `photon fx remove entity ${String(entity.getUUID())} false kubejs:${name}`)
}

function hksParticles(entity, id, x, y, z, dx, dy, dz, count, speed) {
  try { entity.level.spawnParticles(id, true, x, y, z, dx, dy, dz, count, speed) } catch (e) { /* ignore */ }
}

function hksSound(entity, id, volume, pitch) {
  hksCmd(entity, `playsound ${id} player @a ${entity.x.toFixed(1)} ${entity.y.toFixed(1)} ${entity.z.toFixed(1)} ${volume || 1} ${pitch || 1}`)
}

function hksEffect(target, id, ticks, amplifier) {
  try { target.potionEffects.add(id, ticks, amplifier || 0, false, true) } catch (e) { /* ignore */ }
}

function hksHurt(source, target, amount) {
  if (!target || !(amount > 0)) return
  try { target.invulnerableTime = 0 } catch (e) { /* ignore */ }
  try { target.attack(source.level.damageSources().indirectMagic(source, source), amount); return } catch (e) { /* fall back */ }
  try { target.attack(amount) } catch (e2) { /* ignore */ }
}

function hksLivingNear(entity, radius) {
  var out = []
  try {
    var box = AABB.of(entity.x - radius, entity.y - radius, entity.z - radius, entity.x + radius, entity.y + radius, entity.z + radius)
    var list = entity.level.getEntities(entity, box)
    for (var i = 0; i < list.size(); i++) {
      var e = list.get(i)
      if (!e.isLiving() || !e.isAlive() || e.isPlayer()) continue
      if (e.distanceToSqr(entity) > radius * radius) continue
      out.push(e)
    }
  } catch (e) { /* ignore */ }
  return out
}

function hksSummonUntil(stack) {
  try {
    if (!stack || stack.isEmpty()) return -1
    var data = stack.get('minecraft:custom_data')
    if (!data || !data.contains(HKS.untilKey)) return -1
    return Number(data.copyTag().getLong(HKS.untilKey))
  } catch (e) {
    return -1
  }
}

function hksHeldWeapon(player) {
  try {
    var id = String(player.mainHandItem.id)
    return HKS.weapons[id] ? id : null
  } catch (e) { return null }
}

// ---------------------------------------------------------------------
// 1. Summoned weapons: expiry, no dropping
// ---------------------------------------------------------------------
PlayerEvents.tick(event => {
  var player = event.player
  if (!player || player.level.isClientSide()) return
  var t = player.tickCount

  // Held-weapon passives every 10 ticks.
  if (t % 10 === 0) {
    var held = hksHeldWeapon(player)
    var data = player.persistentData
    var previous = data.contains('hkHeldWeapon') ? String(data.getString('hkHeldWeapon')) : ''
    if (held !== previous) {
      if (previous && HKS.weapons[previous]) hksFxRemove(player, HKS.weapons[previous].fx)
      if (held) hksFx(player, HKS.weapons[held].fx, 'none')
      data.putString('hkHeldWeapon', held || '')
    }
    if (held) {
      var w = HKS.weapons[held]
      var a = t * 0.3
      hksParticles(player, w.trail, player.x + Math.cos(a) * 0.7, player.y + 1 + Math.sin(a * 0.7) * 0.4, player.z + Math.sin(a) * 0.7, 0, 0, 0, 1, 0)
      if (t % 40 === 0) {
        if (held === 'kubejs:excalibur') hksEffect(player, 'minecraft:absorption', 60, 0)
        if (held === 'kubejs:clarent') hksEffect(player, 'minecraft:strength', 60, 0)
        if (held === 'kubejs:rhongomyniad') hksEffect(player, 'minecraft:speed', 60, 0)
      }
    }
  }

  // Expiry sweep every 40 ticks.
  if (t % 40 !== 0) return
  var time = Number(player.level.getGameTime())
  try {
    var inv = player.inventory
    for (var i = 0; i < inv.slots; i++) {
      var stack = inv.getStackInSlot(i)
      var until = hksSummonUntil(stack)
      if (until >= 0 && until < time) {
        inv.setStackInSlot(i, Item.empty)
        player.tell('§7Your summoned weapon fades back into light.')
        hksParticles(player, 'minecraft:end_rod', player.x, player.y + 1, player.z, 0.4, 0.6, 0.4, 25, 0.05)
      }
    }
  } catch (e) {
    // inventory unavailable this tick
  }
})

// A summoned weapon cannot be thrown away; it is dismissed with its skill.
ItemEvents.dropped(event => {
  if (hksSummonUntil(event.item) >= 0) {
    event.cancel()
    try { event.entity.tell('§7A summoned weapon cannot be discarded. Press the skill again to dismiss it.') } catch (e) { /* ignore */ }
  }
})

// ---------------------------------------------------------------------
// 2. Weapon on-hit effects
// ---------------------------------------------------------------------
EntityEvents.afterHurt(event => {
  var victim = event.entity
  if (!victim || victim.level.isClientSide()) return
  var attacker = null
  try { attacker = event.source.getEntity() } catch (e) { return }
  if (!attacker || !attacker.isPlayer()) return
  // Only direct melee hits (attacker is also the direct entity).
  try { if (!attacker.equals(event.source.getDirectEntity())) return } catch (e) { return }
  var held = hksHeldWeapon(attacker)
  if (!held) return
  var dmg = Number(event.damage)
  var x = victim.x, y = victim.y + 1, z = victim.z

  if (held === 'kubejs:excalibur') {
    // Holy burst: bonus vs undead, light explosion, 25% chance of a crescent hitting nearby foes.
    hksParticles(attacker, 'minecraft:end_rod', x, y, z, 0.4, 0.5, 0.4, 16, 0.15)
    hksParticles(attacker, 'minecraft:firework', x, y, z, 0.3, 0.3, 0.3, 6, 0.1)
    if (victim.isUndead()) { hksHurt(attacker, victim, 6); hksParticles(attacker, 'minecraft:flash', x, y, z, 0, 0, 0, 1, 0) }
    if (Math.random() < 0.25) {
      hksSound(attacker, 'minecraft:entity.player.attack.sweep', 1, 1.6)
      var near = hksLivingNear(victim, 4)
      for (var i = 0; i < near.length; i++) {
        if (near[i].equals(victim)) continue
        hksHurt(attacker, near[i], Math.max(4, dmg * 0.5))
        hksParticles(attacker, 'minecraft:sweep_attack', near[i].x, near[i].y + 1, near[i].z, 0, 0, 0, 1, 0)
      }
    }
  } else if (held === 'kubejs:clarent') {
    // Blood drain: heal 25% of damage, wither, crimson spray.
    try { attacker.heal(Math.min(6, dmg * 0.25)) } catch (e) { /* ignore */ }
    hksEffect(victim, 'minecraft:wither', 60, 0)
    hksParticles(attacker, 'minecraft:crimson_spore', x, y, z, 0.4, 0.5, 0.4, 20, 0.2)
    hksParticles(attacker, 'minecraft:damage_indicator', x, y, z, 0.3, 0.3, 0.3, 6, 0.1)
    hksParticles(attacker, 'minecraft:soul_fire_flame', attacker.x, attacker.y + 1, attacker.z, 0.3, 0.4, 0.3, 6, 0.05)
  } else if (held === 'kubejs:rhongomyniad') {
    // Piercing thrust: everything in a 5-block line behind the victim takes 60%, all are slowed.
    var dx = victim.x - attacker.x, dz = victim.z - attacker.z
    var d = Math.sqrt(dx * dx + dz * dz) || 1
    dx /= d; dz /= d
    hksEffect(victim, 'minecraft:slowness', 30, 1)
    var near = hksLivingNear(victim, 6)
    for (var k = 0; k < near.length; k++) {
      var e = near[k]
      if (e.equals(victim)) continue
      var ex = e.x - victim.x, ez = e.z - victim.z
      var along = ex * dx + ez * dz
      var perp = Math.abs(ex * dz - ez * dx)
      if (along > 0 && along <= 5 && perp <= 1.2) {
        hksHurt(attacker, e, Math.max(3, dmg * 0.6))
        hksEffect(e, 'minecraft:slowness', 30, 1)
        hksParticles(attacker, 'minecraft:electric_spark', e.x, e.y + 1, e.z, 0.3, 0.4, 0.3, 10, 0.1)
      }
    }
    for (var s = 0; s <= 5; s++) hksParticles(attacker, 'minecraft:end_rod', victim.x + dx * s, y, victim.z + dz * s, 0.1, 0.2, 0.1, 2, 0.02)
    hksSound(attacker, 'minecraft:item.trident.hit', 1, 1.4)
  }
})

// ---------------------------------------------------------------------
// 3. Boss AI
// ---------------------------------------------------------------------
var hksPlayerClass = null
try { hksPlayerClass = Java.loadClass('net.minecraft.world.entity.player.Player') } catch (e) { hksPlayerClass = null }

function hksKnightGoals(id, speed) {
  EntityJSEvents.addGoalSelectors(id, event => {
    event.floatSwim(0)
    event.meleeAttack(2, speed, true)
    event.waterAvoidingRandomStroll(5, 0.8, 0.02)
    if (hksPlayerClass) event.lookAtEntity(6, hksPlayerClass, 12.0, 1.0, false)
    event.randomLookAround(7)
  })
  EntityJSEvents.addGoals(id, event => {
    event.hurtByTarget(1, [], true, [])
    if (hksPlayerClass) event.nearestAttackableTarget(2, hksPlayerClass, 10, true, false, null)
  })
}

hksKnightGoals('kubejs:fallen_paladin', 1.15)
hksKnightGoals('kubejs:lion_king', 1.05)
hksKnightGoals('kubejs:archdemon_executor', 1.1)

// ---------------------------------------------------------------------
// 4. Boss bars (vanilla ServerBossEvent, tracked per boss UUID)
// ---------------------------------------------------------------------
var hksBossBars = {}     // uuid -> { bar: ServerBossEvent, typeId: string }
var hksTracked = []      // uuids of live bosses

function hksBossClasses() {
  try {
    return {
      bar: Java.loadClass('net.minecraft.server.level.ServerBossEvent'),
      color: Java.loadClass('net.minecraft.world.BossEvent$BossBarColor'),
      overlay: Java.loadClass('net.minecraft.world.BossEvent$BossBarOverlay')
    }
  } catch (e) {
    console.warn(`[holy_knight_server] boss bars unavailable: ${e}`)
    return null
  }
}

function hksTrack(entity) {
  var id = String(entity.getUUID())
  if (hksTracked.indexOf(id) < 0) hksTracked.push(id)
}

function hksRemoveBar(id) {
  var rec = hksBossBars[id]
  if (rec) {
    try { rec.bar.removeAllPlayers() } catch (e) { /* ignore */ }
    delete hksBossBars[id]
  }
  var idx = hksTracked.indexOf(id)
  if (idx >= 0) hksTracked.splice(idx, 1)
}

EntityEvents.spawned('kubejs:fallen_paladin', event => hksTrack(event.entity))
EntityEvents.spawned('kubejs:lion_king', event => hksTrack(event.entity))
EntityEvents.spawned('kubejs:archdemon_executor', event => hksTrack(event.entity))

ServerEvents.tick(event => {
  var server = event.server
  if (server.tickCount % 10 !== 0 || hksTracked.length === 0) return
  var classes = hksBossClasses()
  if (!classes) { hksTracked = []; return }

  var ids = hksTracked.slice()
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i]
    var boss = null
    try { boss = server.getEntityByUUID(id) } catch (e) { boss = null }
    if (!boss || !boss.isAlive()) { hksRemoveBar(id); continue }
    var info = HKS.bosses[String(boss.type)]
    if (!info) { hksRemoveBar(id); continue }

    var rec = hksBossBars[id]
    if (!rec) {
      try {
        var bar = new classes.bar(Text.string(info.name), classes.color[info.color], classes.overlay.NOTCHED_10)
        bar.setDarkenScreen(false)
        rec = { bar: bar, typeId: String(boss.type) }
        hksBossBars[id] = rec
      } catch (e) {
        console.warn(`[holy_knight_server] could not create boss bar: ${e}`)
        hksRemoveBar(id)
        continue
      }
    }
    try { rec.bar.setProgress(Math.max(0, Math.min(1, boss.health / boss.getMaxHealth()))) } catch (e) { /* ignore */ }

    var players = server.players
    var range = HKS.bossBarRange * HKS.bossBarRange
    for (var p = 0; p < players.size(); p++) {
      var player = players.get(p)
      var near = false
      try { near = String(player.level.dimension) == String(boss.level.dimension) && player.distanceToSqr(boss) <= range } catch (e) { near = false }
      try {
        if (near) rec.bar.addPlayer(player)
        else rec.bar.removePlayer(player)
      } catch (e) { /* ignore */ }
    }
  }
})

ServerEvents.unloaded(event => {
  var ids = Object.keys(hksBossBars)
  for (var i = 0; i < ids.length; i++) hksRemoveBar(ids[i])
})
