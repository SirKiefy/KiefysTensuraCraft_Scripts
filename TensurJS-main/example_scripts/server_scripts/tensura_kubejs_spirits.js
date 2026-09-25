// 放到整合包 kubejs/server_scripts/ 里面。
// 这里用经验等级演示“达成不同条件获得不同等级精灵”。
// grantSpirit 会像主模组祈祷成功一样，同时授予该等级及以下的元素魔法和元素操控。

// 给使用旧版 API 已经获得精灵的玩家补发对应魔法；重复执行不会重复学习技能。
PlayerEvents.loggedIn(event => {
  TensuraKubeJS.syncSpiritRewards(event.player)
})

PlayerEvents.tick(event => {
  const player = event.player

  if (player.experienceLevel >= 60 && !TensuraKubeJS.hasSpiritAtLeast(player, 'fire', 'greater')) {
    TensuraKubeJS.grantSpirit(player, 'fire', 'greater')
    player.tell('你获得了火属性大精灵。')
  } else if (player.experienceLevel >= 30 && !TensuraKubeJS.hasSpiritAtLeast(player, 'fire', 'medium')) {
    TensuraKubeJS.grantSpirit(player, 'fire', 'medium')
    player.tell('你获得了火属性中级精灵。')
  } else if (player.experienceLevel >= 10 && !TensuraKubeJS.hasSpiritAtLeast(player, 'fire', 'lesser')) {
    TensuraKubeJS.grantSpirit(player, 'fire', 'lesser')
    player.tell('你获得了火属性小精灵。')
  }
})

// 支持的精灵等级：lesser、medium、greater、lord。
// 支持的元素：darkness、earth、fire、light、space、water、wind、holy。
// 也可以直接使用中文，例如：
// TensuraKubeJS.grantSpirit(player, '火', '大精灵')
