// priority: 90
//
// kubejs/server_scripts/holy_knight_server.js
// --------------------------------------------
// Server-side half of the holy-knight content pack:
//   1. Summoned weapons (Excalibur / Clarent / Rhongomyniad) expire on
//      time and cannot be dropped.
//   2. Boss AI goals for the three EntityJS bosses.
//   3. Boss bars for the bosses, shown to players within 48 blocks.
//
// Rhino: const/let are function-scoped, so functions use var. Top-level
// const names are shared across server scripts, so they are prefixed HKS.

const HKS = {
  summonKey: 'kubejs_summon',
  untilKey: 'kubejs_summon_until',
  bossBarRange: 48,
  bosses: {
    'kubejs:fallen_paladin': { name: 'Mordred, the Fallen Paladin', color: 'RED' },
    'kubejs:lion_king': { name: 'Leonis, Lion King of the Holy Order', color: 'YELLOW' },
    'kubejs:archdemon_executor': { name: 'Balor, Archdemon Executor', color: 'PURPLE' }
  }
}

// ---------------------------------------------------------------------
// 1. Summoned weapons
// ---------------------------------------------------------------------
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

PlayerEvents.tick(event => {
  var player = event.player
  if (!player || player.level.isClientSide() || player.tickCount % 40 !== 0) return
  var time = Number(player.level.getGameTime())
  try {
    var inv = player.inventory
    for (var i = 0; i < inv.slots; i++) {
      var stack = inv.getStackInSlot(i)
      var until = hksSummonUntil(stack)
      if (until >= 0 && until < time) {
        inv.setStackInSlot(i, Item.empty)
        player.tell('§7Your summoned weapon fades back into light.')
        player.level.spawnParticles('minecraft:end_rod', true, player.x, player.y + 1, player.z, 0.4, 0.6, 0.4, 25, 0.05)
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
// 2. Boss AI
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
// 3. Boss bars (vanilla ServerBossEvent, tracked per boss UUID)
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
