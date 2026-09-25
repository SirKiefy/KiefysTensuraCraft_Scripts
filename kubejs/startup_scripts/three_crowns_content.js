// priority: 85
//
// kubejs/startup_scripts/three_crowns_content.js
// -----------------------------------------------
// The dragon line and the apex race that sits above all three lines.
// Helpers come from holy_fx_lib.js (priority 95, shared startup scope).
//
//   Dragon line : kubejs:wyrmling (starting, HARD) -> drake -> dragon -> elder_dragon
//   Apex        : kubejs:primordial_sovereign "Sovereign of the Three Crowns"
//                 reachable from divine_sovereign, demon_king AND elder_dragon,
//                 gated by 1,500,000 EP and the proof of every path:
//                 Holy Grail (Leonis), Archdemon Heart (Balor), Dragon Heart
//                 (crafted from the Ender Dragon's leavings) and the
//                 Essence of the Three Crowns (see server_scripts/three_crowns_recipes.js).
//
//   Skills dragon : dragon_breath (extra), draconic_scales (extra),
//                   wings_of_the_wyrm (unique), dragon_roar (unique),
//                   cataclysm (ULTIMATE)
//   Skills apex   : three_crowns (ULTIMATE toggle), world_ender (ULTIMATE)

// =====================================================================
// 1. Essences and hearts
// =====================================================================
StartupEvents.registry('item', event => {
  event.create('kubejs:holy_essence').displayName('Holy Essence').rarity('epic').maxStackSize(16)
  event.create('kubejs:demonic_essence').displayName('Demonic Essence').rarity('epic').maxStackSize(16)
  event.create('kubejs:dragon_essence').displayName('Dragon Essence').rarity('epic').maxStackSize(16)
  event.create('kubejs:dragon_heart').displayName('Dragon Heart').rarity('epic').maxStackSize(1)
  event.create('kubejs:essence_of_three_crowns').displayName('Essence of the Three Crowns').rarity('epic').maxStackSize(1).fireResistant()
})

// =====================================================================
// 2. Skills
// =====================================================================
StartupEvents.registry(TensuraKubeJS.SKILL_REGISTRY, event => {

  // Dragon Breath (Extra): a long cone of draconic fire.
  event.create('kubejs:dragon_breath')
    .name('Dragon Breath')
    .description('Exhale a 9-block cone of draconic fire: 14 damage (24 mastered), 6 seconds of burning and Wither, and the ground beneath the cone erupts. Costs 400 magicules, 7 s cooldown.')
    .type('extra')
    .icon('kubejs:skill/dragon/dragon_breath')
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(400)) { ctx.tell('Not enough magicules.'); return }
      var dmg = mastered(ctx) ? 24 : 14
      fxEntity(p, 'dragon_breath', { autoRotate: 'look', forcedDeath: true })
      coneSpray(p, 'minecraft:dragon_breath', 9, 28, 90, 1.1)
      coneSpray(p, 'minecraft:flame', 9, 25, 40, 1.0)
      coneSpray(p, 'minecraft:witch', 8, 20, 12, 0.7)
      var look = lookVec(p)
      for (var s = 2; s <= 9; s += 2) ring(p, 'minecraft:lava', p.getX() + look.x * s, p.getY() + 0.1, p.getZ() + look.z * s, s * 0.35, 8, 0.1, s)
      var victims = livingNear(p, 10, false)
      for (var v = 0; v < victims.length; v++) {
        if (!inCone(p, victims[v], 9.5, 30)) continue
        hurt(p, victims[v], dmg)
        ignite(victims[v], 6)
        effect(victims[v], 'minecraft:wither', 80, 0)
      }
      sound(p, 'minecraft:entity.ender_dragon.shoot', 1, 0.8)
      sound(p, 'minecraft:entity.blaze.shoot', 0.8, 0.5)
      ctx.setCooldown(mastered(ctx) ? 5 : 7)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })

  // Draconic Scales (Extra): armour of scales.
  event.create('kubejs:draconic_scales')
    .name('Draconic Scales')
    .description('Toggle. Scales harden over your body: damage taken is reduced by 40% (55% mastered), you cannot be set on fire, and attackers are scorched by the heat of your scales. Drains 4 magicules per second.')
    .type('extra')
    .icon('kubejs:skill/dragon/draconic_scales')
    .canBeToggled(true)
    .canTick(ctx => ctx.isToggled())
    .onToggleOn(ctx => {
      fxEntity(ctx.entity, 'draconic_scales', { autoRotate: 'none', allowMulti: false })
      helix(ctx.entity, 'minecraft:dragon_breath', ctx.entity.getX(), ctx.entity.getY(), ctx.entity.getZ(), 0.9, 2.5, 2, 0)
      sound(ctx.entity, 'minecraft:entity.ender_dragon.ambient', 0.6, 1.6)
    })
    .onToggleOff(ctx => fxRemove(ctx.entity, 'draconic_scales'))
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      var t = p.tickCount
      if (t % 15 == 0) ring(p, 'minecraft:dragon_breath', p.getX(), p.getY() + 0.4 + (t % 45) / 30, p.getZ(), 0.9, 6, 0, t * 0.2)
      if (t % 20 != 0) return
      if (!ctx.consumeMagicule(4)) {
        ctx.instance.setToggled(false)
        ctx.instance.markDirty()
        fxRemove(p, 'draconic_scales')
        ctx.tell('Your scales soften: out of magicules.')
        return
      }
      effect(p, 'minecraft:fire_resistance', 60, 0)
      if (t % 200 == 0) ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })
    .onTakenDamage(ctx => {
      if (!ctx.isToggled()) return true
      ctx.setAmount(Number(ctx.amount()) * (mastered(ctx) ? 0.45 : 0.6))
      try {
        var attacker = ctx.source.getEntity()
        if (attacker && attacker.isAlive() && !attacker.equals(ctx.entity) && typeof attacker.getHealth === 'function') ignite(attacker, 3)
      } catch (e) { /* ignore */ }
      burst(ctx.entity, 'minecraft:dragon_breath', ctx.entity.getX(), ctx.entity.getY() + 1, ctx.entity.getZ(), 10, 0.3)
      return true
    })

  // Wings of the Wyrm (Unique): a mighty wing-beat.
  event.create('kubejs:wings_of_the_wyrm')
    .name('Wings of the Wyrm')
    .description('Beat your wings: launch high into the air and glide with Slow Falling for 10 seconds; creatures beneath you are blown away and take 6 damage. Costs 250 magicules, 8 s cooldown.')
    .type('unique')
    .icon('kubejs:skill/dragon/wings_of_the_wyrm')
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(250)) { ctx.tell('Not enough magicules.'); return }
      var look = lookVec(p)
      launch(p, look.x * 1.2, mastered(ctx) ? 2.2 : 1.6, look.z * 1.2)
      effect(p, 'minecraft:slow_falling', 200, 0)
      var mobs = hostilesNear(p, 5)
      for (var i = 0; i < mobs.length; i++) { push(mobs[i], p.getX(), p.getZ(), 1.3, 0.3); hurt(p, mobs[i], 6) }
      fxEntity(p, 'wings_of_the_wyrm', { autoRotate: 'none', forcedDeath: true })
      shockwave(p, 'minecraft:cloud', p.getX(), p.getY() + 0.2, p.getZ(), 5, 3, 0.8)
      ring(p, 'minecraft:dragon_breath', p.getX(), p.getY() + 1.2, p.getZ(), 2.5, 20, 0.4, 0)
      sound(p, 'minecraft:entity.ender_dragon.flap', 1, 1)
      sound(p, 'minecraft:entity.breeze.jump', 1, 0.6)
      ctx.setCooldown(mastered(ctx) ? 5 : 8)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })

  // Dragon Roar (Unique): terror made sound.
  event.create('kubejs:dragon_roar')
    .name('Dragon Roar')
    .description('Roar with the voice of a dragon: every creature within 14 blocks is stunned (Slowness V, Weakness III) for 4 seconds, loses its target and takes 10 damage. Costs 700 magicules, 25 s cooldown.')
    .type('unique')
    .icon('kubejs:skill/dragon/dragon_roar')
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(700)) { ctx.tell('Not enough magicules.'); return }
      var radius = mastered(ctx) ? 18 : 14
      var victims = hostilesNear(p, radius)
      for (var v = 0; v < victims.length; v++) {
        effect(victims[v], 'minecraft:slowness', 80, 4)
        effect(victims[v], 'minecraft:weakness', 80, 2)
        clearTarget(victims[v])
        hurt(p, victims[v], 10)
      }
      fxEntity(p, 'dragon_roar', { autoRotate: 'none', forcedDeath: true, scale: radius / 14 })
      for (var r = 2; r <= radius; r += 3) ring(p, 'minecraft:sonic_boom', p.getX(), p.getY() + 1, p.getZ(), r, 10 + r, 0, r)
      shockwave(p, 'minecraft:dragon_breath', p.getX(), p.getY() + 0.3, p.getZ(), radius, 4, 1.0)
      sound(p, 'minecraft:entity.ender_dragon.growl', 1, 0.7)
      sound(p, 'minecraft:entity.warden.sonic_boom', 0.8, 0.8)
      actionbar(p, 30, 'A dragon\'s roar shakes the earth!', 'light_purple')
      ctx.setCooldown(mastered(ctx) ? 18 : 25)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })

  // Cataclysm (Ultimate): meteors, delivered over five ticks of impacts.
  event.create('kubejs:cataclysm')
    .name('Cataclysm')
    .description('ULTIMATE. Call a rain of burning stars on everything within 15 blocks: 60 damage (90 mastered) split over five impacts, each impact a blast of dragonfire. Costs 3000 magicules, 60 s cooldown.')
    .type('ultimate')
    .icon('kubejs:skill/dragon/cataclysm')
    .canTick(true)
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(3000)) { ctx.tell('Not enough magicules.'); return }
      var tag = ctx.instance.getOrCreateTag()
      tag.putInt('meteors', 5)
      tag.putLong('nextMeteor', now(p) + 10)
      tag.putDouble('meteorDmg', (mastered(ctx) ? 90 : 60) / 5)
      pillar(p, 'minecraft:dragon_breath', p.getX(), p.getY(), p.getZ(), 8, 3)
      sound(p, 'minecraft:entity.ender_dragon.growl', 1, 0.5)
      title(p, 40, 'CATACLYSM', 'red', 'The sky falls')
      ctx.setCooldown(mastered(ctx) ? 45 : 60)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      var tag = ctx.instance.getOrCreateTag()
      var left = tag.getInt('meteors')
      if (left <= 0 || tag.getLong('nextMeteor') > now(p)) return
      tag.putInt('meteors', left - 1)
      tag.putLong('nextMeteor', now(p) + 12)
      var dmg = tag.getDouble('meteorDmg')
      var mx = p.getX() + (Math.random() - 0.5) * 24, mz = p.getZ() + (Math.random() - 0.5) * 24
      var my = p.getY()
      fxAt(p, 'cataclysm_meteor', mx, my, mz, {})
      // Falling streak, impact ring, fire and lava.
      beamLine(p, 'minecraft:flame', mx + 6, my + 14, mz + 6, -0.39, -0.9, -0.39, 15, 0.5, 0.2)
      particles(p, 'minecraft:explosion_emitter', mx, my + 1, mz, 0, 0, 0, 1, 0)
      shockwave(p, 'minecraft:lava', mx, my + 0.3, mz, 6, 3, 0.7)
      shockwave(p, 'minecraft:dragon_breath', mx, my + 0.5, mz, 5, 2, 0.5)
      cmd(p, `playsound minecraft:entity.generic.explode player @a ${mx.toFixed(1)} ${my.toFixed(1)} ${mz.toFixed(1)} 1 0.6`)
      var victims = hostilesNear(p, 15)
      for (var v = 0; v < victims.length; v++) {
        var dx = victims[v].getX() - mx, dz = victims[v].getZ() - mz
        var near = dx * dx + dz * dz <= 49
        hurt(p, victims[v], near ? dmg * 1.5 : dmg)
        if (near) { ignite(victims[v], 8); push(victims[v], mx, mz, 1.0, 0.6) }
      }
    })

  // Three Crowns (Ultimate toggle): the apex transformation.
  event.create('kubejs:three_crowns')
    .name('Three Crowns')
    .description('ULTIMATE. Toggle. Wear the crowns of the holy king, the demon lord and the dragon at once: Strength III, Resistance II, Regeneration III, Speed II, Fire Resistance, an aura that burns and withers every enemy within 8 blocks, and 20% of all damage taken is reflected. Drains 60 magicules per second.')
    .type('ultimate')
    .icon('kubejs:skill/dragon/three_crowns')
    .canBeToggled(true)
    .canTick(ctx => ctx.isToggled())
    .onToggleOn(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      fxEntity(p, 'three_crowns', { autoRotate: 'none', allowMulti: false })
      var x = p.getX(), y = p.getY(), z = p.getZ()
      pillar(p, 'minecraft:end_rod', x, y, z, 14, 4)
      helix(p, 'minecraft:soul_fire_flame', x, y, z, 1.4, 5, 3, 0)
      helix(p, 'minecraft:dragon_breath', x, y, z, 1.4, 5, 3, Math.PI / 2)
      shockwave(p, 'minecraft:firework', x, y + 0.3, z, 10, 5, 0.8)
      sound(p, 'minecraft:item.totem.use', 1, 0.6)
      sound(p, 'minecraft:entity.ender_dragon.growl', 1, 1.2)
      sound(p, 'minecraft:entity.wither.spawn', 0.6, 1.4)
      title(p, 48, 'THREE CROWNS', 'gold', 'Holy, demonic, draconic')
    })
    .onToggleOff(ctx => {
      var bad = ['minecraft:strength', 'minecraft:resistance', 'minecraft:regeneration', 'minecraft:speed']
      for (var i = 0; i < bad.length; i++) removeEffect(ctx.entity, bad[i])
      fxRemove(ctx.entity, 'three_crowns')
    })
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      var t = p.tickCount
      var x = p.getX(), y = p.getY(), z = p.getZ()
      if (t % 3 == 0) {
        var a = t * 0.25
        particles(p, 'minecraft:end_rod', x + Math.cos(a) * 1.3, y + 1.2 + Math.sin(a * 0.5) * 0.5, z + Math.sin(a) * 1.3, 0, 0, 0, 1, 0)
        particles(p, 'minecraft:soul_fire_flame', x + Math.cos(a + 2.1) * 1.3, y + 1.2 + Math.sin(a * 0.5 + 1) * 0.5, z + Math.sin(a + 2.1) * 1.3, 0, 0, 0, 1, 0)
        particles(p, 'minecraft:dragon_breath', x + Math.cos(a + 4.2) * 1.3, y + 1.2 + Math.sin(a * 0.5 + 2) * 0.5, z + Math.sin(a + 4.2) * 1.3, 0, 0, 0, 1, 0)
      }
      if (t % 20 != 0) return
      if (!ctx.consumeMagicule(60)) {
        ctx.instance.setToggled(false)
        ctx.instance.onToggleOff(p)
        ctx.instance.markDirty()
        ctx.tell('The crowns slip from your brow: out of magicules.')
        return
      }
      effect(p, 'minecraft:strength', 60, 2)
      effect(p, 'minecraft:resistance', 60, 1)
      effect(p, 'minecraft:regeneration', 60, 2)
      effect(p, 'minecraft:speed', 60, 1)
      effect(p, 'minecraft:fire_resistance', 60, 0)
      var mobs = hostilesNear(p, 8)
      for (var i = 0; i < mobs.length; i++) {
        hurt(p, mobs[i], mastered(ctx) ? 6 : 4)
        effect(mobs[i], 'minecraft:wither', 40, 0)
        ignite(mobs[i], 2)
        beamLine(p, 'minecraft:soul_fire_flame', x, y + 1, z, (mobs[i].getX() - x) / 8, (mobs[i].getY() - y) / 8, (mobs[i].getZ() - z) / 8, 8, 1, 0.05)
      }
      ring(p, 'minecraft:end_rod', x, y + 0.1, z, 8, 32, 0, t * 0.05)
      if (t % 200 == 0) ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })
    .onTakenDamage(ctx => {
      if (!ctx.isToggled()) return true
      var amount = Number(ctx.amount())
      try {
        var attacker = ctx.source.getEntity()
        if (attacker && attacker.isAlive() && !attacker.equals(ctx.entity) && typeof attacker.getHealth === 'function') {
          hurt(ctx.entity, attacker, amount * 0.2)
          burst(ctx.entity, 'minecraft:end_rod', attacker.getX(), attacker.getY() + 1, attacker.getZ(), 12, 0.3)
        }
      } catch (e) { /* ignore */ }
      return true
    })

  // World Ender (Ultimate): the apex nuke.
  event.create('kubejs:world_ender')
    .name('World Ender')
    .description('ULTIMATE. Everything within 30 blocks is struck by lightning and holy-demonic fire for 200 damage (300 mastered). Costs 8000 magicules, 5 minute cooldown.')
    .type('ultimate')
    .icon('kubejs:skill/dragon/world_ender')
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      if (ctx.cooldown() > 0) { ctx.tell('The world is not ready to end again.'); return }
      if (!ctx.consumeMagicule(8000)) { ctx.tell('Not enough magicules.'); return }
      var dmg = mastered(ctx) ? 300 : 200
      var x = p.getX(), y = p.getY(), z = p.getZ()
      fxEntity(p, 'world_ender', { autoRotate: 'none', forcedDeath: true })
      var victims = hostilesNear(p, 30)
      for (var v = 0; v < victims.length; v++) {
        try { p.level.spawnLightning(victims[v].getX(), victims[v].getY(), victims[v].getZ(), true) } catch (e) { /* ignore */ }
        pillar(p, 'minecraft:end_rod', victims[v].getX(), victims[v].getY(), victims[v].getZ(), 8, 2)
        hurt(p, victims[v], dmg)
        ignite(victims[v], 10)
      }
      pillar(p, 'minecraft:end_rod', x, y, z, 30, 2)
      shockwave(p, 'minecraft:end_rod', x, y + 0.5, z, 30, 8, 1.2)
      shockwave(p, 'minecraft:soul_fire_flame', x, y + 1, z, 30, 6, 1.0)
      shockwave(p, 'minecraft:dragon_breath', x, y + 1.5, z, 30, 4, 0.8)
      particles(p, 'minecraft:explosion_emitter', x, y + 1, z, 3, 1, 3, 8, 0)
      particles(p, 'minecraft:flash', x, y + 2, z, 0, 0, 0, 1, 0)
      sound(p, 'minecraft:entity.lightning_bolt.thunder', 1, 0.5)
      sound(p, 'minecraft:entity.generic.explode', 1, 0.4)
      sound(p, 'minecraft:entity.ender_dragon.death', 1, 0.8)
      sound(p, 'minecraft:entity.wither.death', 1, 0.5)
      title(p, 64, 'WORLD ENDER', 'white', 'Nothing remains')
      ctx.setCooldown(mastered(ctx) ? 240 : 300)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })
})

// =====================================================================
// 3. Races
// =====================================================================
StartupEvents.registry(TensuraKubeJS.RACE_REGISTRY, event => {

  event.create('kubejs:wyrmling')
    .name('Wyrmling')
    .description('A newly hatched dragon, soft-scaled and fragile: 8 health and a slow crawl, but a vast magicule reserve. Race ability: Ember Spit. Evolves to Drake at 8,000 EP.')
    .difficulty('hard')
    .startingRace(true)
    .randomStartingRace(false)
    .defaultEvolution('kubejs:drake')
    .baseAura(200, 300).baseMagicule(1200, 1600).size(-0.1)
    .maxHealth(8).maxSpiritualHealth(40).attack(1).attackSpeed(-0.05).knockbackResistance(0).movementSpeed(-0.01).swimSpeed(0)
    .intrinsicSkill('kubejs:dragon_breath')
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var target = null
      try { target = p.rayTraceEntity(8, e => e.isLiving() && !e.equals(p)) } catch (e) { target = null }
      if (!target) return
      hurt(p, target, 4)
      ignite(target, 3)
      beamLine(p, 'minecraft:flame', p.getX(), p.getEyeY(), p.getZ(), (target.getX() - p.getX()) / 8, (target.getY() + 1 - p.getEyeY()) / 8, (target.getZ() - p.getZ()) / 8, 8, 1, 0.1)
      sound(p, 'minecraft:entity.blaze.shoot', 0.6, 1.6)
      ctx.setCooldown(100)
    })

  event.create('kubejs:drake')
    .name('Drake')
    .description('Scales hardened, wings budding. Race ability: Wing Gust (leap and scatter foes). Evolves to Dragon at 60,000 EP.')
    .difficulty('hard')
    .previousEvolution('kubejs:wyrmling')
    .defaultEvolution('kubejs:dragon')
    .baseAura(2000, 3000).baseMagicule(5000, 7000).size(0.05)
    .maxHealth(30).maxSpiritualHealth(120).attack(4).attackSpeed(0.05).knockbackResistance(0.15).movementSpeed(0.03).swimSpeed(0.05)
    .epRequirement(8000)
    .intrinsicSkill('kubejs:draconic_scales')
    .intrinsicSkill('kubejs:wings_of_the_wyrm')
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      launch(p, 0, 1.0, 0)
      var mobs = hostilesNear(p, 5)
      for (var i = 0; i < mobs.length; i++) push(mobs[i], p.getX(), p.getZ(), 1.2, 0.3)
      fxEntity(p, 'wing_gust', { autoRotate: 'none', forcedDeath: true })
      shockwave(p, 'minecraft:cloud', p.getX(), p.getY() + 0.2, p.getZ(), 5, 3, 0.7)
      sound(p, 'minecraft:entity.ender_dragon.flap', 1, 1.2)
      ctx.setCooldown(300)
    })

  event.create('kubejs:dragon')
    .name('Dragon')
    .description('A true dragon. Passive: immune to fire, regenerates while airborne. Race ability: Draconic Descent (slam down, damaging everything within 6 blocks). Evolves to Elder Dragon at 300,000 EP by consuming a Dragon Heart.')
    .difficulty('hard')
    .previousEvolution('kubejs:drake')
    .defaultEvolution('kubejs:elder_dragon')
    .baseAura(9000, 12000).baseMagicule(20000, 26000).size(0.15)
    .maxHealth(70).maxSpiritualHealth(300).attack(9).attackSpeed(0.1).knockbackResistance(0.4).movementSpeed(0.05).swimSpeed(0.1)
    .epRequirement(60000)
    .intrinsicSkill('kubejs:dragon_roar')
    .canTick(true)
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 20 != 0) return
      effect(p, 'minecraft:fire_resistance', 60, 0)
      try { if (!p.onGround()) effect(p, 'minecraft:regeneration', 40, 0) } catch (e) { /* ignore */ }
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      launch(p, 0, -2.5, 0)
      var mobs = hostilesNear(p, 6)
      for (var i = 0; i < mobs.length; i++) { hurt(p, mobs[i], 14); push(mobs[i], p.getX(), p.getZ(), 1.0, 0.5) }
      fxEntity(p, 'draconic_descent', { autoRotate: 'none', forcedDeath: true })
      shockwave(p, 'minecraft:dragon_breath', p.getX(), p.getY() + 0.3, p.getZ(), 6, 3, 0.7)
      particles(p, 'minecraft:explosion', p.getX(), p.getY() + 0.5, p.getZ(), 2, 0.5, 2, 6, 0.1)
      sound(p, 'minecraft:entity.generic.explode', 0.8, 0.9)
      ctx.setCooldown(400)
    })

  event.create('kubejs:elder_dragon')
    .name('Elder Dragon')
    .description('The final form of the dragon line. Passive: immune to fire and wither. Race ability: Draconic Nova (a 12-block burst of dragon fire). Can ascend to Sovereign of the Three Crowns.')
    .difficulty('hard')
    .previousEvolution('kubejs:dragon')
    .nextEvolution('kubejs:primordial_sovereign')
    .baseAura(30000, 40000).baseMagicule(60000, 80000).size(0.25)
    .maxHealth(120).maxSpiritualHealth(800).attack(14).attackSpeed(0.15).knockbackResistance(0.6).movementSpeed(0.07).swimSpeed(0.15)
    .epRequirement(300000)
    .itemConsumeRequirement('kubejs:dragon_heart', 1)
    .intrinsicSkill('kubejs:cataclysm')
    .canTick(true)
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 20 != 0) return
      effect(p, 'minecraft:fire_resistance', 60, 0)
      removeEffect(p, 'minecraft:wither')
      if (p.tickCount % 60 == 0) ring(p, 'minecraft:dragon_breath', p.getX(), p.getY() + 0.1, p.getZ(), 1.5, 10, 0, p.tickCount * 0.1)
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var mobs = hostilesNear(p, 12)
      for (var i = 0; i < mobs.length; i++) { hurt(p, mobs[i], 30); ignite(mobs[i], 8); push(mobs[i], p.getX(), p.getZ(), 1.5, 0.4) }
      fxEntity(p, 'draconic_nova', { autoRotate: 'none', forcedDeath: true })
      shockwave(p, 'minecraft:dragon_breath', p.getX(), p.getY() + 1, p.getZ(), 12, 5, 0.9)
      shockwave(p, 'minecraft:flame', p.getX(), p.getY() + 0.3, p.getZ(), 12, 4, 0.8)
      sound(p, 'minecraft:entity.ender_dragon.growl', 1, 0.6)
      title(p, 32, 'DRACONIC NOVA', 'light_purple', 'The elder wakes')
      ctx.setCooldown(1200)
    })

  event.create('kubejs:primordial_sovereign')
    .name('Sovereign of the Three Crowns')
    .description('One who walked the holy, the demonic and the draconic paths and took every crown. 10,000 health, immense magicules, immune to fire, wither and poison, and regenerating 1% health per second. Race ability: Coronation (full restore of yourself and every ally within 20 blocks, and 30 seconds of Strength III). Requires 1,500,000 EP and consumes a Holy Grail, an Archdemon Heart, a Dragon Heart and the Essence of the Three Crowns.')
    .difficulty('hard')
    .previousEvolution('kubejs:divine_sovereign')
    .previousEvolution('kubejs:demon_king')
    .previousEvolution('kubejs:elder_dragon')
    .baseAura(400000, 500000).baseMagicule(600000, 800000).size(0.3)
    .maxHealth(10000).maxSpiritualHealth(10000).attack(40).attackSpeed(0.3).knockbackResistance(1.0).movementSpeed(0.12).swimSpeed(0.3)
    .epRequirement(1500000)
    .itemConsumeRequirement('kubejs:holy_grail', 1)
    .itemConsumeRequirement('kubejs:demon_heart', 1)
    .itemConsumeRequirement('kubejs:dragon_heart', 1)
    .itemConsumeRequirement('kubejs:essence_of_three_crowns', 1)
    .intrinsicSkill('kubejs:three_crowns')
    .intrinsicSkill('kubejs:world_ender')
    .intrinsicSkill('kubejs:excalibur_release')
    .intrinsicSkill('kubejs:clarent_blood_arthur')
    .intrinsicSkill('kubejs:cataclysm')
    .intrinsicSkill('kubejs:avalon')
    .canTick(true)
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 20 != 0) return
      effect(p, 'minecraft:fire_resistance', 60, 0)
      removeEffect(p, 'minecraft:wither')
      removeEffect(p, 'minecraft:poison')
      if (health(p) < maxHealth(p)) heal(p, maxHealth(p) * 0.01)
      if (p.tickCount % 40 == 0) ring(p, 'minecraft:end_rod', p.getX(), p.getY() + 2.3, p.getZ(), 0.45, 9, 0, p.tickCount * 0.1)
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var allies = playersNear(p, 20, true)
      for (var i = 0; i < allies.length; i++) {
        fullRestore(allies[i])
        effect(allies[i], 'minecraft:strength', 600, 2)
        effect(allies[i], 'minecraft:absorption', 600, 4)
        pillar(p, 'minecraft:end_rod', allies[i].getX(), allies[i].getY(), allies[i].getZ(), 6, 3)
      }
      fxEntity(p, 'coronation', { autoRotate: 'none', forcedDeath: true })
      pillar(p, 'minecraft:end_rod', p.getX(), p.getY(), p.getZ(), 20, 3)
      shockwave(p, 'minecraft:firework', p.getX(), p.getY() + 0.3, p.getZ(), 20, 6, 0.9)
      particles(p, 'minecraft:totem_of_undying', p.getX(), p.getY() + 1, p.getZ(), 3, 2, 3, 100, 0.3)
      sound(p, 'minecraft:item.totem.use', 1, 0.8)
      sound(p, 'minecraft:ui.toast.challenge_complete', 1, 0.8)
      title(p, 48, 'CORONATION', 'gold', 'Three crowns, one sovereign')
      ctx.setCooldown(3600)
    })
    .onRaceEvolution(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      var who = isPlayerEntity(p) ? p.getName().getString() : 'A sovereign'
      cmd(p, `title @a title {"text":"${who} has claimed the Three Crowns","color":"gold","bold":true}`)
      sound(p, 'minecraft:ui.toast.challenge_complete', 1, 0.6)
    })
})
