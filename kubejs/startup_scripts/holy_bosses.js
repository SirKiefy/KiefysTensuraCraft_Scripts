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
// Helpers (hurt, effect, particles, sound, push, livingNear, ignite, cmd,
// fxEntity, fxAt, shockwave, pillar, burst, coneSpray, title) come from
// holy_fx_lib.js (priority 95): KubeJS startup scripts share one scope.

function bossPlayers(boss, radius) {
  return playersNear(boss, radius, false)
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
        fxEntity(e, 'mordred_enrage', { autoRotate: 'none', allowMulti: false })
        pillar(e, 'minecraft:soul_fire_flame', e.x, e.y, e.z, 6, 3)
        shockwave(e, 'minecraft:crimson_spore', e.x, e.y + 0.3, e.z, 6, 3, 0.5)
        title(e, 40, 'MORDRED ENRAGES', 'dark_red', 'Clarent drinks deep')
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
        ring(e, 'minecraft:soul_fire_flame', e.x, e.y + 0.2, e.z, 5.5, 32, -0.3, 0)
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
        fxEntity(e, 'mordred_sweep', { autoRotate: 'none', forcedDeath: true })
        shockwave(e, 'minecraft:soul_fire_flame', e.x, e.y + 1, e.z, 5.5, 3, 0.7)
        shockwave(e, 'minecraft:crimson_spore', e.x, e.y + 0.3, e.z, 5.5, 2, 0.5)
        particles(e, 'minecraft:sweep_attack', e.x, e.y + 1.2, e.z, 2, 0.3, 2, 6, 0)
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
      fxAt(e, 'boss_death', e.x, e.y, e.z, {})
      pillar(e, 'minecraft:soul', e.x, e.y, e.z, 12, 3)
      burst(e, 'minecraft:crimson_spore', e.x, e.y + 1, e.z, 120, 0.6)
      title(e, 48, 'MORDRED FALLS', 'gold', 'Clarent lies on the ground')
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
        fxAt(e, 'leonis_smite', target.x, target.y, target.z, {})
        pillar(e, 'minecraft:end_rod', target.x, target.y, target.z, 10, 3)
        shockwave(e, 'minecraft:firework', target.x, target.y + 0.2, target.z, 3, 2, 0.4)
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
        fxEntity(e, 'leonis_sanctuary', { autoRotate: 'none', allowMulti: false })
        shockwave(e, 'minecraft:end_rod', e.x, e.y + 0.2, e.z, 10, 4, 0.5)
        title(e, 40, 'SANCTUARY', 'gold', 'The Lion King stands')
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
      fxAt(e, 'boss_death', e.x, e.y, e.z, {})
      pillar(e, 'minecraft:end_rod', e.x, e.y, e.z, 16, 3)
      burst(e, 'minecraft:firework', e.x, e.y + 1, e.z, 120, 0.8)
      title(e, 48, 'THE LION KING FALLS', 'gold', 'Excalibur and the Grail remain')
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
        fxEntity(e, 'balor_hellfire', { autoRotate: 'look', forcedDeath: true })
        coneSpray(e, 'minecraft:flame', 7, 35, 70, 1.0)
        coneSpray(e, 'minecraft:soul_fire_flame', 7, 30, 30, 0.9)
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
        burst(e, 'minecraft:portal', e.x, e.y + 1, e.z, 40, 0.6)
        try { e.teleportTo(tx, target.y, tz) } catch (err) { /* ignore */ }
        fxEntity(e, 'balor_blink', { autoRotate: 'none', forcedDeath: true })
        burst(e, 'minecraft:portal', tx, target.y + 1, tz, 40, 0.6)
        ring(e, 'minecraft:soul_fire_flame', tx, target.y + 0.1, tz, 1.5, 12, 0.2, 0)
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
      fxAt(e, 'boss_death', e.x, e.y, e.z, {})
      pillar(e, 'minecraft:soul_fire_flame', e.x, e.y, e.z, 12, 3)
      shockwave(e, 'minecraft:lava', e.x, e.y + 0.3, e.z, 8, 4, 0.7)
      particles(e, 'minecraft:explosion_emitter', e.x, e.y + 1, e.z, 0, 0, 0, 1, 0)
      title(e, 48, 'BALOR IS EXECUTED', 'dark_red', 'Its heart still beats')
    })
    .eggItem(egg => egg.backgroundColor(0x3b0f0f).highlightColor(0xff6a1a))
  knightAnimation(balor)
})
