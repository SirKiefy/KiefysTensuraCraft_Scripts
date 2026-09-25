Put local development dependency jars here. Third-party mod jars are intentionally excluded from Git.

At minimum, a local development setup needs compatible Minecraft 1.21.1 NeoForge builds of KubeJS, Rhino, Tensura, ManasCore modules, and their required dependencies. You may also place KubeJS and Rhino jars in the project root; their filenames do not matter.

The Gradle build also scans these existing local folders when present:

- `../tensura_ablazeaqzl/lib`
- `../server1.21/lib`
