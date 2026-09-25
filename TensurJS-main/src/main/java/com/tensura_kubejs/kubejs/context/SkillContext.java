package com.tensura_kubejs.kubejs.context;

import io.github.manasmods.manascore.skill.api.ManasSkillInstance;
import io.github.manasmods.tensura.util.EnergyHelper;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import org.jetbrains.annotations.Nullable;

public class SkillContext {
    public final ManasSkillInstance instance;
    public final LivingEntity entity;
    public final int keyNumber;
    public final int mode;
    public final int heldTicks;
    public final double delta;

    public SkillContext(ManasSkillInstance instance, LivingEntity entity, int keyNumber, int mode, int heldTicks, double delta) {
        this.instance = instance;
        this.entity = entity;
        this.keyNumber = keyNumber;
        this.mode = mode;
        this.heldTicks = heldTicks;
        this.delta = delta;
    }

    public boolean isToggled() {
        return instance.isToggled();
    }

    public double mastery() {
        return instance.getMastery();
    }

    public void setMastery(double mastery) {
        instance.setMastery(mastery);
    }

    public int cooldown() {
        return instance.getCoolDown(mode);
    }

    public void setCooldown(int seconds) {
        instance.setCoolDown(Math.max(0, seconds), mode);
    }

    public void setCooldownTicks(int ticks) {
        setCooldown((int) Math.ceil(Math.max(0, ticks) / 20.0D));
    }

    public boolean consumeMagicule(double amount) {
        return EnergyHelper.isOutOfMagiculeConsuming(entity, amount, 0.0D) <= 0.0D;
    }

    public @Nullable Entity spawnEntity(String entityTypeId) {
        if (!(entity.level() instanceof ServerLevel level)) {
            return null;
        }

        EntityType<?> type = BuiltInRegistries.ENTITY_TYPE.get(ResourceLocation.parse(entityTypeId));
        Entity spawned = type.create(level);
        if (spawned == null) {
            return null;
        }

        spawned.moveTo(entity.getX(), entity.getY(), entity.getZ(), entity.getYRot(), entity.getXRot());
        level.addFreshEntity(spawned);
        return spawned;
    }

    public void tell(String message) {
        if (entity instanceof Player player) {
            player.displayClientMessage(Component.literal(message), true);
        }
    }
}
