# Photon 2 effects for the holy-knight / three-crowns pack

Every ability plays a Photon 2 effect **if** a file with the matching id
exists here, and a vanilla particle choreography either way. Photon `.fx`
files can only be authored in the in-game editor (`/photon_editor`, single
player), so this folder ships empty. To add an effect:

1. Run `/photon_editor`, build the effect, **File -> Export -> FX** and
   export it as `kubejs:<name>` (namespace `kubejs`, path from the table).
2. Copy the exported file from `.minecraft/ldlib2/assets/kubejs/fx/<name>.fx`
   into this folder, and any materials it references from
   `.minecraft/ldlib2/assets/ldlib2/resources/...` into
   `kubejs/assets/ldlib2/resources/...`. Or export an `.fxpack` and drop it in
   `<gameDir>/photon/fxpacks/` (the pack's namespace must then be `kubejs`).
3. Reload resources (F3+T). The scripts need no change.

Anchors: `entity` effects are attached to the caster with `/photon fx ... entity`
(auto-rotate `look` unless noted), `block` effects are spawned at a world
position with `/photon fx ... block`. Toggle effects stay attached until the
skill is toggled off (removed with `/photon fx remove entity`).

## Skills

| Effect id (`kubejs:`) | Anchor | Played when |
|---|---|---|
| `divine_smite_pillar` | block at target | Divine Smite lands |
| `wall_of_the_kingdom` | entity, none, toggle | Wall of the Kingdom on |
| `wall_block` | entity | Wall of the Kingdom blocks a hit |
| `invisible_air` | entity, none, toggle | Invisible Air on |
| `strike_air` | entity, look | Strike Air (press while Invisible Air is on) |
| `kings_decree` | entity, none, toggle | Lord of the Kingdom on |
| `excalibur_summon`, `clarent_summon`, `rhongomyniad_summon` | entity, none | weapon summoned |
| `weapon_dismiss` | entity, none | weapon dismissed |
| `excalibur_held`, `clarent_held`, `rhongomyniad_held` | entity, none, persistent | weapon in main hand |
| `excalibur_charge` | entity, look | charging Excalibur (removed on release) |
| `excalibur_beam` | entity, look, scale 0.5-1.5 | Excalibur fired |
| `excalibur_impact` | block at beam end, scale 0.5-1.5 | Excalibur beam ends |
| `lance_dash` | entity, look | Rhongomyniad dash |
| `lance_impact` | block at arrival | Rhongomyniad dash ends |
| `avalon` | entity, none | Avalon (lasts the invulnerability) |
| `blood_pact` | entity, none, toggle | Blood Pact on |
| `hellfire_cone` | entity, look | Hellfire Brand |
| `sovereigns_pressure` | entity, none, scale 1-1.4 | Sovereign's Pressure |
| `clarent_charge` | entity, look | charging Clarent (removed on release) |
| `clarent_wave` | entity, look, scale 0.6-1.6 | Clarent Blood Arthur fired |
| `dragon_breath` | entity, look | Dragon Breath |
| `draconic_scales` | entity, none, toggle | Draconic Scales on |
| `wings_of_the_wyrm` | entity, none | Wings of the Wyrm |
| `dragon_roar` | entity, none | Dragon Roar |
| `cataclysm_meteor` | block at each impact | Cataclysm (5 impacts) |
| `three_crowns` | entity, none, toggle | Three Crowns on |
| `world_ender` | entity, none | World Ender |

## Race abilities

`knights_charge` (look), `royal_decree`, `sanctuary`, `hellstep`,
`infernal_rally`, `throne_of_ash`, `wing_gust`, `draconic_descent`,
`draconic_nova`, `coronation` (all entity, none).

## Bosses

| Effect id | Anchor | Played when |
|---|---|---|
| `mordred_sweep` | entity, none | Mordred's crimson sweep |
| `mordred_enrage` | entity, none, persistent | Mordred below 50% |
| `leonis_smite` | block at target | Leonis' holy smite |
| `leonis_sanctuary` | entity, none, persistent | Leonis below 30% |
| `balor_hellfire` | entity, look | Balor's hellfire cone |
| `balor_blink` | entity, none | Balor teleports |
| `boss_death` | block at corpse | any boss dies |

To disable the Photon layer entirely set `PHOTON.enabled = false` at the top
of `startup_scripts/holy_fx_lib.js`.
