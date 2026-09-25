# TensurJS

TensurJS is a KubeJS addon for Minecraft 1.21.1 NeoForge that exposes selected ManasCore and Tensura systems to JavaScript.

Create custom skills and races, define evolution routes, override existing Tensura skills, and grant elemental spirits without writing a separate Java addon.

## Features

- Register custom skills with modes, attributes, activation checks, and scripted behavior.
- Register custom races with stats, abilities, starting pools, and evolution requirements.
- Override the icon, cooldown, mode cooldowns, and callbacks of existing Tensura skills.
- Grant lesser, medium, or greater elemental spirits with prayer-equivalent rewards.
- Access script contexts for entities, skill state, cooldowns, magicules, effects, and spawning.

## Quick Start

Put registry and skill override scripts in `kubejs/startup_scripts/`. Changes to startup scripts require a full game restart; `/reload` does not recreate registries.

```js
StartupEvents.registry(TensuraKubeJS.SKILL_REGISTRY, event => {
  event.create('example:summon_villager')
    .name('Summon Villager')
    .description('Consumes 1000 magicules and summons a villager.')
    .type('extra')
    .icon('example:skill/summon_villager')
    .onPressed(ctx => {
      if (ctx.cooldown() > 0) return
      if (!ctx.consumeMagicule(1000)) return

      ctx.spawnEntity('minecraft:villager')
      ctx.setCooldown(5)
    })
})
```

The example icon belongs at:

```text
kubejs/assets/example/textures/skill/summon_villager.png
```

## Documentation

The [TensurJS Wiki](https://github.com/AQZL/TensurJS/wiki) contains complete skill and race examples, existing-skill overrides, elemental spirit usage, context references, and the full public API.

- [API Reference](https://github.com/AQZL/TensurJS/wiki/API-Reference)
- [Creating Skills](https://github.com/AQZL/TensurJS/wiki/Creating-Skills)
- [Creating Races](https://github.com/AQZL/TensurJS/wiki/Creating-Races)
- [Modifying Existing Skills](https://github.com/AQZL/TensurJS/wiki/Modifying-Existing-Skills)
- [Elemental Spirits](https://github.com/AQZL/TensurJS/wiki/Elemental-Spirits)

## Building from Source

Third-party mod jars are intentionally excluded from this repository. Put compatible KubeJS, Rhino, Tensura, ManasCore, and required dependency jars in `lib/`, then run:

```powershell
.\gradlew.bat build
```

The output jar is created in `build/libs/`.

## Ownership and Permissions

Copyright © 2026 AQZL. All rights reserved.

You may view, fork, and modify the source code for personal use or for contributing changes back to the official project.

You may not redistribute, republish, re-upload, mirror, sell, or otherwise distribute the original project, compiled builds, source code, or modified versions without prior written permission from AQZL.
