package com.tensura_kubejs.kubejs;

import com.tensura_kubejs.kubejs.builder.KubeJSRaceBuilder;
import com.tensura_kubejs.kubejs.builder.KubeJSSkillBuilder;
import com.tensura_kubejs.kubejs.util.TensuraKubeJSBindings;
import dev.latvian.mods.kubejs.plugin.KubeJSPlugin;
import dev.latvian.mods.kubejs.registry.BuilderTypeRegistry;
import dev.latvian.mods.kubejs.script.BindingRegistry;
import io.github.manasmods.manascore.race.api.RaceAPI;
import io.github.manasmods.manascore.skill.api.SkillAPI;

public final class TensuraKubeJSPlugin implements KubeJSPlugin {
    @Override
    public void registerBuilderTypes(BuilderTypeRegistry registry) {
        registry.addDefault(SkillAPI.getSkillRegistryKey(), KubeJSSkillBuilder.class, KubeJSSkillBuilder::new);
        registry.addDefault(RaceAPI.getRaceRegistryKey(), KubeJSRaceBuilder.class, KubeJSRaceBuilder::new);
    }

    @Override
    public void registerBindings(BindingRegistry bindings) {
        bindings.add("TensuraKubeJS", TensuraKubeJSBindings.class);
    }
}
