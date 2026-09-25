package com.tensura_kubejs.kubejs.context;

import io.github.manasmods.manascore.network.api.util.Changeable;
import io.github.manasmods.manascore.skill.api.ManasSkillInstance;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;

public final class SkillDamageContext extends SkillContext {
    public final LivingEntity target;
    public final DamageSource source;
    public final Changeable<Float> amount;

    public SkillDamageContext(ManasSkillInstance instance, LivingEntity entity, LivingEntity target, DamageSource source, Changeable<Float> amount) {
        super(instance, entity, 0, 0, 0, 0D);
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
