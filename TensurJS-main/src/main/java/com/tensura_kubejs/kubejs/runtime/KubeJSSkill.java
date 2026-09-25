package com.tensura_kubejs.kubejs.runtime;

import com.tensura_kubejs.TensuraKubeJS;
import com.tensura_kubejs.kubejs.builder.KubeJSSkillBuilder;
import com.tensura_kubejs.kubejs.callback.ActionCallback;
import com.tensura_kubejs.kubejs.callback.BooleanCallback;
import com.tensura_kubejs.kubejs.context.SkillContext;
import com.tensura_kubejs.kubejs.context.SkillDamageContext;
import com.tensura_kubejs.kubejs.override.SkillIconOverride;
import com.tensura_kubejs.kubejs.util.ReincarnationConfigHooks;
import io.github.manasmods.manascore.network.api.util.Changeable;
import io.github.manasmods.manascore.skill.api.ManasSkill;
import io.github.manasmods.manascore.skill.api.ManasSkillInstance;
import io.github.manasmods.tensura.ability.skill.Skill;
import net.minecraft.ChatFormatting;
import net.minecraft.core.Holder;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.Style;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.attributes.Attribute;
import org.jetbrains.annotations.Nullable;

import java.util.Map;

public final class KubeJSSkill extends Skill {
    private final KubeJSSkillBuilder builder;

    public KubeJSSkill(KubeJSSkillBuilder builder) {
        super(builder.type);
        this.builder = builder;
        for (Map.Entry<Holder<Attribute>, AttributeTemplate> entry : builder.heldAttributes.entrySet()) {
            this.attributeModifiers.put(entry.getKey(), entry.getValue());
        }
        if (builder.startingSkill != null) {
            if (builder.startingSkill) {
                ReincarnationConfigHooks.addStartingSkill(builder.registryId, this, false);
            } else {
                ReincarnationConfigHooks.removeStartingSkill(builder.registryId, false);
            }
        }
        if (builder.secondStartingSkill != null) {
            if (builder.secondStartingSkill) {
                ReincarnationConfigHooks.addStartingSkill(builder.registryId, this, true);
            } else {
                ReincarnationConfigHooks.removeStartingSkill(builder.registryId, true);
            }
        }
    }

    @Override
    public @Nullable ResourceLocation getSkillIcon() {
        ResourceLocation override = SkillIconOverride.get(this);
        if (override != null) {
            return override;
        }
        return builder.icon == null ? super.getSkillIcon() : builder.icon;
    }

    @Override
    public int getModes(ManasSkillInstance instance) {
        return builder.modes;
    }

    @Override
    public String getModeId(ManasSkillInstance instance, int mode) {
        return builder.getModeIdForLang(mode);
    }

    @Override
    public Component getModeName(ManasSkillInstance instance, int mode) {
        if (builder.modes <= 1 && !builder.modeNames.containsKey(mode)) {
            return Component.translatable("tensura.skill.mode.default").withStyle(Style.EMPTY.withColor(ChatFormatting.GRAY));
        }
        return Component.translatable(builder.registryId.getNamespace() + ".skill.mode." + getModeId(instance, mode))
                .withStyle(Style.EMPTY.withColor(ChatFormatting.GRAY));
    }

    @Override
    public int nextMode(LivingEntity entity, ManasSkillInstance instance, int mode, boolean reverse) {
        int modes = Math.max(1, instance.getModes());
        if (modes <= 1) {
            return 0;
        }
        return reverse ? Math.floorMod(mode - 1, modes) : Math.floorMod(mode + 1, modes);
    }

    @Override
    public int getMaxHeldTime(ManasSkillInstance instance, LivingEntity entity) {
        return builder.maxHeldTime;
    }

    @Override
    public int getMaxMastery() {
        return builder.maxMastery;
    }

    @Override
    public boolean canInteractSkill(ManasSkillInstance instance, LivingEntity user) {
        SkillContext context = new SkillContext(instance, user, 0, 0, 0, 0D);
        return test(builder.canActivate, context, test(builder.canInteract, context, super.canInteractSkill(instance, user)));
    }

    @Override
    public boolean canBeToggled(ManasSkillInstance instance, LivingEntity entity) {
        return test(builder.canBeToggled, new SkillContext(instance, entity, 0, 0, 0, 0D), super.canBeToggled(instance, entity));
    }

    @Override
    public boolean canTick(ManasSkillInstance instance, LivingEntity entity) {
        return test(builder.canTick, new SkillContext(instance, entity, 0, 0, 0, 0D), super.canTick(instance, entity));
    }

    @Override
    public boolean canScroll(ManasSkillInstance instance, LivingEntity entity, int mode) {
        return test(builder.canScroll, new SkillContext(instance, entity, 0, mode, 0, 0D), super.canScroll(instance, entity, mode));
    }

    @Override
    public boolean canIgnoreCoolDown(ManasSkillInstance instance, LivingEntity entity, int mode) {
        return test(builder.canIgnoreCooldown, new SkillContext(instance, entity, 0, mode, 0, 0D), super.canIgnoreCoolDown(instance, entity, mode));
    }

    @Override
    public boolean shouldTriggerReleaseOnHeldInterrupt(ManasSkillInstance instance, LivingEntity entity, int keyNumber, int mode) {
        return test(builder.shouldReleaseOnInterrupt, new SkillContext(instance, entity, keyNumber, mode, 0, 0D), super.shouldTriggerReleaseOnHeldInterrupt(instance, entity, keyNumber, mode));
    }

    @Override
    public boolean isMastered(ManasSkillInstance instance, LivingEntity entity) {
        return test(builder.isMastered, new SkillContext(instance, entity, 0, 0, 0, 0D), super.isMastered(instance, entity));
    }

    @Override
    public void onToggleOn(ManasSkillInstance instance, LivingEntity entity) {
        run(builder.onToggleOn, new SkillContext(instance, entity, 0, 0, 0, 0D));
    }

    @Override
    public void onToggleOff(ManasSkillInstance instance, LivingEntity entity) {
        run(builder.onToggleOff, new SkillContext(instance, entity, 0, 0, 0, 0D));
    }

    @Override
    public void onTick(ManasSkillInstance instance, LivingEntity living) {
        run(builder.onTick, new SkillContext(instance, living, 0, 0, 0, 0D));
    }

    @Override
    public void onPressed(ManasSkillInstance instance, LivingEntity entity, int keyNumber, int mode) {
        run(builder.onPressed, new SkillContext(instance, entity, keyNumber, mode, 0, 0D));
    }

    @Override
    public boolean onHeld(ManasSkillInstance instance, LivingEntity living, int heldTicks, int mode) {
        return test(builder.onHeld, new SkillContext(instance, living, 0, mode, heldTicks, 0D), super.onHeld(instance, living, heldTicks, mode));
    }

    @Override
    public void onRelease(ManasSkillInstance instance, LivingEntity entity, int heldTicks, int keyNumber, int mode) {
        run(builder.onRelease, new SkillContext(instance, entity, keyNumber, mode, heldTicks, 0D));
    }

    @Override
    public void onScroll(ManasSkillInstance instance, LivingEntity living, double delta, int mode) {
        run(builder.onScroll, new SkillContext(instance, living, 0, mode, 0, delta));
    }

    @Override
    public void onLearnSkill(ManasSkillInstance instance, LivingEntity entity) {
        run(builder.onLearn, new SkillContext(instance, entity, 0, 0, 0, 0D));
    }

    @Override
    public void onForgetSkill(ManasSkillInstance instance, LivingEntity entity) {
        run(builder.onForget, new SkillContext(instance, entity, 0, 0, 0, 0D));
    }

    @Override
    public void onSkillMastered(ManasSkillInstance instance, LivingEntity entity) {
        run(builder.onMastered, new SkillContext(instance, entity, 0, 0, 0, 0D));
    }

    @Override
    public boolean onBeingDamaged(ManasSkillInstance instance, LivingEntity entity, DamageSource source, float amount) {
        return test(builder.onBeingDamaged, new SkillDamageContext(instance, entity, entity, source, Changeable.of(amount)), super.onBeingDamaged(instance, entity, source, amount));
    }

    @Override
    public boolean onDamageEntity(ManasSkillInstance instance, LivingEntity owner, LivingEntity target, DamageSource source, Changeable<Float> amount) {
        return test(builder.onDamageEntity, new SkillDamageContext(instance, owner, target, source, amount), super.onDamageEntity(instance, owner, target, source, amount));
    }

    @Override
    public boolean onTakenDamage(ManasSkillInstance instance, LivingEntity owner, DamageSource source, Changeable<Float> amount) {
        return test(builder.onTakenDamage, new SkillDamageContext(instance, owner, owner, source, amount), super.onTakenDamage(instance, owner, source, amount));
    }

    @Override
    public boolean onDeath(ManasSkillInstance instance, LivingEntity owner, DamageSource source) {
        return test(builder.onDeath, new SkillContext(instance, owner, 0, 0, 0, 0D), super.onDeath(instance, owner, source));
    }

    private static <T> void run(@Nullable ActionCallback<T> callback, T context) {
        if (callback == null) return;
        try {
            callback.run(context);
        } catch (Throwable throwable) {
            TensuraKubeJS.LOGGER.error("Error in KubeJS skill callback", throwable);
        }
    }

    private static <T> boolean test(@Nullable BooleanCallback<T> callback, T context, boolean fallback) {
        if (callback == null) return fallback;
        try {
            return callback.test(context);
        } catch (Throwable throwable) {
            TensuraKubeJS.LOGGER.error("Error in KubeJS skill callback", throwable);
            return fallback;
        }
    }
}
