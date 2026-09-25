// priority: 90
//
// kubejs/startup_scripts/holy_knight_content.js
// ----------------------------------------------
// Holy-knight / demonic content pack built on TensurJS (tensura_kubejs):
//
//   Weapons (summoned, temporary): kubejs:excalibur, kubejs:clarent,
//                                  kubejs:rhongomyniad
//   Boss drops (permanent):         kubejs:holy_grail, kubejs:demon_heart
//   Skills   holy    : divine_smite (common), wall_of_the_kingdom (extra),
//                      invisible_air (extra), kings_decree (unique),
//                      excalibur_summon (unique), rhongomyniad_summon (unique),
//                      excalibur_release (ULTIMATE), lance_of_the_ending (ULTIMATE),
//                      avalon (ULTIMATE)
//            demonic : blood_pact (common), hellfire_brand (extra),
//                      sovereigns_pressure (unique), clarent_summon (unique),
//                      clarent_blood_arthur (ULTIMATE)
//   Races    holy    : squire -> holy_knight -> paladin_king -> divine_sovereign
//            demonic : fallen_squire -> fallen_knight -> demon_knight -> demon_king
//
// The matching server script (holy_knight_server.js) expires summoned
// weapons, stops them being dropped, and runs the boss logic.
//
// TensurJS API notes (see docs/SESSION_HANDOFF.md §2):
//   event.create('ns:id') with no type argument; .type('extra'|'unique'|'ultimate'...)
//   ctx.entity / ctx.instance / ctx.isToggled() / ctx.consumeMagicule(n) / ctx.tell()
//   damage ctx: ctx.source, ctx.amount(), ctx.setAmount(f); return false = cancel
//   onHeld(ctx) -> true keeps holding; ctx.heldTicks; onRelease(ctx) fires after.
// Rhino: const/let are function-scoped, so functions use var.

// =====================================================================
// 0. Shared helpers
// =====================================================================
const HK = {
  magicDamage: 'indirectMagic',
  summonKey: 'kubejs_summon',
  summonUntilKey: 'kubejs_summon_until',
  lso: {
    bodyDamageUtil: 'sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyDamageUtil',
    bodyPartEnum: 'sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyPartEnum'
  }
}

var _hkClasses = {}
function hkClass(name) {
  if (_hkClasses[name] !== undefined) return _hkClasses[name]
  var c = null
  try { c = Java.loadClass(name) } catch (e) { c = null }
  _hkClasses[name] = c
  return c
}

function isServerLiving(entity) {
  return entity && entity.isLiving() && !entity.level.isClientSide()
}

function mastered(ctx) {
  return ctx.instance.isMastered(ctx.entity)
}

function now(entity) {
  return Number(entity.level.getGameTime())
}

function cmd(entity, command) {
  try {
    var server = entity.server
    if (server) server.runCommandSilent(command)
  } catch (e) {
    // no server on this side
  }
}

function sound(entity, id, volume, pitch) {
  cmd(entity, `playsound ${id} player @a ${entity.x.toFixed(1)} ${entity.y.toFixed(1)} ${entity.z.toFixed(1)} ${volume || 1} ${pitch || 1}`)
}

function particles(entity, id, x, y, z, dx, dy, dz, count, speed) {
  try {
    entity.level.spawnParticles(id, true, x, y, z, dx, dy, dz, count, speed)
  } catch (e) {
    // particle id unknown
  }
}

function hurt(source, target, amount) {
  try {
    target.attack(source.level.damageSources().indirectMagic(source, source), amount)
  } catch (e) {
    try { target.attack(amount) } catch (e2) { /* ignore */ }
  }
}

function ignite(target, seconds) {
  try { target.igniteForSeconds(seconds); return } catch (e) { /* pre-1.21 name */ }
  try { target.setSecondsOnFire(seconds) } catch (e) { /* ignore */ }
}

function effect(target, id, ticks, amplifier) {
  try { target.potionEffects.add(id, ticks, amplifier, false, true) } catch (e) { /* ignore */ }
}

function removeEffect(target, id) {
  try { if (target.potionEffects.isActive(id)) target.removeEffect(id) } catch (e) { /* ignore */ }
}

function livingNear(entity, radius, includeSelf) {
  var out = []
  try {
    var box = AABB.of(entity.x - radius, entity.y - radius, entity.z - radius, entity.x + radius, entity.y + radius, entity.z + radius)
    var list = entity.level.getEntities(entity, box)
    for (var i = 0; i < list.size(); i++) {
      var e = list.get(i)
      if (!e.isLiving() || !e.isAlive()) continue
      if (e.distanceToSqr(entity) > radius * radius) continue
      out.push(e)
    }
  } catch (e) {
    return out
  }
  if (includeSelf) out.push(entity)
  return out
}

function hostilesNear(entity, radius) {
  var all = livingNear(entity, radius, false)
  var out = []
  for (var i = 0; i < all.length; i++) {
    if (all[i].isPlayer()) continue
    out.push(all[i])
  }
  return out
}

function isPlayerAlly(entity, other) {
  return other.isPlayer() && !other.equals(entity)
}

function inCone(entity, target, range, halfAngleDeg) {
  var dx = target.x - entity.x
  var dz = target.z - entity.z
  var dist = Math.sqrt(dx * dx + dz * dz)
  if (dist > range) return false
  if (dist < 0.01) return true
  var look = entity.getLookAngle()
  var lx = Number(look.x()), lz = Number(look.z())
  var ll = Math.sqrt(lx * lx + lz * lz) || 1
  var dot = (dx * lx + dz * lz) / (dist * ll)
  return dot >= Math.cos(halfAngleDeg * Math.PI / 180)
}

function push(target, fromX, fromZ, strength, up) {
  var dx = target.x - fromX
  var dz = target.z - fromZ
  var d = Math.sqrt(dx * dx + dz * dz) || 1
  try {
    target.setMotionX(dx / d * strength)
    target.setMotionY(up)
    target.setMotionZ(dz / d * strength)
    target.hurtMarked = true
  } catch (e) { /* ignore */ }
}

// Full heal including every LSO limb (used by Avalon and the sovereign race).
function fullRestore(entity) {
  try { entity.setHealth(entity.getMaxHealth()) } catch (e) { /* ignore */ }
  var body = hkClass(HK.lso.bodyDamageUtil)
  var parts = hkClass(HK.lso.bodyPartEnum)
  if (!body || !parts || !entity.isPlayer()) return
  try {
    var values = parts.values()
    for (var i = 0; i < values.length; i++) {
      var max = Number(body.getMaxHealth(entity, values[i]))
      var ratio = Number(body.getHealthRatio(entity, values[i]))
      if (!isNaN(max) && !isNaN(ratio) && ratio < 1) body.healBodyPart(entity, values[i], max * (1 - ratio) + 0.01)
    }
  } catch (e) { /* LSO missing */ }
}

// --- summoned weapons ------------------------------------------------
function summonedCount(player, weaponId) {
  var n = 0
  try {
    var inv = player.inventory
    for (var i = 0; i < inv.slots; i++) {
      var stack = inv.getStackInSlot(i)
      if (!stack.isEmpty() && stack.id == weaponId && isSummoned(stack)) n++
    }
  } catch (e) { /* ignore */ }
  return n
}

function isSummoned(stack) {
  try {
    var data = stack.get('minecraft:custom_data')
    return data != null && data.contains(HK.summonKey)
  } catch (e) {
    return false
  }
}

function dismissWeapon(player, weaponId) {
  try {
    var inv = player.inventory
    for (var i = 0; i < inv.slots; i++) {
      var stack = inv.getStackInSlot(i)
      if (!stack.isEmpty() && stack.id == weaponId && isSummoned(stack)) inv.setStackInSlot(i, Item.empty)
    }
  } catch (e) { /* ignore */ }
}

function holdsWeapon(entity, weaponId) {
  try { return entity.mainHandItem.id == weaponId } catch (e) { return false }
}

// Shared summon-skill behaviour: press once to summon, press again to dismiss.
function summonSkill(ctx, weaponId, label, cost, durationTicks, masteredBonusTicks, color) {
  var player = ctx.entity
  if (!isServerLiving(player) || !player.isPlayer()) return
  if (summonedCount(player, weaponId) > 0) {
    dismissWeapon(player, weaponId)
    ctx.tell(`${label} returns to the light.`)
    particles(player, 'minecraft:end_rod', player.x, player.y + 1, player.z, 0.4, 0.6, 0.4, 30, 0.05)
    return
  }
  if (ctx.cooldown() > 0) { ctx.tell(`${label} is not ready.`); return }
  if (!ctx.consumeMagicule(cost)) { ctx.tell('Not enough magicules.'); return }
  var duration = durationTicks + (mastered(ctx) ? masteredBonusTicks : 0)
  var until = now(player) + duration
  var stack = Item.of(`${weaponId}[custom_data={${HK.summonKey}:"${weaponId}",${HK.summonUntilKey}:${until}L}]`)
  player.giveInHand(stack)
  ctx.setCooldown(5)
  ctx.tell(`${label} answers your call (${Math.round(duration / 20)}s).`)
  sound(player, 'minecraft:block.beacon.activate', 1, color == 'red' ? 0.6 : 1.4)
  sound(player, 'minecraft:item.trident.thunder', 0.6, color == 'red' ? 0.7 : 1.3)
  particles(player, color == 'red' ? 'minecraft:soul_fire_flame' : 'minecraft:end_rod', player.x, player.y + 1.2, player.z, 0.6, 0.8, 0.6, 80, 0.15)
  particles(player, 'minecraft:flash', player.x, player.y + 1.2, player.z, 0, 0, 0, 1, 0)
  ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
}

// =====================================================================
// 1. Weapons
// =====================================================================
StartupEvents.registry('item', event => {
  event.create('kubejs:excalibur', 'sword')
    .tier('netherite')
    .attackDamageBaseline(12)
    .speedBaseline(-2.4)
    .displayName('Excalibur, Sword of Promised Victory')
    .rarity('epic')
    .unstackable()
    .fireResistant()

  event.create('kubejs:clarent', 'sword')
    .tier('netherite')
    .attackDamageBaseline(11)
    .speedBaseline(-2.2)
    .displayName('Clarent, Blood Arthur')
    .rarity('epic')
    .unstackable()
    .fireResistant()

  event.create('kubejs:rhongomyniad', 'sword')
    .tier('netherite')
    .attackDamageBaseline(10)
    .speedBaseline(-2.8)
    .displayName('Rhongomyniad, Lance of the Ending')
    .rarity('epic')
    .unstackable()
    .fireResistant()

  event.create('kubejs:holy_grail')
    .displayName('Holy Grail')
    .rarity('epic')
    .maxStackSize(1)

  event.create('kubejs:demon_heart')
    .displayName('Archdemon Heart')
    .rarity('epic')
    .maxStackSize(1)
})

// =====================================================================
// 2. Skills
// =====================================================================
StartupEvents.registry(TensuraKubeJS.SKILL_REGISTRY, event => {

  // -------------------------------------------------------------------
  // HOLY
  // -------------------------------------------------------------------

  // Divine Smite (Common): a bolt of holy light on the target you look at.
  event.create('kubejs:divine_smite')
    .name('Divine Smite')
    .description('Call down a pillar of holy light on the creature you are looking at (20 blocks). 15 holy damage, doubled against the undead. Costs 150 magicules, 6 s cooldown.')
    .type('common')
    .icon('kubejs:skill/holy/divine_smite')
    .onPressed(ctx => {
      var player = ctx.entity
      if (!isServerLiving(player)) return
      if (ctx.cooldown() > 0) return
      var target = null
      try { target = player.rayTraceEntity(20, e => e.isLiving() && !e.equals(player)) } catch (e) { target = null }
      if (!target) { ctx.tell('No target in sight.'); return }
      if (!ctx.consumeMagicule(150)) { ctx.tell('Not enough magicules.'); return }
      var dmg = mastered(ctx) ? 22 : 15
      if (target.isUndead()) dmg *= 2
      try { player.level.spawnLightning(target.x, target.y, target.z, true) } catch (e) { /* ignore */ }
      particles(player, 'minecraft:end_rod', target.x, target.y + 1, target.z, 0.3, 1.5, 0.3, 60, 0.1)
      sound(player, 'minecraft:entity.lightning_bolt.impact', 0.8, 1.6)
      hurt(player, target, dmg)
      effect(target, 'minecraft:glowing', 100, 0)
      ctx.setCooldown(mastered(ctx) ? 4 : 6)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
    })

  // Wall of the Kingdom (Extra): magicule-fed damage reduction.
  event.create('kubejs:wall_of_the_kingdom')
    .name('Wall of the Kingdom')
    .description('Toggle. Your resolve becomes a wall: incoming damage is reduced by 35% (50% mastered), and each blocked hit costs magicules equal to four times the damage prevented. Turns off when your magicules run out.')
    .type('extra')
    .icon('kubejs:skill/holy/wall_of_the_kingdom')
    .canBeToggled(true)
    .canTick(ctx => ctx.isToggled())
    .onTick(ctx => {
      if (!isServerLiving(ctx.entity) || ctx.entity.tickCount % 100 != 0) return
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, ctx.entity)
    })
    .onTakenDamage(ctx => {
      if (!ctx.isToggled()) return true
      var amount = Number(ctx.amount())
      if (isNaN(amount) || amount <= 0) return true
      var reduction = mastered(ctx) ? 0.5 : 0.35
      var prevented = amount * reduction
      if (!ctx.consumeMagicule(prevented * 4)) {
        ctx.instance.setToggled(false)
        ctx.instance.markDirty()
        ctx.tell('Wall of the Kingdom collapses: out of magicules.')
        return true
      }
      ctx.setAmount(amount - prevented)
      particles(ctx.entity, 'minecraft:enchanted_hit', ctx.entity.x, ctx.entity.y + 1, ctx.entity.z, 0.5, 0.6, 0.5, 12, 0.1)
      return true
    })

  // Invisible Air (Extra): wind barrier that shoves enemies back and blunts projectiles.
  event.create('kubejs:invisible_air')
    .name('Invisible Air: Barrier of the Wind King')
    .description('Toggle. A sheath of compressed wind pushes hostile creatures away every half second, blunts projectiles by 75% and grants Speed. Drains 3 magicules per second.')
    .type('extra')
    .icon('kubejs:skill/holy/invisible_air')
    .canBeToggled(true)
    .canTick(ctx => ctx.isToggled())
    .onToggleOff(ctx => removeEffect(ctx.entity, 'minecraft:speed'))
    .onTick(ctx => {
      var player = ctx.entity
      if (!isServerLiving(player)) return
      var t = player.tickCount
      if (t % 20 == 0) {
        if (!ctx.consumeMagicule(3)) {
          ctx.instance.setToggled(false)
          ctx.instance.onToggleOff(player)
          ctx.instance.markDirty()
          ctx.tell('Invisible Air disperses: out of magicules.')
          return
        }
        effect(player, 'minecraft:speed', 40, mastered(ctx) ? 1 : 0)
        if (t % 200 == 0) ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
      }
      if (t % 10 == 0) {
        var mobs = hostilesNear(player, mastered(ctx) ? 5 : 4)
        for (var i = 0; i < mobs.length; i++) push(mobs[i], player.x, player.z, 0.6, 0.15)
        particles(player, 'minecraft:cloud', player.x, player.y + 0.8, player.z, 1.2, 0.6, 1.2, 6, 0.02)
      }
    })
    .onTakenDamage(ctx => {
      if (!ctx.isToggled()) return true
      try {
        var direct = ctx.source.getDirectEntity()
        var owner = ctx.source.getEntity()
        if (direct && owner && !direct.equals(owner)) ctx.setAmount(Number(ctx.amount()) * 0.25) // projectile
      } catch (e) { /* ignore */ }
      return true
    })

  // Lord of the Kingdom (Unique): royal aura that empowers nearby players.
  event.create('kubejs:kings_decree')
    .name('Lord of the Kingdom')
    .description('Toggle. A royal aura grants you and every player within 12 blocks Strength, Resistance and Absorption. Mastered: Strength II. Drains 5 magicules every 2 seconds.')
    .type('unique')
    .icon('kubejs:skill/holy/kings_decree')
    .canBeToggled(true)
    .canTick(ctx => ctx.isToggled())
    .onTick(ctx => {
      var player = ctx.entity
      if (!isServerLiving(player) || player.tickCount % 40 != 0) return
      if (!ctx.consumeMagicule(5)) {
        ctx.instance.setToggled(false)
        ctx.instance.markDirty()
        ctx.tell('The royal aura fades: out of magicules.')
        return
      }
      var allies = livingNear(player, 12, true)
      for (var i = 0; i < allies.length; i++) {
        if (!allies[i].isPlayer()) continue
        effect(allies[i], 'minecraft:strength', 60, mastered(ctx) ? 1 : 0)
        effect(allies[i], 'minecraft:resistance', 60, 0)
        effect(allies[i], 'minecraft:absorption', 60, 0)
      }
      particles(player, 'minecraft:end_rod', player.x, player.y + 0.2, player.z, 3, 0.2, 3, 20, 0.01)
      if (player.tickCount % 400 == 0) ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
    })

  // Summon skills.
  event.create('kubejs:excalibur_summon')
    .name('Sword of Promised Victory')
    .description('Summon Excalibur into your hand for 2 minutes (4 mastered). Press again to dismiss it. Summoned blades cannot be dropped and fade when their time ends. Costs 900 magicules.')
    .type('unique')
    .icon('kubejs:skill/holy/excalibur_summon')
    .onPressed(ctx => summonSkill(ctx, 'kubejs:excalibur', 'Excalibur', 900, 2400, 2400, 'gold'))

  event.create('kubejs:rhongomyniad_summon')
    .name('Lance That Shines to the Ends of the World')
    .description('Summon Rhongomyniad into your hand for 2 minutes (4 mastered). Press again to dismiss it. Costs 900 magicules.')
    .type('unique')
    .icon('kubejs:skill/holy/rhongomyniad_summon')
    .onPressed(ctx => summonSkill(ctx, 'kubejs:rhongomyniad', 'Rhongomyniad', 900, 2400, 2400, 'gold'))

  // EXCALIBUR (Ultimate): hold to charge, release to fire the light of the ending.
  event.create('kubejs:excalibur_release')
    .name('Excalibur: Light of the Ending')
    .description('ULTIMATE. Hold to gather light for up to 3 seconds, release to unleash a 40-block beam of holy fire that devastates everything in its path (up to 60 damage, 100 mastered, doubled against the undead). Full power needs Excalibur in hand. Costs 2500 magicules, 45 s cooldown.')
    .type('ultimate')
    .icon('kubejs:skill/holy/excalibur_release')
    .maxHeldTime(60)
    .onHeld(ctx => {
      var player = ctx.entity
      if (!isServerLiving(player)) return false
      if (ctx.cooldown() > 0) { if (ctx.heldTicks == 1) ctx.tell('Excalibur is not ready.'); return false }
      var h = ctx.heldTicks
      if (h % 4 == 0) {
        var ring = Math.min(3, h / 20)
        for (var a = 0; a < 12; a++) {
          var ang = a * Math.PI / 6 + h * 0.2
          particles(player, 'minecraft:end_rod', player.x + Math.cos(ang) * ring, player.y + 1 + (h / 60), player.z + Math.sin(ang) * ring, 0, 0, 0, 1, 0)
        }
        if (h % 20 == 0) sound(player, 'minecraft:block.beacon.ambient', 1, 0.8 + h / 60)
      }
      ctx.instance.getOrCreateTag().putInt('charge', h)
      return true
    })
    .onRelease(ctx => {
      var player = ctx.entity
      if (!isServerLiving(player)) return
      if (ctx.cooldown() > 0) return
      var charge = Math.min(60, ctx.instance.getOrCreateTag().getInt('charge'))
      ctx.instance.getOrCreateTag().putInt('charge', 0)
      if (charge < 10) { ctx.tell('The light dissipates. Hold longer.'); return }
      if (!ctx.consumeMagicule(2500)) { ctx.tell('Not enough magicules.'); return }
      var power = charge / 60
      var base = mastered(ctx) ? 100 : 60
      if (!holdsWeapon(player, 'kubejs:excalibur')) base *= 0.5
      var dmg = base * (0.4 + 0.6 * power)
      var look = player.getLookAngle()
      var lx = Number(look.x()), ly = Number(look.y()), lz = Number(look.z())
      var ox = player.x, oy = player.y + 1.4, oz = player.z
      var hit = {}
      var victims = livingNear(player, 42, false)
      for (var step = 1; step <= 40; step++) {
        var px = ox + lx * step, py = oy + ly * step, pz = oz + lz * step
        particles(player, 'minecraft:end_rod', px, py, pz, 0.3, 0.3, 0.3, 6, 0.02)
        if (step % 2 == 0) particles(player, 'minecraft:firework', px, py, pz, 0.6, 0.6, 0.6, 3, 0.05)
        for (var v = 0; v < victims.length; v++) {
          var e = victims[v]
          var key = String(e.getUUID())
          if (hit[key]) continue
          var dx = e.x - px, dy = (e.y + e.getBbHeight() / 2) - py, dz = e.z - pz
          if (dx * dx + dy * dy + dz * dz <= 6.25) {
            hit[key] = true
            hurt(player, e, e.isUndead() ? dmg * 2 : dmg)
            effect(e, 'minecraft:glowing', 100, 0)
            push(e, px - lx * 2, pz - lz * 2, 1.2, 0.5)
          }
        }
      }
      sound(player, 'minecraft:item.trident.thunder', 1, 0.5)
      sound(player, 'minecraft:entity.generic.explode', 1, 1.6)
      sound(player, 'minecraft:block.beacon.power_select', 1, 0.6)
      cmd(player, `title @a[distance=..48] title {"text":"EXCALIBUR","color":"gold","bold":true}`)
      ctx.setCooldown(mastered(ctx) ? 30 : 45)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
    })

  // Lance of the Ending (Ultimate): a piercing dash of light.
  event.create('kubejs:lance_of_the_ending')
    .name('Rhongomyniad: Lance of the Ending')
    .description('ULTIMATE. Become a spear of light: dash 12 blocks forward, striking everything along the path for 35 damage (55 mastered) and pinning survivors in place. Full power needs Rhongomyniad in hand. Costs 1500 magicules, 25 s cooldown.')
    .type('ultimate')
    .icon('kubejs:skill/holy/lance_of_the_ending')
    .onPressed(ctx => {
      var player = ctx.entity
      if (!isServerLiving(player)) return
      if (ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(1500)) { ctx.tell('Not enough magicules.'); return }
      var dmg = mastered(ctx) ? 55 : 35
      if (!holdsWeapon(player, 'kubejs:rhongomyniad')) dmg *= 0.5
      var look = player.getLookAngle()
      var lx = Number(look.x()), lz = Number(look.z())
      var l = Math.sqrt(lx * lx + lz * lz) || 1
      lx /= l; lz /= l
      var reach = 0
      for (var step = 1; step <= 12; step++) {
        var bx = Math.floor(player.x + lx * step), by = Math.floor(player.y), bz = Math.floor(player.z + lz * step)
        var solid = false
        try { solid = !player.level.getBlock(bx, by, bz).blockState.isAir() || !player.level.getBlock(bx, by + 1, bz).blockState.isAir() } catch (e) { solid = true }
        if (solid) break
        reach = step
      }
      var victims = livingNear(player, 14, false)
      for (var s = 0; s <= reach; s++) {
        var px = player.x + lx * s, pz = player.z + lz * s
        particles(player, 'minecraft:end_rod', px, player.y + 1, pz, 0.4, 0.8, 0.4, 8, 0.05)
        for (var v = 0; v < victims.length; v++) {
          var e = victims[v]
          var dx = e.x - px, dz = e.z - pz
          if (dx * dx + dz * dz <= 4 && !e.persistentData.getBoolean('hkLanceHit')) {
            e.persistentData.putBoolean('hkLanceHit', true)
            hurt(player, e, dmg)
            effect(e, 'minecraft:slowness', 40, 4)
            effect(e, 'minecraft:glowing', 60, 0)
          }
        }
      }
      for (var c = 0; c < victims.length; c++) victims[c].persistentData.remove('hkLanceHit')
      if (reach > 0) player.teleportTo(player.x + lx * reach, player.y, player.z + lz * reach)
      sound(player, 'minecraft:entity.evoker.cast_spell', 1, 1.8)
      sound(player, 'minecraft:item.trident.riptide_3', 1, 1.2)
      ctx.setCooldown(mastered(ctx) ? 18 : 25)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
    })

  // Avalon (Ultimate): five seconds of untouchable sanctuary plus a full restore.
  event.create('kubejs:avalon')
    .name('Avalon: Ever-Distant Utopia')
    .description('ULTIMATE. Seal yourself in the fairy sanctuary: restore every limb and all health, purge harmful effects, and become untouchable for 5 seconds (8 mastered). Costs 4000 magicules, 3 minute cooldown.')
    .type('ultimate')
    .icon('kubejs:skill/holy/avalon')
    .onPressed(ctx => {
      var player = ctx.entity
      if (!isServerLiving(player)) return
      if (ctx.cooldown() > 0) { ctx.tell('Avalon is sealed.'); return }
      if (!ctx.consumeMagicule(4000)) { ctx.tell('Not enough magicules.'); return }
      var ticks = mastered(ctx) ? 160 : 100
      ctx.instance.getOrCreateTag().putLong('avalonUntil', now(player) + ticks)
      fullRestore(player)
      var bad = ['minecraft:poison', 'minecraft:wither', 'minecraft:slowness', 'minecraft:weakness', 'minecraft:blindness',
        'minecraft:darkness', 'minecraft:hunger', 'minecraft:nausea', 'minecraft:mining_fatigue', 'legendarysurvivaloverhaul:thirst',
        'legendarysurvivaloverhaul:heat_stroke', 'legendarysurvivaloverhaul:frostbite']
      for (var i = 0; i < bad.length; i++) removeEffect(player, bad[i])
      effect(player, 'minecraft:regeneration', ticks, 2)
      effect(player, 'minecraft:resistance', ticks, 4)
      particles(player, 'minecraft:end_rod', player.x, player.y + 1, player.z, 1.5, 1.5, 1.5, 150, 0.1)
      particles(player, 'minecraft:happy_villager', player.x, player.y + 1, player.z, 1.5, 1.5, 1.5, 60, 0.1)
      sound(player, 'minecraft:block.beacon.activate', 1, 1.8)
      sound(player, 'minecraft:entity.player.levelup', 1, 0.7)
      ctx.tell('The scabbard of the ever-distant utopia embraces you.')
      ctx.setCooldown(mastered(ctx) ? 120 : 180)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
    })
    .onBeingDamaged(ctx => {
      var until = ctx.instance.getOrCreateTag().getLong('avalonUntil')
      if (until > now(ctx.entity)) {
        particles(ctx.entity, 'minecraft:end_rod', ctx.entity.x, ctx.entity.y + 1, ctx.entity.z, 0.5, 0.8, 0.5, 10, 0.05)
        return false
      }
      return true
    })

  // -------------------------------------------------------------------
  // DEMONIC
  // -------------------------------------------------------------------

  // Blood Pact (Common): trade blood for power.
  event.create('kubejs:blood_pact')
    .name('Blood Pact')
    .description('Toggle. Every hit you land deals 25% more damage (40% mastered) but costs you 1 heart of blood. Cannot kill you.')
    .type('common')
    .icon('kubejs:skill/demonic/blood_pact')
    .canBeToggled(true)
    .onDamageEntity(ctx => {
      if (!ctx.isToggled()) return true
      var player = ctx.entity
      if (player.health <= 3) return true
      ctx.setAmount(Number(ctx.amount()) * (mastered(ctx) ? 1.4 : 1.25))
      try { player.setHealth(player.health - 2) } catch (e) { /* ignore */ }
      particles(player, 'minecraft:damage_indicator', player.x, player.y + 1, player.z, 0.3, 0.3, 0.3, 4, 0.1)
      if (player.tickCount % 5 == 0) ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
      return true
    })

  // Hellfire Brand (Extra): a cone of demonic flame.
  event.create('kubejs:hellfire_brand')
    .name('Hellfire Brand')
    .description('Breathe a 6-block cone of hellfire: 10 damage (16 mastered) and 8 seconds of burning to everything in front of you. Costs 300 magicules, 8 s cooldown.')
    .type('extra')
    .icon('kubejs:skill/demonic/hellfire_brand')
    .onPressed(ctx => {
      var player = ctx.entity
      if (!isServerLiving(player)) return
      if (ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(300)) { ctx.tell('Not enough magicules.'); return }
      var dmg = mastered(ctx) ? 16 : 10
      var look = player.getLookAngle()
      for (var s = 1; s <= 6; s++) {
        particles(player, 'minecraft:flame', player.x + Number(look.x()) * s, player.y + 1 + Number(look.y()) * s, player.z + Number(look.z()) * s, 0.25 * s, 0.25 * s, 0.25 * s, 12, 0.05)
        particles(player, 'minecraft:lava', player.x + Number(look.x()) * s, player.y + 1 + Number(look.y()) * s, player.z + Number(look.z()) * s, 0.2 * s, 0.2 * s, 0.2 * s, 2, 0.02)
      }
      var victims = livingNear(player, 7, false)
      for (var v = 0; v < victims.length; v++) {
        if (!inCone(player, victims[v], 6.5, 35)) continue
        hurt(player, victims[v], dmg)
        ignite(victims[v], 8)
      }
      sound(player, 'minecraft:entity.blaze.shoot', 1, 0.6)
      sound(player, 'minecraft:item.firecharge.use', 1, 0.7)
      ctx.setCooldown(mastered(ctx) ? 5 : 8)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
    })

  // Sovereign's Pressure (Unique): the haki of a demon lord.
  event.create('kubejs:sovereigns_pressure')
    .name('Sovereign\'s Pressure')
    .description('Unleash the pressure of a demon lord: every creature within 10 blocks is crushed with Slowness III and Weakness II for 6 seconds, loses its target and is thrown back. Other players are shrouded in darkness. Costs 800 magicules, 30 s cooldown.')
    .type('unique')
    .icon('kubejs:skill/demonic/sovereigns_pressure')
    .onPressed(ctx => {
      var player = ctx.entity
      if (!isServerLiving(player)) return
      if (ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(800)) { ctx.tell('Not enough magicules.'); return }
      var radius = mastered(ctx) ? 14 : 10
      var victims = livingNear(player, radius, false)
      for (var v = 0; v < victims.length; v++) {
        var e = victims[v]
        if (e.isPlayer()) { effect(e, 'minecraft:darkness', 80, 0); continue }
        effect(e, 'minecraft:slowness', 120, 2)
        effect(e, 'minecraft:weakness', 120, 1)
        try { e.setTarget(null) } catch (err) { /* not a mob */ }
        push(e, player.x, player.z, 1.4, 0.4)
      }
      particles(player, 'minecraft:smoke', player.x, player.y + 1, player.z, radius / 2, 1, radius / 2, 200, 0.2)
      particles(player, 'minecraft:soul', player.x, player.y + 1, player.z, radius / 2, 1, radius / 2, 80, 0.1)
      sound(player, 'minecraft:entity.wither.spawn', 1, 1.5)
      sound(player, 'minecraft:entity.warden.roar', 0.6, 1.4)
      cmd(player, `title @a[distance=..${radius + 4}] actionbar {"text":"An overwhelming pressure bears down on you...","color":"dark_red"}`)
      ctx.setCooldown(mastered(ctx) ? 20 : 30)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
    })

  event.create('kubejs:clarent_summon')
    .name('Rebellion Against My Beautiful Father')
    .description('Summon Clarent into your hand for 2 minutes (4 mastered). Press again to dismiss it. Costs 900 magicules.')
    .type('unique')
    .icon('kubejs:skill/demonic/clarent_summon')
    .onPressed(ctx => summonSkill(ctx, 'kubejs:clarent', 'Clarent', 900, 2400, 2400, 'red'))

  // Clarent Blood Arthur (Ultimate): the crimson wave of hatred.
  event.create('kubejs:clarent_blood_arthur')
    .name('Clarent Blood Arthur')
    .description('ULTIMATE. Hold to gather your hatred (up to 2 s), release to hurl a crimson wave 10 blocks wide: 45 damage (75 mastered) plus Wither II, and 30% of the damage dealt returns to you as blood. Full power needs Clarent in hand. Costs 2000 magicules, 40 s cooldown.')
    .type('ultimate')
    .icon('kubejs:skill/demonic/clarent_blood_arthur')
    .maxHeldTime(40)
    .onHeld(ctx => {
      var player = ctx.entity
      if (!isServerLiving(player)) return false
      if (ctx.cooldown() > 0) { if (ctx.heldTicks == 1) ctx.tell('Clarent is not ready.'); return false }
      if (ctx.heldTicks % 4 == 0) {
        particles(player, 'minecraft:soul_fire_flame', player.x, player.y + 1, player.z, 0.6, 0.8, 0.6, 10, 0.05)
        particles(player, 'minecraft:damage_indicator', player.x, player.y + 1.2, player.z, 0.4, 0.4, 0.4, 3, 0.1)
      }
      ctx.instance.getOrCreateTag().putInt('charge', ctx.heldTicks)
      return true
    })
    .onRelease(ctx => {
      var player = ctx.entity
      if (!isServerLiving(player)) return
      if (ctx.cooldown() > 0) return
      var charge = Math.min(40, ctx.instance.getOrCreateTag().getInt('charge'))
      ctx.instance.getOrCreateTag().putInt('charge', 0)
      if (charge < 8) { ctx.tell('The hatred dissipates. Hold longer.'); return }
      if (!ctx.consumeMagicule(2000)) { ctx.tell('Not enough magicules.'); return }
      var base = mastered(ctx) ? 75 : 45
      if (!holdsWeapon(player, 'kubejs:clarent')) base *= 0.5
      var dmg = base * (0.5 + 0.5 * charge / 40)
      var total = 0
      var victims = livingNear(player, 12, false)
      for (var v = 0; v < victims.length; v++) {
        if (!inCone(player, victims[v], 11, 30)) continue
        hurt(player, victims[v], dmg)
        effect(victims[v], 'minecraft:wither', 100, 1)
        push(victims[v], player.x, player.z, 1.5, 0.4)
        total += dmg
      }
      var look = player.getLookAngle()
      for (var s = 1; s <= 11; s++) {
        var w = s * 0.55
        particles(player, 'minecraft:soul_fire_flame', player.x + Number(look.x()) * s, player.y + 1, player.z + Number(look.z()) * s, w, 0.5, w, 16, 0.08)
        particles(player, 'minecraft:crimson_spore', player.x + Number(look.x()) * s, player.y + 1, player.z + Number(look.z()) * s, w, 0.5, w, 8, 0.05)
      }
      if (total > 0) { try { player.heal(Math.min(20, total * 0.3)) } catch (e) { /* ignore */ } }
      sound(player, 'minecraft:entity.wither.shoot', 1, 0.6)
      sound(player, 'minecraft:entity.ender_dragon.growl', 0.6, 1.5)
      cmd(player, `title @a[distance=..40] title {"text":"CLARENT BLOOD ARTHUR","color":"dark_red","bold":true}`)
      ctx.setCooldown(mastered(ctx) ? 28 : 40)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
    })
})

// =====================================================================
// 3. Races
// =====================================================================
StartupEvents.registry(TensuraKubeJS.RACE_REGISTRY, event => {

  // --- Holy line ------------------------------------------------------
  event.create('kubejs:squire')
    .name('Squire of the Holy Order')
    .description('A sworn squire of the Holy Order. Weak, but the seed of a king. Race ability: Second Wind (brief Speed and Regeneration). Evolves to Holy Knight at 5,000 EP.')
    .difficulty('easy')
    .startingRace(true)
    .randomStartingRace(true)
    .defaultEvolution('kubejs:holy_knight')
    .baseAura(400, 600)
    .baseMagicule(400, 600)
    .size(0)
    .maxHealth(20)
    .maxSpiritualHealth(20)
    .attack(1)
    .attackSpeed(0)
    .knockbackResistance(0)
    .movementSpeed(0.02)
    .swimSpeed(0)
    .intrinsicSkill('kubejs:divine_smite')
    .onActivateAbility(ctx => {
      if (!isServerLiving(ctx.entity) || ctx.cooldown() > 0) return
      effect(ctx.entity, 'minecraft:speed', 100, 0)
      effect(ctx.entity, 'minecraft:regeneration', 60, 0)
      sound(ctx.entity, 'minecraft:entity.player.attack.sweep', 1, 1.4)
      ctx.setCooldown(600)
    })

  event.create('kubejs:holy_knight')
    .name('Holy Knight')
    .description('A knight anointed by holy light. Race ability: Knight\'s Charge (dash forward and stagger foes). Evolves to Paladin King at 40,000 EP with Divine Smite mastered.')
    .difficulty('intermediate')
    .previousEvolution('kubejs:squire')
    .defaultEvolution('kubejs:paladin_king')
    .baseAura(1500, 2000)
    .baseMagicule(1500, 2000)
    .size(0.05)
    .maxHealth(30)
    .maxSpiritualHealth(60)
    .attack(3)
    .attackSpeed(0.1)
    .knockbackResistance(0.1)
    .movementSpeed(0.04)
    .swimSpeed(0.05)
    .epRequirement(5000)
    .intrinsicSkill('kubejs:wall_of_the_kingdom')
    .intrinsicSkill('kubejs:invisible_air')
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var look = p.getLookAngle()
      try { p.setMotionX(Number(look.x()) * 1.8); p.setMotionY(0.3); p.setMotionZ(Number(look.z()) * 1.8); p.hurtMarked = true } catch (e) { /* ignore */ }
      var mobs = hostilesNear(p, 4)
      for (var i = 0; i < mobs.length; i++) { hurt(p, mobs[i], 6); effect(mobs[i], 'minecraft:slowness', 40, 2) }
      particles(p, 'minecraft:cloud', p.x, p.y + 0.5, p.z, 0.8, 0.3, 0.8, 20, 0.1)
      sound(p, 'minecraft:entity.horse.gallop', 1, 1.2)
      ctx.setCooldown(300)
    })

  event.create('kubejs:paladin_king')
    .name('Paladin King')
    .description('A king whose word is a wall and whose sword is the dawn. Passive: regenerate when below 30% health. Race ability: Royal Decree (Strength II and Resistance II for allies). Evolves to Divine Sovereign at 200,000 EP by consuming the Holy Grail.')
    .difficulty('hard')
    .previousEvolution('kubejs:holy_knight')
    .defaultEvolution('kubejs:divine_sovereign')
    .baseAura(6000, 8000)
    .baseMagicule(6000, 8000)
    .size(0.1)
    .maxHealth(50)
    .maxSpiritualHealth(150)
    .attack(6)
    .attackSpeed(0.15)
    .knockbackResistance(0.2)
    .movementSpeed(0.06)
    .swimSpeed(0.1)
    .epRequirement(40000)
    .skillRequirement('kubejs:divine_smite', true)
    .intrinsicSkill('kubejs:kings_decree')
    .intrinsicSkill('kubejs:excalibur_summon')
    .intrinsicSkill('kubejs:rhongomyniad_summon')
    .canTick(true)
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 40 != 0) return
      if (p.health < p.getMaxHealth() * 0.3) effect(p, 'minecraft:regeneration', 60, 1)
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var allies = livingNear(p, 16, true)
      for (var i = 0; i < allies.length; i++) {
        if (!allies[i].isPlayer()) continue
        effect(allies[i], 'minecraft:strength', 300, 1)
        effect(allies[i], 'minecraft:resistance', 300, 1)
      }
      particles(p, 'minecraft:end_rod', p.x, p.y + 1, p.z, 4, 1, 4, 80, 0.05)
      sound(p, 'minecraft:item.goat_horn.sound.0', 1, 1)
      ctx.setCooldown(1200)
    })

  event.create('kubejs:divine_sovereign')
    .name('Divine Sovereign')
    .description('The final form of the holy line: a sovereign wreathed in the light of the ending. Passive: immune to fire and holy-light regeneration. Race ability: Sanctuary (full restore of health and limbs for every ally within 12 blocks).')
    .difficulty('hard')
    .previousEvolution('kubejs:paladin_king')
    .baseAura(25000, 32000)
    .baseMagicule(25000, 32000)
    .size(0.15)
    .maxHealth(80)
    .maxSpiritualHealth(400)
    .attack(10)
    .attackSpeed(0.2)
    .knockbackResistance(0.35)
    .movementSpeed(0.08)
    .swimSpeed(0.15)
    .epRequirement(200000)
    .itemConsumeRequirement('kubejs:holy_grail', 1)
    .intrinsicSkill('kubejs:excalibur_release')
    .intrinsicSkill('kubejs:lance_of_the_ending')
    .intrinsicSkill('kubejs:avalon')
    .canTick(true)
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 20 != 0) return
      effect(p, 'minecraft:fire_resistance', 60, 0)
      if (p.health < p.getMaxHealth()) effect(p, 'minecraft:regeneration', 40, 0)
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var allies = livingNear(p, 12, true)
      for (var i = 0; i < allies.length; i++) if (allies[i].isPlayer()) fullRestore(allies[i])
      particles(p, 'minecraft:end_rod', p.x, p.y + 1, p.z, 5, 2, 5, 200, 0.1)
      sound(p, 'minecraft:block.beacon.activate', 1, 1.6)
      ctx.setCooldown(2400)
    })

  // --- Demonic line ---------------------------------------------------
  event.create('kubejs:fallen_squire')
    .name('Fallen Squire')
    .description('A squire who took the demon\'s bargain. Race ability: Bloodrush (Strength and Speed at the cost of health). Evolves to Fallen Knight at 5,000 EP.')
    .difficulty('easy')
    .startingRace(true)
    .randomStartingRace(true)
    .defaultEvolution('kubejs:fallen_knight')
    .baseAura(300, 500)
    .baseMagicule(500, 700)
    .size(0)
    .maxHealth(18)
    .maxSpiritualHealth(20)
    .attack(2)
    .attackSpeed(0)
    .knockbackResistance(0)
    .movementSpeed(0.02)
    .swimSpeed(0)
    .intrinsicSkill('kubejs:blood_pact')
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0 || p.health <= 4) return
      try { p.setHealth(p.health - 4) } catch (e) { /* ignore */ }
      effect(p, 'minecraft:strength', 120, 0)
      effect(p, 'minecraft:speed', 120, 1)
      sound(p, 'minecraft:entity.zombie_villager.cure', 0.5, 1.8)
      ctx.setCooldown(500)
    })

  event.create('kubejs:fallen_knight')
    .name('Fallen Knight')
    .description('A knight whose armour is scorched black by hellfire. Race ability: Hellstep (short teleport toward where you look, burning the arrival point). Evolves to Demon Knight at 40,000 EP with Hellfire Brand mastered.')
    .difficulty('intermediate')
    .previousEvolution('kubejs:fallen_squire')
    .defaultEvolution('kubejs:demon_knight')
    .baseAura(1200, 1800)
    .baseMagicule(1800, 2400)
    .size(0.05)
    .maxHealth(28)
    .maxSpiritualHealth(60)
    .attack(4)
    .attackSpeed(0.1)
    .knockbackResistance(0.1)
    .movementSpeed(0.04)
    .swimSpeed(0.05)
    .epRequirement(5000)
    .intrinsicSkill('kubejs:hellfire_brand')
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var look = p.getLookAngle()
      var tx = p.x + Number(look.x()) * 6, tz = p.z + Number(look.z()) * 6
      particles(p, 'minecraft:flame', p.x, p.y + 1, p.z, 0.4, 0.8, 0.4, 30, 0.05)
      try { p.teleportTo(tx, p.y, tz) } catch (e) { /* ignore */ }
      particles(p, 'minecraft:flame', tx, p.y + 1, tz, 0.4, 0.8, 0.4, 30, 0.05)
      var mobs = hostilesNear(p, 3)
      for (var i = 0; i < mobs.length; i++) { ignite(mobs[i], 4) }
      sound(p, 'minecraft:entity.enderman.teleport', 1, 0.6)
      ctx.setCooldown(240)
    })

  event.create('kubejs:demon_knight')
    .name('Demon Knight')
    .description('Hell\'s champion in knightly steel. Passive: burning heals you. Race ability: Infernal Rally (nearby creatures burst into flame and you gain Absorption). Evolves to Demon King at 200,000 EP by consuming an Archdemon Heart.')
    .difficulty('hard')
    .previousEvolution('kubejs:fallen_knight')
    .defaultEvolution('kubejs:demon_king')
    .baseAura(5000, 7000)
    .baseMagicule(8000, 10000)
    .size(0.1)
    .maxHealth(46)
    .maxSpiritualHealth(150)
    .attack(7)
    .attackSpeed(0.15)
    .knockbackResistance(0.2)
    .movementSpeed(0.06)
    .swimSpeed(0.1)
    .epRequirement(40000)
    .skillRequirement('kubejs:hellfire_brand', true)
    .intrinsicSkill('kubejs:sovereigns_pressure')
    .intrinsicSkill('kubejs:clarent_summon')
    .canTick(true)
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 20 != 0) return
      effect(p, 'minecraft:fire_resistance', 60, 0)
      try { if (p.isOnFire()) p.heal(1) } catch (e) { /* ignore */ }
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var mobs = hostilesNear(p, 8)
      for (var i = 0; i < mobs.length; i++) { ignite(mobs[i], 8); hurt(p, mobs[i], 6) }
      effect(p, 'minecraft:absorption', 600, 2)
      particles(p, 'minecraft:lava', p.x, p.y + 1, p.z, 4, 1, 4, 60, 0.1)
      sound(p, 'minecraft:entity.blaze.death', 1, 0.5)
      ctx.setCooldown(900)
    })

  event.create('kubejs:demon_king')
    .name('Demon King')
    .description('The final form of the demonic line. Passive: immune to fire and wither, and your pressure never fades. Race ability: Throne of Ash (a 12-block eruption of hellfire that heals you for the damage dealt).')
    .difficulty('hard')
    .previousEvolution('kubejs:demon_knight')
    .baseAura(20000, 28000)
    .baseMagicule(30000, 40000)
    .size(0.15)
    .maxHealth(76)
    .maxSpiritualHealth(400)
    .attack(12)
    .attackSpeed(0.2)
    .knockbackResistance(0.35)
    .movementSpeed(0.08)
    .swimSpeed(0.15)
    .epRequirement(200000)
    .itemConsumeRequirement('kubejs:demon_heart', 1)
    .intrinsicSkill('kubejs:clarent_blood_arthur')
    .canTick(true)
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 20 != 0) return
      effect(p, 'minecraft:fire_resistance', 60, 0)
      removeEffect(p, 'minecraft:wither')
      if (p.tickCount % 60 == 0) {
        var mobs = hostilesNear(p, 6)
        for (var i = 0; i < mobs.length; i++) effect(mobs[i], 'minecraft:weakness', 80, 0)
      }
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var mobs = hostilesNear(p, 12)
      var total = 0
      for (var i = 0; i < mobs.length; i++) { hurt(p, mobs[i], 20); total += 20; ignite(mobs[i], 10) }
      try { p.heal(Math.min(30, total * 0.5)) } catch (e) { /* ignore */ }
      particles(p, 'minecraft:flame', p.x, p.y + 0.5, p.z, 6, 1, 6, 300, 0.2)
      particles(p, 'minecraft:explosion', p.x, p.y + 1, p.z, 3, 1, 3, 10, 0.1)
      sound(p, 'minecraft:entity.generic.explode', 1, 0.6)
      sound(p, 'minecraft:entity.wither.death', 0.5, 1.2)
      ctx.setCooldown(2400)
    })
})
