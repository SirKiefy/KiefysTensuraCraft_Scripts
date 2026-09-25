package com.tensura_kubejs.kubejs.context;

import io.github.manasmods.manascore.race.api.ManasRaceInstance;
import net.minecraft.world.entity.LivingEntity;

public class RaceContext {
    public final ManasRaceInstance instance;
    public final LivingEntity entity;
    public final int heldTicks;

    public RaceContext(ManasRaceInstance instance, LivingEntity entity, int heldTicks) {
        this.instance = instance;
        this.entity = entity;
        this.heldTicks = heldTicks;
    }

    public int cooldown() {
        return instance.getCooldown();
    }

    public void setCooldown(int ticks) {
        instance.setCooldown(ticks);
    }
}
