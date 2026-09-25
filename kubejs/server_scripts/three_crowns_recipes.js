// priority: 80
//
// kubejs/server_scripts/three_crowns_recipes.js
// ----------------------------------------------
// Recipes for the proof-of-path essences used by the apex race
// (kubejs:primordial_sovereign, see startup_scripts/three_crowns_content.js).
// Every essence needs a boss drop or the Ender Dragon's leavings, so the
// apex demands conquering all three paths.

ServerEvents.recipes(event => {
  // Holy Essence: Leonis' grail plus the trappings of an immortal king.
  event.shapeless('kubejs:holy_essence', [
    'kubejs:holy_grail',
    'minecraft:nether_star',
    'minecraft:totem_of_undying',
    'minecraft:enchanted_golden_apple',
    'minecraft:netherite_block',
    'minecraft:gold_block',
    'minecraft:gold_block',
    'minecraft:glowstone',
    'minecraft:diamond_block'
  ]).id('kubejs:three_crowns/holy_essence')

  // Demonic Essence: Balor's heart steeped in the Nether's worst.
  event.shapeless('kubejs:demonic_essence', [
    'kubejs:demon_heart',
    'minecraft:nether_star',
    'minecraft:wither_skeleton_skull',
    'minecraft:wither_skeleton_skull',
    'minecraft:netherite_block',
    'minecraft:crying_obsidian',
    'minecraft:ghast_tear',
    'minecraft:blaze_rod',
    'minecraft:magma_block'
  ]).id('kubejs:three_crowns/demonic_essence')

  // Dragon Heart: the Ender Dragon's breath bound around a crystal core.
  event.shaped('kubejs:dragon_heart', [
    'BCB',
    'NSN',
    'BCB'
  ], {
    B: 'minecraft:dragon_breath',
    C: 'minecraft:end_crystal',
    N: 'minecraft:netherite_ingot',
    S: 'minecraft:nether_star'
  }).id('kubejs:three_crowns/dragon_heart')

  // Dragon Essence: a Dragon Heart refined with end-stone and shulker essence.
  event.shapeless('kubejs:dragon_essence', [
    'kubejs:dragon_heart',
    'minecraft:nether_star',
    'minecraft:dragon_breath',
    'minecraft:dragon_breath',
    'minecraft:shulker_shell',
    'minecraft:shulker_shell',
    'minecraft:netherite_block',
    'minecraft:end_crystal',
    'minecraft:diamond_block'
  ]).id('kubejs:three_crowns/dragon_essence')

  // Essence of the Three Crowns: all three essences fused.
  event.shaped('kubejs:essence_of_three_crowns', [
    'SNS',
    'HDX',
    'SNS'
  ], {
    H: 'kubejs:holy_essence',
    D: 'kubejs:demonic_essence',
    X: 'kubejs:dragon_essence',
    N: 'minecraft:netherite_block',
    S: 'minecraft:nether_star'
  }).id('kubejs:three_crowns/essence_of_three_crowns')
})
