// priority: 95
//
// kubejs/startup_scripts/holy_fx_lib.js
// --------------------------------------
// Shared helper library for the holy-knight / three-crowns content packs.
// Loads after skills.js (100) and before holy_knight_content.js (90),
// three_crowns_content.js (85) and holy_bosses.js (80); KubeJS startup
// scripts share one top-level scope, so everything here is visible there.
//
// Design rules:
//   * Gameplay calls (damage, effects, entity search) use the raw vanilla
//     API first and KubeJS wrappers only as a fallback, and the first
//     failure of each helper is logged to logs/kubejs/startup.log as
//     "[holy_fx_lib] <helper> failed: ..." so nothing can fail silently.
//   * Visuals have two layers: a Photon 2 effect (if you exported one to
//     the id the skill asks for, see docs/PHOTON_FX.md) and a
//     vanilla particle choreography that always plays.
//   * Rhino: const/let are function-scoped; functions use var.

const HK = {
  summonKey: 'kubejs_summon',
  summonUntilKey: 'kubejs_summon_until',
  lso: {
    bodyDamageUtil: 'sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyDamageUtil',
    bodyPartEnum: 'sfiomn.legendarysurvivaloverhaul.api.bodydamage.BodyPartEnum'
  }
}

// Photon 2 integration. Effects are looked up as kubejs:<name> ->
// assets/kubejs/fx/<name>.fx. Missing effects are harmless (the command
// fails quietly client-side); the vanilla choreography still plays.
const PHOTON = {
  enabled: true,
  namespace: 'kubejs'
}

// ---------------------------------------------------------------------
// Java access
// ---------------------------------------------------------------------
var _hkClasses = {}
function hkClass(name) {
  if (_hkClasses[name] !== undefined) return _hkClasses[name]
  var c = null
  try { c = Java.loadClass(name) } catch (e) { c = null }
  _hkClasses[name] = c
  return c
}

var _hkLogged = {}
function hkFail(where, e) {
  if (_hkLogged[where]) return
  _hkLogged[where] = true
  console.error(`[holy_fx_lib] ${where} failed: ${e}`)
}

function hkRl(id) {
  var c = hkClass('net.minecraft.resources.ResourceLocation')
  if (!c) return null
  try { return typeof c.parse === 'function' ? c.parse(id) : c.tryParse(id) } catch (e) { return null }
}

// ---------------------------------------------------------------------
// Entity basics
// ---------------------------------------------------------------------
function hkLevel(entity) {
  try { return entity.level() } catch (e) { /* not a method here */ }
  try { return entity.level } catch (e2) { return null }
}

function isServerLiving(entity) {
  if (!entity) return false
  var level = hkLevel(entity)
  if (!level) return false
  try { if (level.isClientSide()) return false } catch (e) { /* assume server */ }
  var living = hkClass('net.minecraft.world.entity.LivingEntity')
  try { if (living && !(entity instanceof living)) return false } catch (e) { /* fall back to KubeJS */ }
  try { if (typeof entity.isLiving === 'function' && !entity.isLiving()) return false } catch (e) { /* ignore */ }
  return true
}

function isPlayerEntity(entity) {
  var player = hkClass('net.minecraft.world.entity.player.Player')
  try { if (player) return entity instanceof player } catch (e) { /* fall back */ }
  try { return entity.isPlayer() } catch (e2) { return false }
}

function isUndeadEntity(entity) {
  try { return entity.isUndead() } catch (e) { /* fall through */ }
  try { return entity.getType().is(hkClass('net.minecraft.tags.EntityTypeTags').UNDEAD) } catch (e2) { return false }
}

function mastered(ctx) {
  try { return ctx.instance.isMastered(ctx.entity) } catch (e) { return false }
}

function now(entity) {
  try { return Number(hkLevel(entity).getGameTime()) } catch (e) { return 0 }
}

function cmd(entity, command) {
  try {
    var server = hkLevel(entity).getServer()
    if (server) server.getCommands().performPrefixedCommand(server.createCommandSourceStack().withSuppressedOutput().withPermission(4), command)
    return
  } catch (e) { /* fall back to KubeJS */ }
  try {
    var kserver = entity.server
    if (kserver) kserver.runCommandSilent(command)
  } catch (e2) { hkFail('cmd', e2) }
}

function sound(entity, id, volume, pitch) {
  cmd(entity, `playsound ${id} player @a ${entity.getX().toFixed(1)} ${entity.getY().toFixed(1)} ${entity.getZ().toFixed(1)} ${volume || 1} ${pitch || 1}`)
}

// ---------------------------------------------------------------------
// Damage and effects (raw vanilla API, KubeJS fallback, logged failures)
// ---------------------------------------------------------------------
function damageSource(source) {
  try { return hkLevel(source).damageSources().indirectMagic(source, source) } catch (e) { /* fall through */ }
  try { return hkLevel(source).damageSources().magic() } catch (e2) { return null }
}

// Deals `amount` to `target` credited to `source`. Clears vanilla
// invulnerability frames first so multi-hit skills always land.
function hurt(source, target, amount) {
  if (!target || !(amount > 0)) return false
  try { target.invulnerableTime = 0 } catch (e) { /* ignore */ }
  var src = damageSource(source)
  try {
    if (src) return target.hurt(src, amount)
  } catch (e) { hkFail('hurt(vanilla)', e) }
  try {
    return src ? target.attack(src, amount) : target.attack(amount)
  } catch (e2) { hkFail('hurt(kubejs)', e2) }
  return false
}

var _hkEffectHolders = {}
function effectHolder(id) {
  if (_hkEffectHolders[id] !== undefined) return _hkEffectHolders[id]
  var holder = null
  try {
    var registries = hkClass('net.minecraft.core.registries.BuiltInRegistries')
    var opt = registries.MOB_EFFECT.getHolder(hkRl(id))
    holder = opt.isPresent() ? opt.get() : null
  } catch (e) { holder = null }
  _hkEffectHolders[id] = holder
  return holder
}

function effect(target, id, ticks, amplifier) {
  if (!target) return
  var holder = effectHolder(id)
  var mei = hkClass('net.minecraft.world.effect.MobEffectInstance')
  try {
    if (holder && mei) { target.addEffect(new mei(holder, ticks, amplifier || 0, false, true)); return }
  } catch (e) { hkFail('effect(vanilla)', e) }
  try { target.potionEffects.add(id, ticks, amplifier || 0, false, true) } catch (e2) { hkFail('effect(kubejs)', e2) }
}

function removeEffect(target, id) {
  if (!target) return
  var holder = effectHolder(id)
  try {
    if (holder) { if (target.hasEffect(holder)) target.removeEffect(holder); return }
  } catch (e) { /* fall through */ }
  try { if (target.potionEffects.isActive(id)) target.removeEffect(id) } catch (e2) { /* ignore */ }
}

function ignite(target, seconds) {
  try { target.igniteForSeconds(seconds); return } catch (e) { /* pre-1.21 name */ }
  try { target.setSecondsOnFire(seconds) } catch (e2) { /* ignore */ }
}

function heal(target, amount) {
  try { target.heal(amount) } catch (e) { hkFail('heal', e) }
}

function health(target) {
  try { return Number(target.getHealth()) } catch (e) { return 0 }
}

function maxHealth(target) {
  try { return Number(target.getMaxHealth()) } catch (e) { return 20 }
}

function setHealth(target, value) {
  try { target.setHealth(value) } catch (e) { hkFail('setHealth', e) }
}

// ---------------------------------------------------------------------
// Entity search and geometry
// ---------------------------------------------------------------------
function makeAabb(entity, radius) {
  var aabb = hkClass('net.minecraft.world.phys.AABB')
  var x = entity.getX(), y = entity.getY(), z = entity.getZ()
  try { if (aabb) return new aabb(x - radius, y - radius, z - radius, x + radius, y + radius, z + radius) } catch (e) { /* fall back */ }
  try { return AABB.of(x - radius, y - radius, z - radius, x + radius, y + radius, z + radius) } catch (e2) { return null }
}

// All living entities within `radius` of `entity` (sphere), excluding it.
function livingNear(entity, radius, includeSelf) {
  var out = []
  var box = makeAabb(entity, radius)
  if (!box) return out
  var list = null
  try {
    var living = hkClass('net.minecraft.world.entity.LivingEntity')
    list = hkLevel(entity).getEntitiesOfClass(living, box)
  } catch (e) {
    try { list = hkLevel(entity).getEntities(entity, box) } catch (e2) { hkFail('livingNear', e2); return out }
  }
  try {
    for (var i = 0; i < list.size(); i++) {
      var e = list.get(i)
      if (e.equals(entity)) continue
      if (!e.isAlive()) continue
      if (typeof e.getHealth !== 'function') continue
      if (e.distanceToSqr(entity) > radius * radius) continue
      out.push(e)
    }
  } catch (e3) { hkFail('livingNear(iterate)', e3) }
  if (includeSelf) out.push(entity)
  return out
}

function hostilesNear(entity, radius) {
  var all = livingNear(entity, radius, false)
  var out = []
  for (var i = 0; i < all.length; i++) if (!isPlayerEntity(all[i])) out.push(all[i])
  return out
}

function playersNear(entity, radius, includeSelf) {
  var all = livingNear(entity, radius, includeSelf)
  var out = []
  for (var i = 0; i < all.length; i++) if (isPlayerEntity(all[i])) out.push(all[i])
  return out
}

function lookVec(entity) {
  try {
    var v = entity.getLookAngle()
    return { x: Number(v.x), y: Number(v.y), z: Number(v.z) }
  } catch (e) {
    try { var w = entity.getLookAngle(); return { x: Number(w.x()), y: Number(w.y()), z: Number(w.z()) } } catch (e2) { return { x: 0, y: 0, z: 1 } }
  }
}

function inCone(entity, target, range, halfAngleDeg) {
  var dx = target.getX() - entity.getX()
  var dz = target.getZ() - entity.getZ()
  var dist = Math.sqrt(dx * dx + dz * dz)
  if (dist > range) return false
  if (dist < 0.01) return true
  var look = lookVec(entity)
  var ll = Math.sqrt(look.x * look.x + look.z * look.z) || 1
  var dot = (dx * look.x + dz * look.z) / (dist * ll)
  return dot >= Math.cos(halfAngleDeg * Math.PI / 180)
}

function push(target, fromX, fromZ, strength, up) {
  var dx = target.getX() - fromX
  var dz = target.getZ() - fromZ
  var d = Math.sqrt(dx * dx + dz * dz) || 1
  try {
    target.setDeltaMovement(dx / d * strength, up, dz / d * strength)
    target.hurtMarked = true
  } catch (e) {
    try { target.setMotionX(dx / d * strength); target.setMotionY(up); target.setMotionZ(dz / d * strength) } catch (e2) { hkFail('push', e2) }
  }
}

function launch(entity, x, y, z) {
  try { entity.setDeltaMovement(x, y, z); entity.hurtMarked = true } catch (e) {
    try { entity.setMotionX(x); entity.setMotionY(y); entity.setMotionZ(z) } catch (e2) { hkFail('launch', e2) }
  }
}

function clearTarget(mob) {
  try { mob.setTarget(null) } catch (e) { /* not a mob */ }
}

function isAirAt(entity, x, y, z) {
  try { return hkLevel(entity).getBlockState(hkBlockPos(x, y, z)).isAir() } catch (e) { return true }
}

function hkBlockPos(x, y, z) {
  var bp = hkClass('net.minecraft.core.BlockPos')
  return new bp(Math.floor(x), Math.floor(y), Math.floor(z))
}

// Full heal including every LSO limb (used by Avalon and the sovereign race).
function fullRestore(entity) {
  setHealth(entity, maxHealth(entity))
  var body = hkClass(HK.lso.bodyDamageUtil)
  var parts = hkClass(HK.lso.bodyPartEnum)
  if (!body || !parts || !isPlayerEntity(entity)) return
  try {
    var values = parts.values()
    for (var i = 0; i < values.length; i++) {
      var max = Number(body.getMaxHealth(entity, values[i]))
      var ratio = Number(body.getHealthRatio(entity, values[i]))
      if (!isNaN(max) && !isNaN(ratio) && ratio < 1) body.healBodyPart(entity, values[i], max * (1 - ratio) + 0.01)
    }
  } catch (e) { /* LSO missing */ }
}

// ---------------------------------------------------------------------
// Vanilla particle choreography
// ---------------------------------------------------------------------
// particles(): count > 0 spreads `count` particles within (dx,dy,dz);
// count == 0 emits ONE particle travelling along (dx,dy,dz) * speed.
function particles(entity, id, x, y, z, dx, dy, dz, count, speed) {
  try {
    hkLevel(entity).sendParticles(particleOption(id), x, y, z, count, dx, dy, dz, speed)
    return
  } catch (e) { /* fall back */ }
  try { entity.level.spawnParticles(id, true, x, y, z, dx, dy, dz, count, speed) } catch (e2) { hkFail('particles', e2) }
}

var _hkParticleOptions = {}
function particleOption(id) {
  if (_hkParticleOptions[id] !== undefined) return _hkParticleOptions[id]
  var opt = null
  try {
    var registries = hkClass('net.minecraft.core.registries.BuiltInRegistries')
    var type = registries.PARTICLE_TYPE.get(hkRl(id))
    // Simple particle types are their own options; complex ones need data.
    opt = type
  } catch (e) { opt = null }
  _hkParticleOptions[id] = opt
  return opt
}

// Directed particle: one particle moving along a vector.
function shoot(entity, id, x, y, z, vx, vy, vz, speed) {
  particles(entity, id, x, y, z, vx, vy, vz, 0, speed)
}

// Ring of `n` particles at radius r around (x, y, z), optional outward velocity.
function ring(entity, id, x, y, z, r, n, outward, phase) {
  for (var i = 0; i < n; i++) {
    var a = (i / n) * Math.PI * 2 + (phase || 0)
    var px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r
    if (outward) shoot(entity, id, px, y, pz, Math.cos(a), 0.05, Math.sin(a), outward)
    else particles(entity, id, px, y, pz, 0, 0, 0, 1, 0)
  }
}

// Expanding shockwave: several rings with increasing radius, outward velocity.
function shockwave(entity, id, x, y, z, maxR, rings, outward) {
  for (var k = 1; k <= rings; k++) ring(entity, id, x, y, z, maxR * k / rings, 12 + k * 6, outward, k * 0.2)
}

// Vertical pillar of light at (x, y, z) up to `h` blocks tall.
function pillar(entity, id, x, y, z, h, density) {
  for (var i = 0; i <= h * density; i++) {
    var yy = y + i / density
    particles(entity, id, x, yy, z, 0.15, 0.05, 0.15, 2, 0.01)
  }
  shoot(entity, id, x, y + 0.2, z, 0, 1, 0, 1.2)
}

// Double helix climbing around a point.
function helix(entity, id, x, y, z, r, h, turns, phase) {
  var steps = Math.max(8, Math.floor(h * 8))
  for (var i = 0; i < steps; i++) {
    var t = i / steps
    var a = t * Math.PI * 2 * turns + (phase || 0)
    particles(entity, id, x + Math.cos(a) * r, y + t * h, z + Math.sin(a) * r, 0, 0, 0, 1, 0)
    particles(entity, id, x - Math.cos(a) * r, y + t * h, z - Math.sin(a) * r, 0, 0, 0, 1, 0)
  }
}

// Straight line of particles from (x, y, z) along (dx, dy, dz) for `len` blocks.
function beamLine(entity, id, x, y, z, dx, dy, dz, len, spacing, spread) {
  for (var d = 0; d <= len; d += spacing) {
    particles(entity, id, x + dx * d, y + dy * d, z + dz * d, spread, spread, spread, 2, 0.01)
  }
}

// Burst of particles flying outward in a sphere.
function burst(entity, id, x, y, z, n, speed) {
  for (var i = 0; i < n; i++) {
    var theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1)
    shoot(entity, id, x, y, z, Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta), speed)
  }
}

// Cone spray in the look direction.
function coneSpray(entity, id, len, halfAngleDeg, density, speed) {
  var look = lookVec(entity)
  var x = entity.getX(), y = entity.getEyeY() - 0.2, z = entity.getZ()
  for (var i = 0; i < density; i++) {
    var spread = Math.tan(halfAngleDeg * Math.PI / 180)
    var vx = look.x + (Math.random() - 0.5) * 2 * spread
    var vy = look.y + (Math.random() - 0.5) * spread
    var vz = look.z + (Math.random() - 0.5) * 2 * spread
    shoot(entity, id, x + look.x, y, z + look.z, vx, vy, vz, speed * (0.6 + Math.random() * 0.4) * len / 6)
  }
}

function title(entity, range, text, color, subtitle) {
  cmd(entity, `title @a[distance=..${range}] times 5 30 10`)
  if (subtitle) cmd(entity, `title @a[distance=..${range}] subtitle {"text":"${subtitle}","color":"gray","italic":true}`)
  cmd(entity, `title @a[distance=..${range}] title {"text":"${text}","color":"${color}","bold":true}`)
}

function actionbar(entity, range, text, color) {
  cmd(entity, `title @a[distance=..${range}] actionbar {"text":"${text}","color":"${color}"}`)
}

// ---------------------------------------------------------------------
// Photon 2 effects (assets/kubejs/fx/<name>.fx)
// ---------------------------------------------------------------------
function fxId(name) {
  return name.indexOf(':') >= 0 ? name : `${PHOTON.namespace}:${name}`
}

function num(v) { return Number(v || 0).toFixed(2) }

// Attach an effect to an entity. opts: offset [x,y,z], rotation [x,y,z],
// scale (number or [x,y,z]), delay, forcedDeath, allowMulti, autoRotate
// ('none' | 'forward' | 'look' | 'xrot').
function fxEntity(entity, name, opts) {
  if (!PHOTON.enabled || !entity) return
  var o = opts || {}
  var off = o.offset || [0, 0, 0], rot = o.rotation || [0, 0, 0]
  var sc = typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : (o.scale || [1, 1, 1])
  var uuid = String(entity.getUUID())
  cmd(entity, `photon fx ${fxId(name)} entity ${uuid} ${num(off[0])} ${num(off[1])} ${num(off[2])} ${num(rot[0])} ${num(rot[1])} ${num(rot[2])} ${num(sc[0])} ${num(sc[1])} ${num(sc[2])} ${o.delay || 0} ${o.forcedDeath ? 'true' : 'false'} ${o.allowMulti === false ? 'false' : 'true'} ${o.autoRotate || 'look'}`)
}

// Remove one (or every) Photon effect bound to an entity.
function fxRemove(entity, name) {
  if (!PHOTON.enabled || !entity) return
  cmd(entity, `photon fx remove entity ${String(entity.getUUID())} false${name ? ' ' + fxId(name) : ''}`)
}

// Play an effect at a world position (bound to the block there).
function fxAt(entity, name, x, y, z, opts) {
  if (!PHOTON.enabled || !entity) return
  var o = opts || {}
  var off = o.offset || [0, 0, 0], rot = o.rotation || [0, 0, 0]
  var sc = typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : (o.scale || [1, 1, 1])
  cmd(entity, `photon fx ${fxId(name)} block ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} ${num(off[0])} ${num(off[1])} ${num(off[2])} ${num(rot[0])} ${num(rot[1])} ${num(rot[2])} ${num(sc[0])} ${num(sc[1])} ${num(sc[2])} ${o.delay || 0} ${o.forcedDeath ? 'true' : 'false'} true false`)
}

// Play an effect at a position with rotation derived from a direction vector.
function fxAlong(entity, name, x, y, z, dir, opts) {
  var yaw = Math.atan2(-dir.x, dir.z) * 180 / Math.PI
  var pitch = -Math.asin(Math.max(-1, Math.min(1, dir.y))) * 180 / Math.PI
  var o = opts || {}
  o.rotation = [pitch, yaw, 0]
  fxAt(entity, name, x, y, z, o)
}

// ---------------------------------------------------------------------
// Summoned weapons
// ---------------------------------------------------------------------
function isSummoned(stack) {
  try {
    var data = stack.get('minecraft:custom_data')
    return data != null && data.contains(HK.summonKey)
  } catch (e) { return false }
}

function summonedCount(player, weaponId) {
  var n = 0
  try {
    var inv = player.inventory
    for (var i = 0; i < inv.slots; i++) {
      var stack = inv.getStackInSlot(i)
      if (!stack.isEmpty() && stack.id == weaponId && isSummoned(stack)) n++
    }
  } catch (e) { hkFail('summonedCount', e) }
  return n
}

function dismissWeapon(player, weaponId) {
  try {
    var inv = player.inventory
    for (var i = 0; i < inv.slots; i++) {
      var stack = inv.getStackInSlot(i)
      if (!stack.isEmpty() && stack.id == weaponId && isSummoned(stack)) inv.setStackInSlot(i, Item.empty)
    }
  } catch (e) { hkFail('dismissWeapon', e) }
}

function holdsWeapon(entity, weaponId) {
  try { return String(entity.getMainHandItem().id) == weaponId } catch (e) { return false }
}

// Shared summon-skill behaviour: press once to summon, press again to dismiss.
function summonSkill(ctx, weaponId, label, cost, durationTicks, masteredBonusTicks, theme) {
  var player = ctx.entity
  if (!isServerLiving(player) || !isPlayerEntity(player)) return
  var x = player.getX(), y = player.getY(), z = player.getZ()
  var themeParticle = theme == 'red' ? 'minecraft:soul_fire_flame' : (theme == 'blue' ? 'minecraft:electric_spark' : 'minecraft:end_rod')
  if (summonedCount(player, weaponId) > 0) {
    dismissWeapon(player, weaponId)
    ctx.tell(`${label} returns to the light.`)
    fxRemove(player, `${label.toLowerCase()}_held`)
    fxEntity(player, 'weapon_dismiss', { autoRotate: 'none' })
    helix(player, themeParticle, x, y, z, 0.8, 2.5, 2, 0)
    sound(player, 'minecraft:block.beacon.deactivate', 1, theme == 'red' ? 0.6 : 1.4)
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
  // Visuals: a pillar of light, a rising double helix and an expanding ring.
  fxEntity(player, `${label.toLowerCase()}_summon`, { autoRotate: 'none' })
  pillar(player, themeParticle, x, y, z, 6, 4)
  helix(player, theme == 'red' ? 'minecraft:crimson_spore' : 'minecraft:end_rod', x, y, z, 1.2, 3, 3, 0)
  shockwave(player, theme == 'red' ? 'minecraft:soul' : 'minecraft:firework', x, y + 0.2, z, 4, 3, 0.4)
  particles(player, 'minecraft:flash', x, y + 1.2, z, 0, 0, 0, 1, 0)
  sound(player, 'minecraft:block.beacon.activate', 1, theme == 'red' ? 0.6 : 1.4)
  sound(player, 'minecraft:item.trident.thunder', 0.6, theme == 'red' ? 0.7 : 1.3)
  sound(player, 'minecraft:block.respawn_anchor.charge', 1, theme == 'red' ? 0.5 : 1.5)
  actionbar(player, 32, `${label} manifests in ${isPlayerEntity(player) ? player.getName().getString() : 'a warrior'}'s hand`, theme == 'red' ? 'dark_red' : 'gold')
  ctx.instance.getSkill().addMasteryPoint(ctx.instance, player)
}
