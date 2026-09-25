package com.tensura_kubejs.kubejs.context;

import io.github.manasmods.manascore.race.api.ManasRace;
import io.github.manasmods.manascore.race.api.ManasRaceInstance;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.LivingEntity;

public final class RaceEvolutionContext extends RaceContext {
    public final ManasRace evolution;
    public final ManasRaceInstance evolutionInstance;

    public RaceEvolutionContext(ManasRaceInstance instance, LivingEntity entity, ManasRace evolution) {
        super(instance, entity, 0);
        this.evolution = evolution;
        this.evolutionInstance = null;
    }

    public RaceEvolutionContext(ManasRaceInstance instance, LivingEntity entity, ManasRaceInstance evolutionInstance) {
        super(instance, entity, 0);
        this.evolution = evolutionInstance.getRace();
        this.evolutionInstance = evolutionInstance;
    }

    public String evolutionId() {
        ResourceLocation id = evolution.getRegistryName();
        return id == null ? "" : id.toString();
    }
}
