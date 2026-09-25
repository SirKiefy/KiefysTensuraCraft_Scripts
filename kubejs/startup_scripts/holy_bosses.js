// priority: 80
//
// kubejs/startup_scripts/holy_bosses.js
// --------------------------------------
// Three humanoid bosses built with EntityJS on the vanilla zombie base
// (so they path, melee and target like a zombie) rendered with a custom
// humanoid GeckoLib model + skin:
//
//   kubejs:fallen_paladin      "Mordred, the Fallen Paladin"    -> drops Clarent (permanent)
//   kubejs:lion_king           "Leonis, Lion King of the Holy Order" -> drops Excalibur + Holy Grail
//   kubejs:archdemon_executor  "Balor, Archdemon Executor"      -> drops Archdemon Heart
//
// Assets (generated placeholders, replace with real art):
//   assets/kubejs/geo/entity/<id>.geo.json, animations/entity/<id>.animation.json,
//   textures/entity/<id>.png (64x64 player-skin layout).
//
// AI goals and boss bars live in server_scripts/holy_knight_server.js.
// Spawn with /summon kubejs:<id> or the spawn eggs.
//
// Helpers (hurt, effect, particles, sound, push, livingNear, ignite, cmd)
// come from holy_knight_content.js, which loads first (priority 90):
// KubeJS startup scripts share one top-level scope.

function bossPlayers(boss, radius) {
  var all = livingNear(boss, radius, false)
  var out = []
  for (var i = 0; i < all.length; i++) if (all[i].isPlayer()) out.push(all[i])
  return out
}

function bossSay(boss, text, color) {
  cmd(boss, `title @a[distance=..40] actionbar {"text":"${text}","color":"${color}"}`)
}

function bossPhase(boss, key) {
  return boss.persistentData.getBoolean(key)
}

function setBossPhase(boss, key) {
  boss.persistentData.putBoolean(key, true)
}

function knightAnimation(builder) {
  builder.addAnimationController('main', 4, ev => {
    if (ev.isMoving()) ev.thenLoop('animation.knight.walk')
    else ev.thenLoop('animation.knight.idle')
    return true
  })
}

StartupEvents.registry('entity_type', event => {

  // -------------------------------------------------------------------
  // Mordred, the Fallen Paladin: a knight who serves the blood-red blade.
  //   400 HP, 14 dmg, armor 12. Crimson Sweep every 8 s near its target.
  //   Below 50% HP: enrages (Speed + Strength, faster sweeps).
  // -------------------------------------------------------------------
  var mordred = event.create('kubejs:fallen_paladin', 'minecraft:zombie')
    .sized(0.7, 2.1)
    .mobCategory('monster')
    .isSunSensitive(false)
    .convertsInWater(false)
    .defaultGoals(false)
    .defaultBehaviourGoals(false)
    .fireImmune(false)
    .scale(e => 1.1)
    .attributes(a => {
      a.add('minecraft:generic.max_health', 400)
      a.add('minecraft:generic.attack_damage', 14)
      a.add('minecraft:generic.armor', 12)
      a.add('minecraft:generic.armor_toughness', 6)
      a.add('minecraft:generic.movement_speed', 0.32)
      a.add('minecraft:generic.knockback_resistance', 0.8)
      a.add('minecraft:generic.follow_range', 48)
    })
    .experienceReward(e => 250)
    .setDeathSound('minecraft:entity.wither.death')
    .setHurtSound(ctx => 'minecraft:entity.iron_golem.hurt')
    .onAddedToWorld(e => {
      try {
        e.setCustomName(Text.string('Mordred, the Fallen Paladin'))
        e.setCustomNameVisible(true)
        e.setPersistenceRequired()
      } catch (err) { /* ignore */ }
    })
    .tick(e => {
      if (e.level.isClientSide() || !e.isAlive()) return
      var t = e.tickCount
      var target = null
      try { target = e.getTarget() } catch (err) { target = null }
      var enraged = bossPhase(e, 'enraged')
      if (!enraged && e.health < e.getMaxHealth() * 0.5) {
        setBossPhase(e, 'enraged')
        enraged = true
        bossSay(e, 'Mordred: "I will be king... even if I must burn the throne!"', 'dark_red')
        sound(e, 'minecraft:entity.wither.spawn', 1, 1.3)
        particles(e, 'minecraft:soul_fire_flame', e.x, e.y + 1, e.z, 1, 1, 1, 80, 0.2)
      }
      if (enraged && t % 40 == 0) {
        effect(e, 'minecraft:speed', 60, 1)
        effect(e, 'minecraft:strength', 60, 1)
      }
      if (t % 40 == 0 && e.health < e.getMaxHealth()) { try { e.heal(1) } catch (err) { /* ignore */ } }
      var sweepEvery = enraged ? 100 : 160
      if (t % sweepEvery == 0 && target && e.distanceToSqr(target) < 49) {
        bossSay(e, 'Mordred raises Clarent!', 'red')
        sound(e, 'minecraft:entity.player.attack.sweep', 1, 0.5)
        e.persistentData.putLong('sweepAt', Number(e.level.getGameTime()) + 15)
      }
      var sweepAt = e.persistentData.getLong('sweepAt')
      if (sweepAt > 0 && Number(e.level.getGameTime()) >= sweepAt) {
        e.persistentData.putLong('sweepAt', 0)
        var victims = bossPlayers(e, 5.5)
        for (var i = 0; i < victims.length; i++) {
          hurt(e, victims[i], enraged ? 12 : 8)
          effect(victims[i], 'minecraft:wither', 80, 0)
          push(victims[i], e.x, e.z, 1.2, 0.4)
        }
        for (var a = 0; a < 24; a++) {
          var ang = a * Math.PI / 12
          particles(e, 'minecraft:crimson_spore', e.x + Math.cos(ang) * 4, e.y + 1, e.z + Math.sin(ang) * 4, 0.2, 0.3, 0.2, 4, 0.05)
          particles(e, 'minecraft:soul_fire_flame', e.x + Math.cos(ang) * 2.5, e.y + 1, e.z + Math.sin(ang) * 2.5, 0.1, 0.2, 0.1, 2, 0.02)
        }
        sound(e, 'minecraft:entity.wither.shoot', 1, 0.7)
      }
    })
    .onDeath(ctx => {
      var e = ctx.entity
      if (e.level.isClientSide()) return
      try {
        e.spawnAtLocation(Item.of('kubejs:clarent'))
        e.spawnAtLocation(Item.of('minecraft:netherite_ingot', 2))
      } catch (err) { /* ignore */ }
      bossSay(e, 'Mordred has fallen. Clarent lies on the ground.', 'gold')
      particles(e, 'minecraft:soul', e.x, e.y + 1, e.z, 1, 1, 1, 100, 0.1)
    })
    .eggItem(egg => egg.backgroundColor(0x2b0a0a).highlightColor(0xc0261c))
  knightAnimation(mordred)

  // -------------------------------------------------------------------
  // Leonis, Lion King of the Holy Order: the sun-crowned champion.
  //   600 HP, 12 dmg, armor 16. Holy Smite (lightning) on its target every
  //   6 s. Aura of the Kingdom: Weakness to nearby players every 5 s.
  //   Below 30% HP: Sanctuary (heals 5 HP/s, Resistance II) for 15 s.
  // -------------------------------------------------------------------
  var leonis = event.create('kubejs:lion_king', 'minecraft:zombie')
    .sized(0.75, 2.2)
    .mobCategory('monster')
    .isSunSensitive(false)
    .convertsInWater(false)
    .defaultGoals(false)
    .defaultBehaviourGoals(false)
    .fireImmune(true)
    .scale(e => 1.15)
    .attributes(a => {
      a.add('minecraft:generic.max_health', 600)
      a.add('minecraft:generic.attack_damage', 12)
      a.add('minecraft:generic.armor', 16)
      a.add('minecraft:generic.armor_toughness', 8)
      a.add('minecraft:generic.movement_speed', 0.3)
      a.add('minecraft:generic.knockback_resistance', 1.0)
      a.add('minecraft:generic.follow_range', 48)
    })
    .experienceReward(e => 400)
    .setDeathSound('minecraft:entity.ender_dragon.death')
    .setHurtSound(ctx => 'minecraft:entity.iron_golem.hurt')
    .onAddedToWorld(e => {
      try {
        e.setCustomName(Text.string('Leonis, Lion King of the Holy Order'))
        e.setCustomNameVisible(true)
        e.setPersistenceRequired()
      } catch (err) { /* ignore */ }
    })
    .tick(e => {
      if (e.level.isClientSide() || !e.isAlive()) return
      var t = e.tickCount
      var target = null
      try { target = e.getTarget() } catch (err) { target = null }
      if (t % 20 == 0) effect(e, 'minecraft:fire_resistance', 60, 0)
      if (t % 120 == 0 && target) {
        try { e.level.spawnLightning(target.x, target.y, target.z, true) } catch (err) { /* ignore */ }
        particles(e, 'minecraft:end_rod', target.x, target.y + 1, target.z, 0.3, 1.5, 0.3, 50, 0.1)
        sound(e, 'minecraft:entity.lightning_bolt.impact', 1, 1.5)
        hurt(e, target, 10)
        effect(target, 'minecraft:glowing', 100, 0)
      }
      if (t % 100 == 0) {
        var near = bossPlayers(e, 8)
        for (var i = 0; i < near.length; i++) effect(near[i], 'minecraft:weakness', 80, 0)
        if (near.length) particles(e, 'minecraft:end_rod', e.x, e.y + 0.2, e.z, 4, 0.2, 4, 30, 0.01)
      }
      if (!bossPhase(e, 'sanctuary') && e.health < e.getMaxHealth() * 0.3) {
        setBossPhase(e, 'sanctuary')
        e.persistentData.putLong('sanctuaryUntil', Number(e.level.getGameTime()) + 300)
        bossSay(e, 'Leonis: "The kingdom shall not fall while I stand!"', 'gold')
        sound(e, 'minecraft:block.beacon.activate', 1, 1.5)
        cmd(e, 'title @a[distance=..40] title {"text":"SANCTUARY","color":"gold","bold":true}')
      }
      var sanctuaryUntil = e.persistentData.getLong('sanctuaryUntil')
      if (sanctuaryUntil > Number(e.level.getGameTime()) && t % 20 == 0) {
        try { e.heal(5) } catch (err) { /* ignore */ }
        effect(e, 'minecraft:resistance', 40, 1)
        particles(e, 'minecraft:end_rod', e.x, e.y + 1, e.z, 1, 1.5, 1, 40, 0.05)
      }
    })
    .onDeath(ctx => {
      var e = ctx.entity
      if (e.level.isClientSide()) return
      try {
        e.spawnAtLocation(Item.of('kubejs:excalibur'))
        e.spawnAtLocation(Item.of('kubejs:holy_grail'))
      } catch (err) { /* ignore */ }
      bossSay(e, 'The Lion King falls. Excalibur and the Holy Grail remain.', 'gold')
      particles(e, 'minecraft:end_rod', e.x, e.y + 1, e.z, 2, 2, 2, 200, 0.1)
      try { e.level.spawnLightning(e.x, e.y, e.z, true) } catch (err) { /* ignore */ }
    })
    .eggItem(egg => egg.backgroundColor(0xd7b446).highlightColor(0xfff6d0))
  knightAnimation(leonis)

  // -------------------------------------------------------------------
  // Balor, Archdemon Executor: hellfire and teleporting cruelty.
  //   800 HP, 16 dmg, armor 10, immune to fire. Hellfire Cone every 5 s,
  //   blinks behind a far target every 10 s, and below 40% HP calls two
  //   wither skeleton executioners every 30 s (max 4 alive).
  // -------------------------------------------------------------------
  var balor = event.create('kubejs:archdemon_executor', 'minecraft:zombie')
    .sized(0.8, 2.4)
    .mobCategory('monster')
    .isSunSensitive(false)
    .convertsInWater(false)
    .defaultGoals(false)
    .defaultBehaviourGoals(false)
    .fireImmune(true)
    .scale(e => 1.25)
    .attributes(a => {
      a.add('minecraft:generic.max_health', 800)
      a.add('minecraft:generic.attack_damage', 16)
      a.add('minecraft:generic.armor', 10)
      a.add('minecraft:generic.armor_toughness', 4)
      a.add('minecraft:generic.movement_speed', 0.28)
      a.add('minecraft:generic.knockback_resistance', 1.0)
      a.add('minecraft:generic.follow_range', 48)
    })
    .experienceReward(e => 500)
    .setDeathSound('minecraft:entity.wither.death')
    .setHurtSound(ctx => 'minecraft:entity.blaze.hurt')
    .onAddedToWorld(e => {
      try {
        e.setCustomName(Text.string('Balor, Archdemon Executor'))
        e.setCustomNameVisible(true)
        e.setPersistenceRequired()
      } catch (err) { /* ignore */ }
    })
    .tick(e => {
      if (e.level.isClientSide() || !e.isAlive()) return
      var t = e.tickCount
      var target = null
      try { target = e.getTarget() } catch (err) { target = null }
      if (t % 10 == 0) particles(e, 'minecraft:flame', e.x, e.y + 0.3, e.z, 0.4, 0.2, 0.4, 3, 0.01)
      // Hellfire cone.
      if (t % 100 == 0 && target && e.distanceToSqr(target) < 64) {
        var look = e.getLookAngle()
        for (var s = 1; s <= 7; s++) {
          particles(e, 'minecraft:flame', e.x + Number(look.x()) * s, e.y + 1.2, e.z + Number(look.z()) * s, 0.25 * s, 0.3, 0.25 * s, 14, 0.05)
        }
        var victims = bossPlayers(e, 8)
        for (var i = 0; i < victims.length; i++) {
          if (!inCone(e, victims[i], 7.5, 40)) continue
          hurt(e, victims[i], 12)
          ignite(victims[i], 6)
        }
        sound(e, 'minecraft:entity.blaze.shoot', 1, 0.5)
      }
      // Blink behind a distant target.
      if (t % 200 == 0 && target && e.distanceToSqr(target) > 64) {
        var tl = target.getLookAngle()
        var tx = target.x - Number(tl.x()) * 2, tz = target.z - Number(tl.z()) * 2
        particles(e, 'minecraft:portal', e.x, e.y + 1, e.z, 0.5, 1, 0.5, 40, 0.5)
        try { e.teleportTo(tx, target.y, tz) } catch (err) { /* ignore */ }
        particles(e, 'minecraft:portal', tx, target.y + 1, tz, 0.5, 1, 0.5, 40, 0.5)
        sound(e, 'minecraft:entity.enderman.teleport', 1, 0.5)
        bossSay(e, 'Balor: "There is nowhere to run."', 'dark_red')
      }
      // Executioners.
      if (e.health < e.getMaxHealth() * 0.4 && t % 600 == 0) {
        var minions = e.persistentData.getInt('minions')
        var alive = 0
        var near = livingNear(e, 24, false)
        for (var n = 0; n < near.length; n++) if (String(near[n].type) == 'minecraft:wither_skeleton') alive++
        if (alive < 4) {
          for (var m = 0; m < 2; m++) {
            try {
              var skel = e.level.createEntity('minecraft:wither_skeleton')
              skel.setPosition(e.x + (m == 0 ? 2 : -2), e.y, e.z)
              skel.spawn()
              skel.setEquipment('mainhand', Item.of('minecraft:iron_sword'))
              effect(skel, 'minecraft:strength', 6000, 0)
            } catch (err) { /* ignore */ }
          }
          e.persistentData.putInt('minions', minions + 2)
          bossSay(e, 'Balor: "Executioners, to me!"', 'dark_red')
          sound(e, 'minecraft:entity.wither.ambient', 1, 0.6)
        }
      }
    })
    .onDeath(ctx => {
      var e = ctx.entity
      if (e.level.isClientSide()) return
      try {
        e.spawnAtLocation(Item.of('kubejs:demon_heart'))
        e.spawnAtLocation(Item.of('minecraft:nether_star'))
      } catch (err) { /* ignore */ }
      bossSay(e, 'The Archdemon is executed. Its heart still beats.', 'dark_red')
      particles(e, 'minecraft:lava', e.x, e.y + 1, e.z, 2, 1, 2, 80, 0.1)
      particles(e, 'minecraft:explosion', e.x, e.y + 1, e.z, 1, 1, 1, 6, 0.1)
    })
    .eggItem(egg => egg.backgroundColor(0x3b0f0f).highlightColor(0xff6a1a))
  knightAnimation(balor)
})
