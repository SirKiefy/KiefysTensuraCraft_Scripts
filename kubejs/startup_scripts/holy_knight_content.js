// priority: 90
//
// kubejs/startup_scripts/holy_knight_content.js
// ----------------------------------------------
// Holy-knight / demonic content pack built on TensurJS (tensura_kubejs).
// Helpers (hurt, effect, particles, fxEntity, ...) live in holy_fx_lib.js.
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
// Every ability plays a Photon 2 effect if one is exported to the id it
// asks for (see assets/kubejs/fx/README.md) AND a vanilla particle
// choreography that always plays.

// =====================================================================
// 1. Weapons
// =====================================================================
StartupEvents.registry('item', event => {
  event.create('kubejs:excalibur', 'sword')
    .tier('netherite').attackDamageBaseline(12).speedBaseline(-2.4)
    .displayName('Excalibur, Sword of Promised Victory').rarity('epic').unstackable().fireResistant()

  event.create('kubejs:clarent', 'sword')
    .tier('netherite').attackDamageBaseline(11).speedBaseline(-2.2)
    .displayName('Clarent, Blood Arthur').rarity('epic').unstackable().fireResistant()

  event.create('kubejs:rhongomyniad', 'sword')
    .tier('netherite').attackDamageBaseline(10).speedBaseline(-2.8)
    .displayName('Rhongomyniad, Lance of the Ending').rarity('epic').unstackable().fireResistant()

  event.create('kubejs:holy_grail').displayName('Holy Grail').rarity('epic').maxStackSize(1)
  event.create('kubejs:demon_heart').displayName('Archdemon Heart').rarity('epic').maxStackSize(1)
})

// =====================================================================
// 2. Skills
// =====================================================================
StartupEvents.registry(TensuraKubeJS.SKILL_REGISTRY, event => {

  // -------------------------------------------------------------------
  // HOLY
  // -------------------------------------------------------------------

  // Divine Smite (Common): a pillar of holy light on the target you look at.
  event.create('kubejs:divine_smite')
    .name('Divine Smite')
    .description('Call down a pillar of holy light on the creature you are looking at (20 blocks). 15 holy damage, doubled against the undead, and the light chains to up to 3 nearby enemies. Costs 150 magicules, 6 s cooldown.')
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
      var tx = target.getX(), ty = target.getY(), tz = target.getZ()
      // Visuals: photon pillar + vanilla pillar, ring and lightning flash.
      fxAt(player, 'divine_smite_pillar', tx, ty, tz, { scale: mastered(ctx) ? 1.5 : 1 })
      try { player.level.spawnLightning(tx, ty, tz, true) } catch (e) { /* visual only */ }
      pillar(player, 'minecraft:end_rod', tx, ty, tz, 12, 3)
      shockwave(player, 'minecraft:firework', tx, ty + 0.2, tz, 3, 2, 0.35)
      burst(player, 'minecraft:electric_spark', tx, ty + 1, tz, 30, 0.4)
      sound(player, 'minecraft:entity.lightning_bolt.impact', 0.8, 1.6)
      sound(player, 'minecraft:block.beacon.power_select', 1, 1.8)
      hurt(player, target, isUndeadEntity(target) ? dmg * 2 : dmg)
      effect(target, 'minecraft:glowing', 100, 0)
      // Chain lightning to nearby enemies.
      var chained = 0
      var near = hostilesNear(target, 5)
      for (var i = 0; i < near.length && chained < 3; i++) {
        if (near[i].equals(target)) continue
        chained++
        beamLine(player, 'minecraft:electric_spark', tx, ty + 1, tz, near[i].getX() - tx, near[i].getY() + 1 - ty - 1, near[i].getZ() - tz, 1, 0.1, 0.05)
        hurt(player, near[i], dmg * 0.5)
        effect(near[i], 'minecraft:glowing', 60, 0)
      }
      ctx.setCooldown(mastered(ctx) ? 4 : 6)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
    })

  // Wall of the Kingdom (Extra): magicule-fed damage reduction.
  event.create('kubejs:wall_of_the_kingdom')
    .name('Wall of the Kingdom')
    .description('Toggle. Your resolve becomes a wall: incoming damage is reduced by 35% (50% mastered), every blocked hit costs magicules equal to four times the damage prevented, and attackers who strike the wall are staggered and knocked back. Turns off when your magicules run out.')
    .type('extra')
    .icon('kubejs:skill/holy/wall_of_the_kingdom')
    .canBeToggled(true)
    .canTick(ctx => ctx.isToggled())
    .onToggleOn(ctx => {
      fxEntity(ctx.entity, 'wall_of_the_kingdom', { autoRotate: 'none', allowMulti: false })
      ring(ctx.entity, 'minecraft:end_rod', ctx.entity.getX(), ctx.entity.getY() + 0.1, ctx.entity.getZ(), 1.5, 24, 0.15, 0)
      sound(ctx.entity, 'minecraft:item.shield.block', 1, 0.7)
    })
    .onToggleOff(ctx => fxRemove(ctx.entity, 'wall_of_the_kingdom'))
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      var t = p.tickCount
      if (t % 10 == 0) ring(p, 'minecraft:enchanted_hit', p.getX(), p.getY() + 0.8, p.getZ(), 1.1, 6, 0, t * 0.15)
      if (t % 100 == 0) ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
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
        fxRemove(ctx.entity, 'wall_of_the_kingdom')
        ctx.tell('Wall of the Kingdom collapses: out of magicules.')
        return true
      }
      ctx.setAmount(amount - prevented)
      var p = ctx.entity
      fxEntity(p, 'wall_block', { autoRotate: 'look', forcedDeath: true })
      ring(p, 'minecraft:enchanted_hit', p.getX(), p.getY() + 1, p.getZ(), 1.3, 16, 0.3, 0)
      sound(p, 'minecraft:item.shield.block', 1, 1.2)
      try {
        var attacker = ctx.source.getEntity()
        if (attacker && attacker.isAlive() && !attacker.equals(p) && typeof attacker.getHealth === 'function') {
          push(attacker, p.getX(), p.getZ(), 0.8, 0.3)
          effect(attacker, 'minecraft:slowness', 30, 1)
        }
      } catch (e) { /* ignore */ }
      return true
    })

  // Invisible Air (Extra): wind barrier that shoves enemies back and blunts projectiles.
  event.create('kubejs:invisible_air')
    .name('Invisible Air: Barrier of the Wind King')
    .description('Toggle. A sheath of compressed wind pushes hostile creatures away every half second, blunts projectiles by 75%, grants Speed, and lets you press the skill again while toggled to fire Strike Air: a wind blade that hurls everything in front of you. Drains 3 magicules per second.')
    .type('extra')
    .icon('kubejs:skill/holy/invisible_air')
    .canBeToggled(true)
    .canTick(ctx => ctx.isToggled())
    .onToggleOn(ctx => {
      fxEntity(ctx.entity, 'invisible_air', { autoRotate: 'none', allowMulti: false })
      sound(ctx.entity, 'minecraft:item.elytra.flying', 0.6, 1.5)
    })
    .onToggleOff(ctx => {
      removeEffect(ctx.entity, 'minecraft:speed')
      fxRemove(ctx.entity, 'invisible_air')
    })
    .onPressed(ctx => {
      // Strike Air: only while toggled.
      var p = ctx.entity
      if (!isServerLiving(p) || !ctx.isToggled() || ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(200)) { ctx.tell('Not enough magicules.'); return }
      var look = lookVec(p)
      fxEntity(p, 'strike_air', { autoRotate: 'look', forcedDeath: true })
      for (var s = 1; s <= 10; s++) {
        var w = 0.3 + s * 0.25
        ring(p, 'minecraft:cloud', p.getX() + look.x * s, p.getEyeY() - 0.4 + look.y * s, p.getZ() + look.z * s, w, 10, 0.05, s)
        shoot(p, 'minecraft:sweep_attack', p.getX() + look.x * s, p.getEyeY() - 0.4 + look.y * s, p.getZ() + look.z * s, look.x, 0, look.z, 0.3)
      }
      var victims = livingNear(p, 11, false)
      for (var v = 0; v < victims.length; v++) {
        if (!inCone(p, victims[v], 10.5, 25)) continue
        hurt(p, victims[v], mastered(ctx) ? 14 : 9)
        launch(victims[v], look.x * 2.2, 0.7, look.z * 2.2)
      }
      sound(p, 'minecraft:entity.player.attack.sweep', 1, 0.5)
      sound(p, 'minecraft:entity.breeze.shoot', 1, 0.8)
      ctx.setCooldown(4)
    })
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      var t = p.tickCount
      if (t % 20 == 0) {
        if (!ctx.consumeMagicule(3)) {
          ctx.instance.setToggled(false)
          ctx.instance.onToggleOff(p)
          ctx.instance.markDirty()
          ctx.tell('Invisible Air disperses: out of magicules.')
          return
        }
        effect(p, 'minecraft:speed', 40, mastered(ctx) ? 1 : 0)
        if (t % 200 == 0) ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
      }
      if (t % 10 == 0) {
        var mobs = hostilesNear(p, mastered(ctx) ? 5 : 4)
        for (var i = 0; i < mobs.length; i++) push(mobs[i], p.getX(), p.getZ(), 0.6, 0.15)
        ring(p, 'minecraft:cloud', p.getX(), p.getY() + 0.3 + (t % 40) / 40, p.getZ(), 1.4, 8, 0.02, t * 0.3)
      }
    })
    .onTakenDamage(ctx => {
      if (!ctx.isToggled()) return true
      try {
        var direct = ctx.source.getDirectEntity()
        var owner = ctx.source.getEntity()
        if (direct && owner && !direct.equals(owner)) {
          ctx.setAmount(Number(ctx.amount()) * 0.25)
          burst(ctx.entity, 'minecraft:cloud', ctx.entity.getX(), ctx.entity.getY() + 1, ctx.entity.getZ(), 12, 0.3)
          sound(ctx.entity, 'minecraft:entity.breeze.deflect', 1, 1)
        }
      } catch (e) { /* ignore */ }
      return true
    })

  // Lord of the Kingdom (Unique): royal aura that empowers nearby players.
  event.create('kubejs:kings_decree')
    .name('Lord of the Kingdom')
    .description('Toggle. A royal aura grants you and every player within 12 blocks Strength, Resistance and Absorption, and hostile creatures inside it are slowed. Mastered: Strength II. Drains 5 magicules every 2 seconds.')
    .type('unique')
    .icon('kubejs:skill/holy/kings_decree')
    .canBeToggled(true)
    .canTick(ctx => ctx.isToggled())
    .onToggleOn(ctx => {
      var p = ctx.entity
      fxEntity(p, 'kings_decree', { autoRotate: 'none', allowMulti: false })
      shockwave(p, 'minecraft:end_rod', p.getX(), p.getY() + 0.2, p.getZ(), 12, 4, 0.5)
      sound(p, 'minecraft:item.goat_horn.sound.1', 1, 1)
      actionbar(p, 24, 'The Lord of the Kingdom stands with you.', 'gold')
    })
    .onToggleOff(ctx => fxRemove(ctx.entity, 'kings_decree'))
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      var t = p.tickCount
      if (t % 5 == 0) ring(p, 'minecraft:end_rod', p.getX(), p.getY() + 0.1, p.getZ(), 12, 24, 0, t * 0.05)
      if (t % 40 != 0) return
      if (!ctx.consumeMagicule(5)) {
        ctx.instance.setToggled(false)
        ctx.instance.markDirty()
        fxRemove(p, 'kings_decree')
        ctx.tell('The royal aura fades: out of magicules.')
        return
      }
      var all = livingNear(p, 12, true)
      for (var i = 0; i < all.length; i++) {
        if (isPlayerEntity(all[i])) {
          effect(all[i], 'minecraft:strength', 60, mastered(ctx) ? 1 : 0)
          effect(all[i], 'minecraft:resistance', 60, 0)
          effect(all[i], 'minecraft:absorption', 60, 0)
          if (!all[i].equals(p)) particles(p, 'minecraft:end_rod', all[i].getX(), all[i].getY() + 1, all[i].getZ(), 0.3, 0.5, 0.3, 4, 0.02)
        } else {
          effect(all[i], 'minecraft:slowness', 60, 0)
        }
      }
      if (t % 400 == 0) ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })

  // Summon skills.
  event.create('kubejs:excalibur_summon')
    .name('Sword of Promised Victory')
    .description('Summon Excalibur into your hand for 2 minutes (4 mastered). Press again to dismiss it. While held it burns the undead, its swings loose crescents of light, and it cannot be dropped. Costs 900 magicules.')
    .type('unique')
    .icon('kubejs:skill/holy/excalibur_summon')
    .onPressed(ctx => summonSkill(ctx, 'kubejs:excalibur', 'Excalibur', 900, 2400, 2400, 'gold'))

  event.create('kubejs:rhongomyniad_summon')
    .name('Lance That Shines to the Ends of the World')
    .description('Summon Rhongomyniad into your hand for 2 minutes (4 mastered). Press again to dismiss it. Its thrusts pierce through every enemy in a line. Costs 900 magicules.')
    .type('unique')
    .icon('kubejs:skill/holy/rhongomyniad_summon')
    .onPressed(ctx => summonSkill(ctx, 'kubejs:rhongomyniad', 'Rhongomyniad', 900, 2400, 2400, 'blue'))

  // EXCALIBUR (Ultimate): hold to charge, release to fire the light of the ending.
  event.create('kubejs:excalibur_release')
    .name('Excalibur: Light of the Ending')
    .description('ULTIMATE. Hold to gather light for up to 3 seconds, release to unleash a 40-block beam of holy fire that devastates everything in its path (up to 60 damage, 100 mastered, doubled against the undead) and detonates where it lands. Full power needs Excalibur in hand. Costs 2500 magicules, 45 s cooldown.')
    .type('ultimate')
    .icon('kubejs:skill/holy/excalibur_release')
    .maxHeldTime(60)
    .onHeld(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return false
      if (ctx.cooldown() > 0) { if (ctx.heldTicks == 1) ctx.tell('Excalibur is not ready.'); return false }
      var h = ctx.heldTicks
      if (h == 1) {
        fxEntity(p, 'excalibur_charge', { autoRotate: 'look', forcedDeath: true })
        sound(p, 'minecraft:block.beacon.activate', 1, 1.2)
      }
      var x = p.getX(), y = p.getY(), z = p.getZ()
      if (h % 2 == 0) {
        var r = 3.5 - (h / 60) * 2.5
        ring(p, 'minecraft:end_rod', x, y + 0.2, z, r, 18, -0.15, h * 0.25)
        ring(p, 'minecraft:electric_spark', x, y + 1.6, z, r * 0.6, 10, -0.1, -h * 0.35)
      }
      if (h % 10 == 0) {
        helix(p, 'minecraft:end_rod', x, y, z, 1 + h / 60, 3, 2, h * 0.1)
        sound(p, 'minecraft:block.beacon.ambient', 1, 0.8 + h / 60)
      }
      if (h >= 55 && h % 3 == 0) particles(p, 'minecraft:flash', x, y + 1.5, z, 0, 0, 0, 1, 0)
      ctx.instance.getOrCreateTag().putInt('charge', h)
      return true
    })
    .onRelease(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      if (ctx.cooldown() > 0) return
      var charge = Math.min(60, ctx.instance.getOrCreateTag().getInt('charge'))
      ctx.instance.getOrCreateTag().putInt('charge', 0)
      fxRemove(p, 'excalibur_charge')
      if (charge < 10) { ctx.tell('The light dissipates. Hold longer.'); return }
      if (!ctx.consumeMagicule(2500)) { ctx.tell('Not enough magicules.'); return }
      var power = charge / 60
      var base = mastered(ctx) ? 100 : 60
      if (!holdsWeapon(p, 'kubejs:excalibur')) base *= 0.5
      var dmg = base * (0.4 + 0.6 * power)
      var look = lookVec(p)
      var ox = p.getX(), oy = p.getEyeY() - 0.2, oz = p.getZ()
      // Photon beam anchored to the caster, plus impact effect at the end.
      fxEntity(p, 'excalibur_beam', { autoRotate: 'look', forcedDeath: true, scale: 0.5 + power })
      var hit = {}
      var victims = livingNear(p, 42, false)
      var endStep = 40
      for (var step = 1; step <= 40; step++) {
        var px = ox + look.x * step, py = oy + look.y * step, pz = oz + look.z * step
        if (!isAirAt(p, px, py, pz)) { endStep = step; break }
        // Core, sheath and spinning halo.
        particles(p, 'minecraft:end_rod', px, py, pz, 0.1, 0.1, 0.1, 6, 0.01)
        particles(p, 'minecraft:electric_spark', px, py, pz, 0.6, 0.6, 0.6, 4, 0.02)
        var a = step * 0.6
        particles(p, 'minecraft:firework', px + Math.cos(a) * 1.4, py + Math.sin(a) * 1.4, pz + Math.sin(a) * 0.4, 0, 0, 0, 1, 0)
        particles(p, 'minecraft:firework', px - Math.cos(a) * 1.4, py - Math.sin(a) * 1.4, pz - Math.sin(a) * 0.4, 0, 0, 0, 1, 0)
        for (var v = 0; v < victims.length; v++) {
          var e = victims[v]
          var key = String(e.getUUID())
          if (hit[key]) continue
          var dx = e.getX() - px, dy = (e.getY() + e.getBbHeight() / 2) - py, dz = e.getZ() - pz
          if (dx * dx + dy * dy + dz * dz <= 6.25) {
            hit[key] = true
            hurt(p, e, isUndeadEntity(e) ? dmg * 2 : dmg)
            effect(e, 'minecraft:glowing', 100, 0)
            push(e, px - look.x * 2, pz - look.z * 2, 1.2, 0.5)
            burst(p, 'minecraft:end_rod', e.getX(), e.getY() + 1, e.getZ(), 20, 0.5)
          }
        }
      }
      var ex = ox + look.x * endStep, ey = oy + look.y * endStep, ez = oz + look.z * endStep
      fxAt(p, 'excalibur_impact', ex, ey, ez, { scale: 0.5 + power })
      shockwave(p, 'minecraft:end_rod', ex, ey, ez, 6, 4, 0.6)
      burst(p, 'minecraft:firework', ex, ey, ez, 60, 0.8)
      particles(p, 'minecraft:explosion_emitter', ex, ey, ez, 0, 0, 0, 1, 0)
      cmd(p, `playsound minecraft:entity.generic.explode player @a ${ex.toFixed(1)} ${ey.toFixed(1)} ${ez.toFixed(1)} 1 1.4`)
      sound(p, 'minecraft:item.trident.thunder', 1, 0.5)
      sound(p, 'minecraft:block.beacon.power_select', 1, 0.6)
      sound(p, 'minecraft:entity.lightning_bolt.thunder', 1, 1.5)
      title(p, 48, 'EXCALIBUR', 'gold', 'Light of the Ending')
      ctx.setCooldown(mastered(ctx) ? 30 : 45)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })

  // Lance of the Ending (Ultimate): a piercing dash of light.
  event.create('kubejs:lance_of_the_ending')
    .name('Rhongomyniad: Lance of the Ending')
    .description('ULTIMATE. Become a spear of light: dash 12 blocks forward, striking everything along the path for 35 damage (55 mastered), pinning survivors in place and leaving a burning trail of light. Full power needs Rhongomyniad in hand. Costs 1500 magicules, 25 s cooldown.')
    .type('ultimate')
    .icon('kubejs:skill/holy/lance_of_the_ending')
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      if (ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(1500)) { ctx.tell('Not enough magicules.'); return }
      var dmg = mastered(ctx) ? 55 : 35
      if (!holdsWeapon(p, 'kubejs:rhongomyniad')) dmg *= 0.5
      var look = lookVec(p)
      var l = Math.sqrt(look.x * look.x + look.z * look.z) || 1
      var lx = look.x / l, lz = look.z / l
      var reach = 0
      for (var step = 1; step <= 12; step++) {
        var bx = p.getX() + lx * step, bz = p.getZ() + lz * step
        if (!isAirAt(p, bx, p.getY(), bz) || !isAirAt(p, bx, p.getY() + 1, bz)) break
        reach = step
      }
      var sx = p.getX(), sy = p.getY(), sz = p.getZ()
      fxEntity(p, 'lance_dash', { autoRotate: 'look', forcedDeath: true })
      var victims = livingNear(p, 14, false)
      var struck = {}
      for (var s = 0; s <= reach; s++) {
        var px = sx + lx * s, pz = sz + lz * s
        particles(p, 'minecraft:end_rod', px, sy + 1, pz, 0.2, 0.6, 0.2, 10, 0.05)
        particles(p, 'minecraft:electric_spark', px, sy + 1, pz, 0.5, 0.8, 0.5, 6, 0.1)
        shoot(p, 'minecraft:firework', px, sy + 1.2, pz, -lx, 0.2, -lz, 0.5)
        for (var v = 0; v < victims.length; v++) {
          var e = victims[v]
          var key = String(e.getUUID())
          if (struck[key]) continue
          var dx = e.getX() - px, dz = e.getZ() - pz
          if (dx * dx + dz * dz <= 4) {
            struck[key] = true
            hurt(p, e, dmg)
            effect(e, 'minecraft:slowness', 40, 4)
            effect(e, 'minecraft:glowing', 60, 0)
            burst(p, 'minecraft:end_rod', e.getX(), e.getY() + 1, e.getZ(), 16, 0.4)
          }
        }
      }
      if (reach > 0) { try { p.teleportTo(sx + lx * reach, sy, sz + lz * reach) } catch (e) { /* ignore */ } }
      fxAt(p, 'lance_impact', sx + lx * reach, sy, sz + lz * reach, {})
      shockwave(p, 'minecraft:end_rod', sx + lx * reach, sy + 0.2, sz + lz * reach, 4, 3, 0.5)
      sound(p, 'minecraft:entity.evoker.cast_spell', 1, 1.8)
      sound(p, 'minecraft:item.trident.riptide_3', 1, 1.2)
      sound(p, 'minecraft:entity.lightning_bolt.impact', 0.7, 1.8)
      title(p, 32, 'RHONGOMYNIAD', 'aqua', 'Lance of the Ending')
      ctx.setCooldown(mastered(ctx) ? 18 : 25)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })

  // Avalon (Ultimate): five seconds of untouchable sanctuary plus a full restore.
  event.create('kubejs:avalon')
    .name('Avalon: Ever-Distant Utopia')
    .description('ULTIMATE. Seal yourself in the fairy sanctuary: restore every limb and all health, purge harmful effects, and become untouchable for 5 seconds (8 mastered) while the sanctuary heals allies who stand inside it. Costs 4000 magicules, 3 minute cooldown.')
    .type('ultimate')
    .icon('kubejs:skill/holy/avalon')
    .canTick(true)
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      if (ctx.cooldown() > 0) { ctx.tell('Avalon is sealed.'); return }
      if (!ctx.consumeMagicule(4000)) { ctx.tell('Not enough magicules.'); return }
      var ticks = mastered(ctx) ? 160 : 100
      ctx.instance.getOrCreateTag().putLong('avalonUntil', now(p) + ticks)
      fullRestore(p)
      var bad = ['minecraft:poison', 'minecraft:wither', 'minecraft:slowness', 'minecraft:weakness', 'minecraft:blindness',
        'minecraft:darkness', 'minecraft:hunger', 'minecraft:nausea', 'minecraft:mining_fatigue', 'legendarysurvivaloverhaul:thirst',
        'legendarysurvivaloverhaul:heat_stroke', 'legendarysurvivaloverhaul:frostbite']
      for (var i = 0; i < bad.length; i++) removeEffect(p, bad[i])
      effect(p, 'minecraft:regeneration', ticks, 2)
      effect(p, 'minecraft:resistance', ticks, 4)
      var x = p.getX(), y = p.getY(), z = p.getZ()
      fxEntity(p, 'avalon', { autoRotate: 'none', forcedDeath: true, allowMulti: false })
      pillar(p, 'minecraft:end_rod', x, y, z, 10, 4)
      helix(p, 'minecraft:happy_villager', x, y, z, 1.5, 4, 3, 0)
      shockwave(p, 'minecraft:end_rod', x, y + 0.2, z, 5, 3, 0.4)
      sound(p, 'minecraft:block.beacon.activate', 1, 1.8)
      sound(p, 'minecraft:entity.player.levelup', 1, 0.7)
      sound(p, 'minecraft:block.amethyst_block.chime', 1, 0.6)
      title(p, 32, 'AVALON', 'green', 'Ever-Distant Utopia')
      ctx.tell('The scabbard of the ever-distant utopia embraces you.')
      ctx.setCooldown(mastered(ctx) ? 120 : 180)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      var until = ctx.instance.getOrCreateTag().getLong('avalonUntil')
      if (until <= now(p)) return
      var t = p.tickCount
      if (t % 4 == 0) ring(p, 'minecraft:end_rod', p.getX(), p.getY() + 0.1 + (t % 40) / 20, p.getZ(), 2.2, 12, 0, t * 0.2)
      if (t % 20 == 0) {
        var allies = playersNear(p, 4, false)
        for (var i = 0; i < allies.length; i++) { heal(allies[i], 4); effect(allies[i], 'minecraft:resistance', 30, 1) }
      }
    })
    .onBeingDamaged(ctx => {
      var until = ctx.instance.getOrCreateTag().getLong('avalonUntil')
      if (until > now(ctx.entity)) {
        burst(ctx.entity, 'minecraft:end_rod', ctx.entity.getX(), ctx.entity.getY() + 1, ctx.entity.getZ(), 10, 0.3)
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
    .description('Toggle. Every hit you land deals 25% more damage (40% mastered) and splashes blood that withers the victim, but costs you 1 heart of blood. Cannot kill you.')
    .type('common')
    .icon('kubejs:skill/demonic/blood_pact')
    .canBeToggled(true)
    .onToggleOn(ctx => fxEntity(ctx.entity, 'blood_pact', { autoRotate: 'none', allowMulti: false }))
    .onToggleOff(ctx => fxRemove(ctx.entity, 'blood_pact'))
    .onDamageEntity(ctx => {
      if (!ctx.isToggled()) return true
      var p = ctx.entity
      if (health(p) <= 3) return true
      ctx.setAmount(Number(ctx.amount()) * (mastered(ctx) ? 1.4 : 1.25))
      setHealth(p, health(p) - 2)
      var t = ctx.target
      if (t) {
        effect(t, 'minecraft:wither', 40, 0)
        burst(p, 'minecraft:crimson_spore', t.getX(), t.getY() + 1, t.getZ(), 14, 0.3)
        particles(p, 'minecraft:damage_indicator', t.getX(), t.getY() + 1, t.getZ(), 0.3, 0.3, 0.3, 6, 0.1)
      }
      if (p.tickCount % 5 == 0) ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
      return true
    })

  // Hellfire Brand (Extra): a cone of demonic flame.
  event.create('kubejs:hellfire_brand')
    .name('Hellfire Brand')
    .description('Breathe a 6-block cone of hellfire: 10 damage (16 mastered), 8 seconds of burning and a brand that makes the victim take 25% more damage for 6 seconds. Costs 300 magicules, 8 s cooldown.')
    .type('extra')
    .icon('kubejs:skill/demonic/hellfire_brand')
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      if (ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(300)) { ctx.tell('Not enough magicules.'); return }
      var dmg = mastered(ctx) ? 16 : 10
      fxEntity(p, 'hellfire_cone', { autoRotate: 'look', forcedDeath: true })
      coneSpray(p, 'minecraft:flame', 6, 30, 60, 1.0)
      coneSpray(p, 'minecraft:soul_fire_flame', 6, 25, 25, 0.9)
      coneSpray(p, 'minecraft:lava', 5, 20, 8, 0.6)
      var victims = livingNear(p, 7, false)
      for (var v = 0; v < victims.length; v++) {
        if (!inCone(p, victims[v], 6.5, 35)) continue
        hurt(p, victims[v], dmg)
        ignite(victims[v], 8)
        effect(victims[v], 'minecraft:weakness', 120, 0)
        try { victims[v].persistentData.putLong('hkBrandUntil', now(p) + 120) } catch (e) { /* ignore */ }
      }
      sound(p, 'minecraft:entity.blaze.shoot', 1, 0.6)
      sound(p, 'minecraft:item.firecharge.use', 1, 0.7)
      sound(p, 'minecraft:entity.ghast.shoot', 0.6, 0.6)
      ctx.setCooldown(mastered(ctx) ? 5 : 8)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })

  // Sovereign's Pressure (Unique): the haki of a demon lord.
  event.create('kubejs:sovereigns_pressure')
    .name('Sovereign\'s Pressure')
    .description('Unleash the pressure of a demon lord: every creature within 10 blocks is crushed with Slowness III and Weakness II for 6 seconds, loses its target, is thrown back and takes 8 damage. Other players are shrouded in darkness. Costs 800 magicules, 30 s cooldown.')
    .type('unique')
    .icon('kubejs:skill/demonic/sovereigns_pressure')
    .onPressed(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      if (ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(800)) { ctx.tell('Not enough magicules.'); return }
      var radius = mastered(ctx) ? 14 : 10
      var x = p.getX(), y = p.getY(), z = p.getZ()
      fxEntity(p, 'sovereigns_pressure', { autoRotate: 'none', forcedDeath: true, scale: radius / 10 })
      var victims = livingNear(p, radius, false)
      for (var v = 0; v < victims.length; v++) {
        var e = victims[v]
        if (isPlayerEntity(e)) { effect(e, 'minecraft:darkness', 80, 0); continue }
        effect(e, 'minecraft:slowness', 120, 2)
        effect(e, 'minecraft:weakness', 120, 1)
        clearTarget(e)
        hurt(p, e, 8)
        push(e, x, z, 1.4, 0.4)
      }
      shockwave(p, 'minecraft:smoke', x, y + 0.3, z, radius, 5, 0.9)
      shockwave(p, 'minecraft:soul', x, y + 1, z, radius * 0.7, 3, 0.6)
      pillar(p, 'minecraft:soul_fire_flame', x, y, z, 5, 3)
      particles(p, 'minecraft:sonic_boom', x, y + 1, z, 0, 0, 0, 1, 0)
      sound(p, 'minecraft:entity.wither.spawn', 1, 1.5)
      sound(p, 'minecraft:entity.warden.roar', 0.6, 1.4)
      sound(p, 'minecraft:entity.warden.sonic_boom', 0.8, 0.6)
      actionbar(p, radius + 4, 'An overwhelming pressure bears down on you...', 'dark_red')
      ctx.setCooldown(mastered(ctx) ? 20 : 30)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
    })

  event.create('kubejs:clarent_summon')
    .name('Rebellion Against My Beautiful Father')
    .description('Summon Clarent into your hand for 2 minutes (4 mastered). Press again to dismiss it. While held, every hit drinks blood and withers the victim. Costs 900 magicules.')
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
      var p = ctx.entity
      if (!isServerLiving(p)) return false
      if (ctx.cooldown() > 0) { if (ctx.heldTicks == 1) ctx.tell('Clarent is not ready.'); return false }
      var h = ctx.heldTicks
      if (h == 1) { fxEntity(p, 'clarent_charge', { autoRotate: 'look', forcedDeath: true }); sound(p, 'minecraft:entity.wither.ambient', 1, 0.5) }
      var x = p.getX(), y = p.getY(), z = p.getZ()
      if (h % 2 == 0) {
        ring(p, 'minecraft:soul_fire_flame', x, y + 0.2, z, 3 - h / 20, 14, -0.2, h * 0.3)
        ring(p, 'minecraft:crimson_spore', x, y + 1.4, z, 1.5, 8, 0, -h * 0.4)
      }
      if (h % 8 == 0) helix(p, 'minecraft:soul_fire_flame', x, y, z, 0.9, 2.5, 2, h * 0.2)
      ctx.instance.getOrCreateTag().putInt('charge', h)
      return true
    })
    .onRelease(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p)) return
      if (ctx.cooldown() > 0) return
      var charge = Math.min(40, ctx.instance.getOrCreateTag().getInt('charge'))
      ctx.instance.getOrCreateTag().putInt('charge', 0)
      fxRemove(p, 'clarent_charge')
      if (charge < 8) { ctx.tell('The hatred dissipates. Hold longer.'); return }
      if (!ctx.consumeMagicule(2000)) { ctx.tell('Not enough magicules.'); return }
      var base = mastered(ctx) ? 75 : 45
      if (!holdsWeapon(p, 'kubejs:clarent')) base *= 0.5
      var dmg = base * (0.5 + 0.5 * charge / 40)
      var total = 0
      var victims = livingNear(p, 12, false)
      for (var v = 0; v < victims.length; v++) {
        if (!inCone(p, victims[v], 11, 30)) continue
        hurt(p, victims[v], dmg)
        effect(victims[v], 'minecraft:wither', 100, 1)
        push(victims[v], p.getX(), p.getZ(), 1.5, 0.4)
        burst(p, 'minecraft:crimson_spore', victims[v].getX(), victims[v].getY() + 1, victims[v].getZ(), 20, 0.4)
        total += dmg
      }
      var look = lookVec(p)
      fxEntity(p, 'clarent_wave', { autoRotate: 'look', forcedDeath: true, scale: 0.6 + charge / 40 })
      for (var s = 1; s <= 11; s++) {
        var w = s * 0.55
        ring(p, 'minecraft:soul_fire_flame', p.getX() + look.x * s, p.getY() + 1, p.getZ() + look.z * s, w, 10 + s, 0.1, s * 0.5)
        particles(p, 'minecraft:crimson_spore', p.getX() + look.x * s, p.getY() + 1, p.getZ() + look.z * s, w, 0.6, w, 12, 0.05)
        shoot(p, 'minecraft:soul', p.getX() + look.x * s, p.getY() + 1.2, p.getZ() + look.z * s, look.x, 0.1, look.z, 0.6)
      }
      if (total > 0) heal(p, Math.min(20, total * 0.3))
      sound(p, 'minecraft:entity.wither.shoot', 1, 0.6)
      sound(p, 'minecraft:entity.ender_dragon.growl', 0.6, 1.5)
      sound(p, 'minecraft:entity.wither.break_block', 1, 0.7)
      title(p, 40, 'CLARENT BLOOD ARTHUR', 'dark_red', 'Rebellion Against My Beautiful Father')
      ctx.setCooldown(mastered(ctx) ? 28 : 40)
      ctx.instance.getSkill().addMasteryPoint(ctx.instance, p)
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
    .baseAura(400, 600).baseMagicule(400, 600).size(0)
    .maxHealth(20).maxSpiritualHealth(20).attack(1).attackSpeed(0).knockbackResistance(0).movementSpeed(0.02).swimSpeed(0)
    .intrinsicSkill('kubejs:divine_smite')
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      effect(p, 'minecraft:speed', 100, 0)
      effect(p, 'minecraft:regeneration', 60, 0)
      burst(p, 'minecraft:end_rod', p.getX(), p.getY() + 1, p.getZ(), 20, 0.3)
      sound(p, 'minecraft:entity.player.attack.sweep', 1, 1.4)
      ctx.setCooldown(600)
    })

  event.create('kubejs:holy_knight')
    .name('Holy Knight')
    .description('A knight anointed by holy light. Race ability: Knight\'s Charge (dash forward and stagger foes). Evolves to Paladin King at 40,000 EP.')
    .difficulty('intermediate')
    .previousEvolution('kubejs:squire')
    .defaultEvolution('kubejs:paladin_king')
    .baseAura(1500, 2000).baseMagicule(1500, 2000).size(0.05)
    .maxHealth(30).maxSpiritualHealth(60).attack(3).attackSpeed(0.1).knockbackResistance(0.1).movementSpeed(0.04).swimSpeed(0.05)
    .epRequirement(5000)
    .intrinsicSkill('kubejs:wall_of_the_kingdom')
    .intrinsicSkill('kubejs:invisible_air')
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var look = lookVec(p)
      launch(p, look.x * 1.8, 0.3, look.z * 1.8)
      var mobs = hostilesNear(p, 4)
      for (var i = 0; i < mobs.length; i++) { hurt(p, mobs[i], 6); effect(mobs[i], 'minecraft:slowness', 40, 2) }
      fxEntity(p, 'knights_charge', { autoRotate: 'look', forcedDeath: true })
      coneSpray(p, 'minecraft:cloud', 3, 40, 30, 0.6)
      sound(p, 'minecraft:entity.horse.gallop', 1, 1.2)
      ctx.setCooldown(300)
    })

  event.create('kubejs:paladin_king')
    .name('Paladin King')
    .description('A king whose word is a wall and whose sword is the dawn. Passive: regenerate when below 30% health. Race ability: Royal Decree (Strength II and Resistance II for allies). Evolves to Divine Sovereign at 200,000 EP by consuming the Holy Grail.')
    .difficulty('hard')
    .previousEvolution('kubejs:holy_knight')
    .defaultEvolution('kubejs:divine_sovereign')
    .baseAura(6000, 8000).baseMagicule(6000, 8000).size(0.1)
    .maxHealth(50).maxSpiritualHealth(150).attack(6).attackSpeed(0.15).knockbackResistance(0.2).movementSpeed(0.06).swimSpeed(0.1)
    .epRequirement(40000)
    .intrinsicSkill('kubejs:kings_decree')
    .intrinsicSkill('kubejs:excalibur_summon')
    .intrinsicSkill('kubejs:rhongomyniad_summon')
    .canTick(true)
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 40 != 0) return
      if (health(p) < maxHealth(p) * 0.3) { effect(p, 'minecraft:regeneration', 60, 1); helix(p, 'minecraft:end_rod', p.getX(), p.getY(), p.getZ(), 0.8, 2, 1, 0) }
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var allies = playersNear(p, 16, true)
      for (var i = 0; i < allies.length; i++) {
        effect(allies[i], 'minecraft:strength', 300, 1)
        effect(allies[i], 'minecraft:resistance', 300, 1)
        pillar(p, 'minecraft:end_rod', allies[i].getX(), allies[i].getY(), allies[i].getZ(), 3, 3)
      }
      fxEntity(p, 'royal_decree', { autoRotate: 'none', forcedDeath: true })
      shockwave(p, 'minecraft:end_rod', p.getX(), p.getY() + 0.2, p.getZ(), 16, 4, 0.6)
      sound(p, 'minecraft:item.goat_horn.sound.0', 1, 1)
      title(p, 24, 'ROYAL DECREE', 'gold', 'The kingdom marches')
      ctx.setCooldown(1200)
    })

  event.create('kubejs:divine_sovereign')
    .name('Divine Sovereign')
    .description('The final form of the holy line: a sovereign wreathed in the light of the ending. Passive: immune to fire and holy-light regeneration. Race ability: Sanctuary (full restore of health and limbs for every ally within 12 blocks). Can ascend to Sovereign of the Three Crowns.')
    .difficulty('hard')
    .previousEvolution('kubejs:paladin_king')
    .nextEvolution('kubejs:primordial_sovereign')
    .baseAura(25000, 32000).baseMagicule(25000, 32000).size(0.15)
    .maxHealth(80).maxSpiritualHealth(400).attack(10).attackSpeed(0.2).knockbackResistance(0.35).movementSpeed(0.08).swimSpeed(0.15)
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
      if (health(p) < maxHealth(p)) effect(p, 'minecraft:regeneration', 40, 0)
      if (p.tickCount % 60 == 0) ring(p, 'minecraft:end_rod', p.getX(), p.getY() + 2.3, p.getZ(), 0.5, 8, 0, p.tickCount * 0.1)
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var allies = playersNear(p, 12, true)
      for (var i = 0; i < allies.length; i++) { fullRestore(allies[i]); pillar(p, 'minecraft:end_rod', allies[i].getX(), allies[i].getY(), allies[i].getZ(), 6, 3) }
      fxEntity(p, 'sanctuary', { autoRotate: 'none', forcedDeath: true })
      shockwave(p, 'minecraft:end_rod', p.getX(), p.getY() + 0.2, p.getZ(), 12, 4, 0.5)
      sound(p, 'minecraft:block.beacon.activate', 1, 1.6)
      title(p, 24, 'SANCTUARY', 'aqua', 'The light of the ending')
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
    .baseAura(300, 500).baseMagicule(500, 700).size(0)
    .maxHealth(18).maxSpiritualHealth(20).attack(2).attackSpeed(0).knockbackResistance(0).movementSpeed(0.02).swimSpeed(0)
    .intrinsicSkill('kubejs:blood_pact')
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0 || health(p) <= 4) return
      setHealth(p, health(p) - 4)
      effect(p, 'minecraft:strength', 120, 0)
      effect(p, 'minecraft:speed', 120, 1)
      burst(p, 'minecraft:crimson_spore', p.getX(), p.getY() + 1, p.getZ(), 20, 0.3)
      sound(p, 'minecraft:entity.zombie_villager.cure', 0.5, 1.8)
      ctx.setCooldown(500)
    })

  event.create('kubejs:fallen_knight')
    .name('Fallen Knight')
    .description('A knight whose armour is scorched black by hellfire. Race ability: Hellstep (short teleport toward where you look, burning the arrival point). Evolves to Demon Knight at 40,000 EP.')
    .difficulty('intermediate')
    .previousEvolution('kubejs:fallen_squire')
    .defaultEvolution('kubejs:demon_knight')
    .baseAura(1200, 1800).baseMagicule(1800, 2400).size(0.05)
    .maxHealth(28).maxSpiritualHealth(60).attack(4).attackSpeed(0.1).knockbackResistance(0.1).movementSpeed(0.04).swimSpeed(0.05)
    .epRequirement(5000)
    .intrinsicSkill('kubejs:hellfire_brand')
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var look = lookVec(p)
      var tx = p.getX() + look.x * 6, tz = p.getZ() + look.z * 6
      burst(p, 'minecraft:flame', p.getX(), p.getY() + 1, p.getZ(), 30, 0.4)
      try { p.teleportTo(tx, p.getY(), tz) } catch (e) { /* ignore */ }
      fxEntity(p, 'hellstep', { autoRotate: 'none', forcedDeath: true })
      burst(p, 'minecraft:flame', tx, p.getY() + 1, tz, 30, 0.4)
      ring(p, 'minecraft:lava', tx, p.getY() + 0.1, tz, 2, 12, 0.2, 0)
      var mobs = hostilesNear(p, 3)
      for (var i = 0; i < mobs.length; i++) ignite(mobs[i], 4)
      sound(p, 'minecraft:entity.enderman.teleport', 1, 0.6)
      ctx.setCooldown(240)
    })

  event.create('kubejs:demon_knight')
    .name('Demon Knight')
    .description('Hell\'s champion in knightly steel. Passive: burning heals you. Race ability: Infernal Rally (nearby creatures burst into flame and you gain Absorption). Evolves to Demon King at 200,000 EP by consuming an Archdemon Heart.')
    .difficulty('hard')
    .previousEvolution('kubejs:fallen_knight')
    .defaultEvolution('kubejs:demon_king')
    .baseAura(5000, 7000).baseMagicule(8000, 10000).size(0.1)
    .maxHealth(46).maxSpiritualHealth(150).attack(7).attackSpeed(0.15).knockbackResistance(0.2).movementSpeed(0.06).swimSpeed(0.1)
    .epRequirement(40000)
    .intrinsicSkill('kubejs:sovereigns_pressure')
    .intrinsicSkill('kubejs:clarent_summon')
    .canTick(true)
    .onTick(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || p.tickCount % 20 != 0) return
      effect(p, 'minecraft:fire_resistance', 60, 0)
      try { if (p.isOnFire()) heal(p, 1) } catch (e) { /* ignore */ }
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var mobs = hostilesNear(p, 8)
      for (var i = 0; i < mobs.length; i++) { ignite(mobs[i], 8); hurt(p, mobs[i], 6) }
      effect(p, 'minecraft:absorption', 600, 2)
      fxEntity(p, 'infernal_rally', { autoRotate: 'none', forcedDeath: true })
      shockwave(p, 'minecraft:flame', p.getX(), p.getY() + 0.3, p.getZ(), 8, 4, 0.7)
      sound(p, 'minecraft:entity.blaze.death', 1, 0.5)
      ctx.setCooldown(900)
    })

  event.create('kubejs:demon_king')
    .name('Demon King')
    .description('The final form of the demonic line. Passive: immune to fire and wither, and your pressure never fades. Race ability: Throne of Ash (a 12-block eruption of hellfire that heals you for the damage dealt). Can ascend to Sovereign of the Three Crowns.')
    .difficulty('hard')
    .previousEvolution('kubejs:demon_knight')
    .nextEvolution('kubejs:primordial_sovereign')
    .baseAura(20000, 28000).baseMagicule(30000, 40000).size(0.15)
    .maxHealth(76).maxSpiritualHealth(400).attack(12).attackSpeed(0.2).knockbackResistance(0.35).movementSpeed(0.08).swimSpeed(0.15)
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
        ring(p, 'minecraft:soul_fire_flame', p.getX(), p.getY() + 0.1, p.getZ(), 1.2, 8, 0, p.tickCount * 0.1)
      }
    })
    .onActivateAbility(ctx => {
      var p = ctx.entity
      if (!isServerLiving(p) || ctx.cooldown() > 0) return
      var mobs = hostilesNear(p, 12)
      var total = 0
      for (var i = 0; i < mobs.length; i++) { hurt(p, mobs[i], 20); total += 20; ignite(mobs[i], 10) }
      heal(p, Math.min(30, total * 0.5))
      fxEntity(p, 'throne_of_ash', { autoRotate: 'none', forcedDeath: true })
      shockwave(p, 'minecraft:flame', p.getX(), p.getY() + 0.3, p.getZ(), 12, 5, 0.8)
      pillar(p, 'minecraft:soul_fire_flame', p.getX(), p.getY(), p.getZ(), 8, 3)
      particles(p, 'minecraft:explosion_emitter', p.getX(), p.getY() + 1, p.getZ(), 2, 1, 2, 4, 0)
      sound(p, 'minecraft:entity.generic.explode', 1, 0.6)
      sound(p, 'minecraft:entity.wither.death', 0.5, 1.2)
      title(p, 32, 'THRONE OF ASH', 'dark_red', 'All shall burn')
      ctx.setCooldown(2400)
    })
})
