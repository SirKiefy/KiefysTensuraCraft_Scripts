// priority: 85
//
// kubejs/startup_scripts/three_crowns_content.js
// -----------------------------------------------
// The dragon line and the apex race that sits above all three lines:
//
//   Dragon line : kubejs:wyrmling (starting, HARD) -> drake -> dragon -> elder_dragon
//   Apex        : kubejs:primordial_sovereign "Sovereign of the Three Crowns"
//                 reachable from divine_sovereign, demon_king AND elder_dragon,
//                 gated by 1,500,000 EP and the proof of every path:
//                 Holy Grail (Leonis), Archdemon Heart (Balor), Dragon Heart
//                 (crafted from the Ender Dragon's leavings) and the
//                 Essence of the Three Crowns (crafted from the three
//                 path essences, see server_scripts/three_crowns_recipes.js).
//
//   Skills dragon : dragon_breath (extra), draconic_scales (extra),
//                   wings_of_the_wyrm (unique), dragon_roar (unique),
//                   cataclysm (ULTIMATE)
//   Skills apex   : three_crowns (ULTIMATE toggle), world_ender (ULTIMATE)
//
// Helpers (hurt, effect, particles, sound, push, livingNear, hostilesNear,
// inCone, ignite, cmd, fullRestore, mastered, isServerLiving) come from
// holy_knight_content.js (priority 90): startup scripts share one scope.

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
    .description('Exhale a 9-block cone of draconic fire: 14 damage (24 mastered), 6 seconds of burning and Wither. Costs 400 magicules, 7 s cooldown.')
    .type('extra')
    .icon('kubejs:skill/dragon/dragon_breath')
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(400)) { ctx.tell('Not enough magicules.'); return }
      var dmg = mastered(ctx) ? 24 : 14
      var look = p.getLookAngle()
      for (var s = 1; s <= 9; s++) {
        particles(p, 'minecraft:dragon_breath', p.x + Number(look.x()) * s, p.y + 1.2 + Number(look.y()) * s, p.z + Number(look.z()) * s, 0.3 * s, 0.3 * s, 0.3 * s, 14, 0.05)
        particles(p, 'minecraft:flame', p.x + Number(look.x()) * s, p.y + 1.2 + Number(look.y()) * s, p.z + Number(look.z()) * s, 0.25 * s, 0.25 * s, 0.25 * s, 6, 0.05)
      }
      var victims = livingNear(p, 10, false)
      for (var v = 0; v < victims.length; v++) {
        if (!inCone(p, victims[v], 9.5, 30)) continue
        hurt(p, victims[v], dmg)
        ignite(victims[v], 6)
        effect(victims[v], 'minecraft:wither', 80, 0)
      }
      sound(p, 'minecraft:entity.ender_dragon.shoot', 1, 0.8)
      ctx.setCooldown(mastered(ctx) ? 5 : 7)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })

  // Draconic Scales (Extra): armour of scales.
  event.create('kubejs:draconic_scales')
    .name('Draconic Scales')
    .description('Toggle. Scales harden over your body: damage taken is reduced by 40% (55% mastered) and you cannot be set on fire. Drains 4 magicules per second.')
    .type('extra')
    .icon('kubejs:skill/dragon/draconic_scales')
    .canBeToggled(true)
    .canTick(ctx => ctx.isToggled())
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 20 != 0) return
      if (!ctx.consumeMagicule(4)) {
        ctx.instance.setToggled(false)
        ctx.instance.markDirty()
        ctx.tell('Your scales soften: out of magicules.')
        return
      }
      effect(p, 'minecraft:fire_resistance', 60, 0)
      if (p.tickCount % 200 == 0) ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })
    .onTakenDamage(ctx => {
      if (!ctx.isToggled()) return true
      ctx.setAmount(Number(ctx.amount()) * (mastered(ctx) ? 0.45 : 0.6))
      return true
    })

  // Wings of the Wyrm (Unique): a mighty wing-beat.
  event.create('kubejs:wings_of_the_wyrm')
    .name('Wings of the Wyrm')
    .description('Beat your wings: launch high into the air and glide with Slow Falling for 10 seconds; creatures beneath you are blown away. Costs 250 magicules, 8 s cooldown.')
    .type('unique')
    .icon('kubejs:skill/dragon/wings_of_the_wyrm')
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(250)) { ctx.tell('Not enough magicules.'); return }
      var look = p.getLookAngle()
      try { p.setMotionX(Number(look.x()) * 1.2); p.setMotionY(mastered(ctx) ? 2.2 : 1.6); p.setMotionZ(Number(look.z()) * 1.2); p.hurtMarked = true } catch (e) { /* ignore */ }
      effect(p, 'minecraft:slow_falling', 200, 0)
      var mobs = hostilesNear(p, 5)
      for (var i = 0; i < mobs.length; i++) push(mobs[i], p.x, p.z, 1.3, 0.3)
      particles(p, 'minecraft:cloud', p.x, p.y, p.z, 1.5, 0.3, 1.5, 60, 0.15)
      sound(p, 'minecraft:entity.ender_dragon.flap', 1, 1)
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
      var victims = hostilesNear(p, mastered(ctx) ? 18 : 14)
      for (var v = 0; v < victims.length; v++) {
        effect(victims[v], 'minecraft:slowness', 80, 4)
        effect(victims[v], 'minecraft:weakness', 80, 2)
        try { victims[v].setTarget(null) } catch (e) { /* not a mob */ }
        hurt(p, victims[v], 10)
      }
      for (var r = 2; r <= 14; r += 3) {
        for (var a = 0; a < 16; a++) {
          var ang = a * Math.PI / 8
          particles(p, 'minecraft:sonic_boom', p.x + Math.cos(ang) * r, p.y + 1, p.z + Math.sin(ang) * r, 0, 0, 0, 1, 0)
        }
      }
      sound(p, 'minecraft:entity.ender_dragon.growl', 1, 0.7)
      sound(p, 'minecraft:entity.warden.sonic_boom', 0.8, 0.8)
      cmd(p, 'title @a[distance=..30] actionbar {"text":"A dragon\'s roar shakes the earth!","color":"light_purple"}')
      ctx.setCooldown(mastered(ctx) ? 18 : 25)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })

  // Cataclysm (Ultimate): meteors.
  event.create('kubejs:cataclysm')
    .name('Cataclysm')
    .description('ULTIMATE. Call a rain of burning stars on everything within 15 blocks: 60 damage (90 mastered) split over five impacts, sets the ground ablaze. Costs 3000 magicules, 60 s cooldown.')
    .type('ultimate')
    .icon('kubejs:skill/dragon/cataclysm')
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(3000)) { ctx.tell('Not enough magicules.'); return }
      var dmg = (mastered(ctx) ? 90 : 60) / 5
      var victims = hostilesNear(p, 15)
      for (var wave = 0; wave < 5; wave++) {
        for (var v = 0; v < victims.length; v++) {
          hurt(p, victims[v], dmg)
          if (wave == 4) ignite(victims[v], 8)
        }
        var mx = p.x + (Math.random() - 0.5) * 20, mz = p.z + (Math.random() - 0.5) * 20
        particles(p, 'minecraft:explosion_emitter', mx, p.y + 1, mz, 0, 0, 0, 1, 0)
        particles(p, 'minecraft:lava', mx, p.y + 1, mz, 2, 1, 2, 40, 0.2)
        particles(p, 'minecraft:flame', mx, p.y + 6, mz, 0.3, 4, 0.3, 60, 0.1)
      }
      sound(p, 'minecraft:entity.generic.explode', 1, 0.5)
      sound(p, 'minecraft:entity.ender_dragon.death', 0.4, 1.4)
      cmd(p, 'title @a[distance=..40] title {"text":"CATACLYSM","color":"red","bold":true}')
      ctx.setCooldown(mastered(ctx) ? 45 : 60)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
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
      sound(p, 'minecraft:item.totem.use', 1, 0.6)
      sound(p, 'minecraft:entity.ender_dragon.growl', 1, 1.2)
      particles(p, 'minecraft:end_rod', p.x, p.y + 1, p.z, 2, 2, 2, 200, 0.2)
      particles(p, 'minecraft:soul_fire_flame', p.x, p.y + 1, p.z, 2, 2, 2, 100, 0.2)
      particles(p, 'minecraft:dragon_breath', p.x, p.y + 1, p.z, 2, 2, 2, 100, 0.2)
      cmd(p, 'title @a[distance=..48] title {"text":"THREE CROWNS","color":"gold","bold":true}')
    })
    .onToggleOff(ctx => {
      var bad = ['minecraft:strength', 'minecraft:resistance', 'minecraft:regeneration', 'minecraft:speed']
      for (var i = 0; i < bad.length; i++) removeEffect(ctx.entity, bad[i])
    })
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 20 != 0) return
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
      }
      particles(p, 'minecraft:end_rod', p.x, p.y + 0.2, p.z, 1.5, 0.3, 1.5, 12, 0.02)
      particles(p, 'minecraft:soul_fire_flame', p.x, p.y + 1.8, p.z, 0.4, 0.3, 0.4, 6, 0.02)
      if (p.tickCount % 200 == 0) ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })
    .onTakenDamage(ctx => {
      if (!ctx.isToggled()) return true
      var amount = Number(ctx.amount())
      try {
        var attacker = ctx.source.getEntity()
        if (attacker && attacker.isLiving() && !attacker.equals(ctx.entity)) hurt(ctx.entity, attacker, amount * 0.2)
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
      if (!isServerLiving(p) || ctx.cooldown() > 0) { if (ctx.cooldown() > 0) ctx.tell('The world is not ready to end again.'); return }
      if (!ctx.consumeMagicule(8000)) { ctx.tell('Not enough magicules.'); return }
      var dmg = mastered(ctx) ? 300 : 200
      var victims = hostilesNear(p, 30)
      for (var v = 0; v < victims.length; v++) {
        try { p.level.spawnLightning(victims[v].x, victims[v].y, victims[v].z, true) } catch (e) { /* ignore */ }
        hurt(p, victims[v], dmg)
        ignite(victims[v], 10)
      }
      for (var r = 3; r <= 30; r += 3) {
        for (var a = 0; a < 24; a++) {
          var ang = a * Math.PI / 12
          particles(p, a % 2 == 0 ? 'minecraft:end_rod' : 'minecraft:soul_fire_flame', p.x + Math.cos(ang) * r, p.y + 1, p.z + Math.sin(ang) * r, 0.2, 2, 0.2, 4, 0.1)
        }
      }
      particles(p, 'minecraft:explosion_emitter', p.x, p.y + 1, p.z, 3, 1, 3, 8, 0)
      sound(p, 'minecraft:entity.lightning_bolt.thunder', 1, 0.5)
      sound(p, 'minecraft:entity.generic.explode', 1, 0.4)
      sound(p, 'minecraft:entity.ender_dragon.death', 1, 0.8)
      cmd(p, 'title @a[distance=..64] title {"text":"WORLD ENDER","color":"white","bold":true}')
      ctx.setCooldown(mastered(ctx) ? 240 : 300)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })
})

// =====================================================================
// 3. Races
// =====================================================================
StartupEvents.registry(TensuraKubeJS.RACE_REGISTRY, event => {

  // Wyrmling: the hard start. Fragile, slow, but brimming with magicules.
  event.create('kubejs:wyrmling')
    .name('Wyrmling')
    .description('A newly hatched dragon, soft-scaled and fragile: 8 health and a slow crawl, but a vast magicule reserve. Race ability: Ember Spit. Evolves to Drake at 8,000 EP.')
    .difficulty('hard')
    .startingRace(true)
    .randomStartingRace(false)
    .defaultEvolution('kubejs:drake')
    .baseAura(200, 300)
    .baseMagicule(1200, 1600)
    .size(-0.1)
    .maxHealth(8)
    .maxSpiritualHealth(40)
    .attack(1)
    .attackSpeed(-0.05)
    .knockbackResistance(0)
    .movementSpeed(-0.01)
    .swimSpeed(0)
    .intrinsicSkill('kubejs:dragon_breath')
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var target = null
      try { target = p.rayTraceEntity(8, e => e.isLiving() && !e.equals(p)) } catch (e) { target = null }
      if (!target) return
      hurt(p, target, 4)
      ignite(target, 3)
      particles(p, 'minecraft:flame', target.x, target.y + 1, target.z, 0.3, 0.3, 0.3, 15, 0.05)
      sound(p, 'minecraft:entity.blaze.shoot', 0.6, 1.6)
      ctx.setCooldown(100)
    })

  event.create('kubejs:drake')
    .name('Drake')
    .description('Scales hardened, wings budding. Race ability: Wing Gust (leap and scatter foes). Evolves to Dragon at 60,000 EP.')
    .difficulty('hard')
    .previousEvolution('kubejs:wyrmling')
    .defaultEvolution('kubejs:dragon')
    .baseAura(2000, 3000)
    .baseMagicule(5000, 7000)
    .size(0.05)
    .maxHealth(30)
    .maxSpiritualHealth(120)
    .attack(4)
    .attackSpeed(0.05)
    .knockbackResistance(0.15)
    .movementSpeed(0.03)
    .swimSpeed(0.05)
    .epRequirement(8000)
    .intrinsicSkill('kubejs:draconic_scales')
    .intrinsicSkill('kubejs:wings_of_the_wyrm')
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      try { p.setMotionY(1.0); p.hurtMarked = true } catch (e) { /* ignore */ }
      var mobs = hostilesNear(p, 5)
      for (var i = 0; i < mobs.length; i++) push(mobs[i], p.x, p.z, 1.2, 0.3)
      particles(p, 'minecraft:cloud', p.x, p.y, p.z, 1.5, 0.3, 1.5, 40, 0.1)
      sound(p, 'minecraft:entity.ender_dragon.flap', 1, 1.2)
      ctx.setCooldown(300)
    })

  event.create('kubejs:dragon')
    .name('Dragon')
    .description('A true dragon. Passive: immune to fire, regenerates while airborne. Race ability: Draconic Descent (slam down, damaging everything within 6 blocks). Evolves to Elder Dragon at 300,000 EP by consuming a Dragon Heart.')
    .difficulty('hard')
    .previousEvolution('kubejs:drake')
    .defaultEvolution('kubejs:elder_dragon')
    .baseAura(9000, 12000)
    .baseMagicule(20000, 26000)
    .size(0.15)
    .maxHealth(70)
    .maxSpiritualHealth(300)
    .attack(9)
    .attackSpeed(0.1)
    .knockbackResistance(0.4)
    .movementSpeed(0.05)
    .swimSpeed(0.1)
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
      try { p.setMotionY(-2.5); p.hurtMarked = true } catch (e) { /* ignore */ }
      var mobs = hostilesNear(p, 6)
      for (var i = 0; i < mobs.length; i++) { hurt(p, mobs[i], 14); push(mobs[i], p.x, p.z, 1.0, 0.5) }
      particles(p, 'minecraft:explosion', p.x, p.y + 0.5, p.z, 2, 0.5, 2, 6, 0.1)
      sound(p, 'minecraft:entity.generic.explode', 0.8, 0.9)
      ctx.setCooldown(400)
    })

  event.create('kubejs:elder_dragon')
    .name('Elder Dragon')
    .description('The final form of the dragon line. Passive: immune to fire and wither, Dragon Breath costs nothing while below half health. Race ability: Draconic Nova (a 12-block burst of dragon fire). Can ascend to Sovereign of the Three Crowns.')
    .difficulty('hard')
    .previousEvolution('kubejs:dragon')
    .nextEvolution('kubejs:primordial_sovereign')
    .baseAura(30000, 40000)
    .baseMagicule(60000, 80000)
    .size(0.25)
    .maxHealth(120)
    .maxSpiritualHealth(800)
    .attack(14)
    .attackSpeed(0.15)
    .knockbackResistance(0.6)
    .movementSpeed(0.07)
    .swimSpeed(0.15)
    .epRequirement(300000)
    .itemConsumeRequirement('kubejs:dragon_heart', 1)
    .intrinsicSkill('kubejs:cataclysm')
    .canTick(true)
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 20 != 0) return
      effect(p, 'minecraft:fire_resistance', 60, 0)
      removeEffect(p, 'minecraft:wither')
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var mobs = hostilesNear(p, 12)
      for (var i = 0; i < mobs.length; i++) { hurt(p, mobs[i], 30); ignite(mobs[i], 8); push(mobs[i], p.x, p.z, 1.5, 0.4) }
      particles(p, 'minecraft:dragon_breath', p.x, p.y + 1, p.z, 6, 1, 6, 300, 0.2)
      particles(p, 'minecraft:flame', p.x, p.y + 1, p.z, 6, 1, 6, 200, 0.2)
      sound(p, 'minecraft:entity.ender_dragon.growl', 1, 0.6)
      ctx.setCooldown(1200)
    })

  // -------------------------------------------------------------------
  // Sovereign of the Three Crowns: the apex. 10,000 health.
  // -------------------------------------------------------------------
  event.create('kubejs:primordial_sovereign')
    .name('Sovereign of the Three Crowns')
    .description('One who walked the holy, the demonic and the draconic paths and took every crown. 10,000 health, immense magicules, immune to fire, wither and poison, and regenerating 1% health per second. Race ability: Coronation (full restore of yourself and every ally within 20 blocks, and 30 seconds of Strength III). Requires 1,500,000 EP and consumes a Holy Grail, an Archdemon Heart, a Dragon Heart and the Essence of the Three Crowns.')
    .difficulty('hard')
    .previousEvolution('kubejs:divine_sovereign')
    .previousEvolution('kubejs:demon_king')
    .previousEvolution('kubejs:elder_dragon')
    .baseAura(400000, 500000)
    .baseMagicule(600000, 800000)
    .size(0.3)
    .maxHealth(10000)
    .maxSpiritualHealth(10000)
    .attack(40)
    .attackSpeed(0.3)
    .knockbackResistance(1.0)
    .movementSpeed(0.12)
    .swimSpeed(0.3)
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
      try { if (p.health < p.getMaxHealth()) p.heal(p.getMaxHealth() * 0.01) } catch (e) { /* ignore */ }
      if (p.tickCount % 40 == 0) particles(p, 'minecraft:end_rod', p.x, p.y + 2.2, p.z, 0.3, 0.1, 0.3, 3, 0.01)
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var allies = livingNear(p, 20, true)
      for (var i = 0; i < allies.length; i++) {
        if (!allies[i].isPlayer()) continue
        fullRestore(allies[i])
        effect(allies[i], 'minecraft:strength', 600, 2)
        effect(allies[i], 'minecraft:absorption', 600, 4)
      }
      particles(p, 'minecraft:end_rod', p.x, p.y + 1, p.z, 8, 3, 8, 400, 0.1)
      particles(p, 'minecraft:totem_of_undying', p.x, p.y + 1, p.z, 3, 2, 3, 100, 0.3)
      sound(p, 'minecraft:item.totem.use', 1, 0.8)
      sound(p, 'minecraft:ui.toast.challenge_complete', 1, 0.8)
      cmd(p, 'title @a[distance=..48] title {"text":"CORONATION","color":"gold","bold":true}')
      ctx.setCooldown(3600)
    })
    .onRaceEvolution(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      var who = p.isPlayer() ? p.username : 'A sovereign'
      cmd(p, `title @a title {"text":"${who} has claimed the Three Crowns","color":"gold","bold":true}`)
      sound(p, 'minecraft:ui.toast.challenge_complete', 1, 0.6)
    })
})
