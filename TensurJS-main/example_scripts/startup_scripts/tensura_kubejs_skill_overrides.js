// 放到整合包 kubejs/startup_scripts/ 里面，修改后必须重启游戏。

TensuraKubeJS.modifySkill('tensura:magic_sense')
  // 对应 kubejs/assets/tensura_kubejs/textures/skill/summon_villager.png
  .icon('tensura_kubejs:skill/summon_villager')

  // 按下魔力感知后进入 5 秒冷却，原本的魔力感知功能仍然保留。
  .cooldown(5)
