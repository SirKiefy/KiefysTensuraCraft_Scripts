package com.tensura_kubejs.kubejs.context;

import io.github.manasmods.manascore.network.api.util.Changeable;
import io.github.manasmods.manascore.race.api.ManasRaceInstance;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;

public final class RaceDamageContext extends RaceContext {
    public final LivingEntity target;
    public final DamageSource source;
    public final Changeable<Float> amount;

    public RaceDamageContext(ManasRaceInstance instance, LivingEntity owner, LivingEntity target, DamageSource source, Changeable<Float> amount) {
        super(instance, owner, 0);
        this.target = target;
        this.source = source;
        this.amount = amount;
    }

    public float amount() {
        return amount.get();
    }

    public void setAmount(float value) {
        amount.set(value);
    }
}
