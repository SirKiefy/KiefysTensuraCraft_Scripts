package com.tensura_kubejs.mixin;

import com.tensura_kubejs.kubejs.context.SkillContext;
import com.tensura_kubejs.kubejs.context.SkillDamageContext;
import com.tensura_kubejs.kubejs.override.SkillOverrideBuilder;
import com.tensura_kubejs.kubejs.override.SkillOverrideRegistry;
import io.github.manasmods.manascore.network.api.util.Changeable;
import io.github.manasmods.manascore.skill.api.ManasSkillInstance;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(value = ManasSkillInstance.class, remap = false)
public abstract class ManasSkillInstanceMixin {
    private ManasSkillInstance tensuraKubeJS$self() {
        return (ManasSkillInstance) (Object) this;
    }

    private SkillOverrideBuilder tensuraKubeJS$override() {
        return SkillOverrideRegistry.get(tensuraKubeJS$self());
    }

    @Inject(method = "canInteractSkill", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$canInteract(LivingEntity entity, CallbackInfoReturnable<Boolean> callback) {
        setBooleanResult(tensuraKubeJS$override() == null ? null : tensuraKubeJS$override().canInteract,
                context(entity, 0, 0, 0, 0D), callback);
    }

    @Inject(method = "canActivateSkill", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$canActivate(LivingEntity entity, int mode, CallbackInfoReturnable<Boolean> callback) {
        setBooleanResult(tensuraKubeJS$override() == null ? null : tensuraKubeJS$override().canActivate,
                context(entity, 0, mode, 0, 0D), callback);
    }

    @Inject(method = "canBeToggled", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$canBeToggled(LivingEntity entity, CallbackInfoReturnable<Boolean> callback) {
        setBooleanResult(tensuraKubeJS$override() == null ? null : tensuraKubeJS$override().canBeToggled,
                context(entity, 0, 0, 0, 0D), callback);
    }

    @Inject(method = "canTick", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$canTick(LivingEntity entity, CallbackInfoReturnable<Boolean> callback) {
        setBooleanResult(tensuraKubeJS$override() == null ? null : tensuraKubeJS$override().canTick,
                context(entity, 0, 0, 0, 0D), callback);
    }

    @Inject(method = "canScroll", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$canScroll(LivingEntity entity, int mode, CallbackInfoReturnable<Boolean> callback) {
        setBooleanResult(tensuraKubeJS$override() == null ? null : tensuraKubeJS$override().canScroll,
                context(entity, 0, mode, 0, 0D), callback);
    }

    @Inject(method = "canIgnoreCoolDown", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$canIgnoreCooldown(LivingEntity entity, int mode, CallbackInfoReturnable<Boolean> callback) {
        setBooleanResult(tensuraKubeJS$override() == null ? null : tensuraKubeJS$override().canIgnoreCooldown,
                context(entity, 0, mode, 0, 0D), callback);
    }

    @Inject(method = "shouldTriggerReleaseOnHeldInterrupt", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$shouldRelease(LivingEntity entity, int keyNumber, int mode, CallbackInfoReturnable<Boolean> callback) {
        setBooleanResult(tensuraKubeJS$override() == null ? null : tensuraKubeJS$override().shouldReleaseOnInterrupt,
                context(entity, keyNumber, mode, 0, 0D), callback);
    }

    @Inject(method = "isMastered", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$isMastered(LivingEntity entity, CallbackInfoReturnable<Boolean> callback) {
        setBooleanResult(tensuraKubeJS$override() == null ? null : tensuraKubeJS$override().isMastered,
                context(entity, 0, 0, 0, 0D), callback);
    }

    @ModifyVariable(method = "setCoolDown", at = @At("HEAD"), argsOnly = true, ordinal = 0)
    private int tensuraKubeJS$modifyCooldown(int cooldown, int originalCooldown, int mode) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        ManasSkillInstance instance = tensuraKubeJS$self();
        if (override == null || cooldown < instance.getCoolDown(mode)) {
            return cooldown;
        }
        return override.resolveCooldown(cooldown, mode);
    }

    @Inject(method = "setCoolDowns", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$modifyAllCooldowns(int cooldown, CallbackInfo callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override == null || !override.hasCooldownOverride()) {
            return;
        }
        ManasSkillInstance instance = tensuraKubeJS$self();
        for (int mode = 0; mode < instance.getCooldownList().size(); mode++) {
            instance.setCoolDown(cooldown, mode);
        }
        callback.cancel();
    }

    @Inject(method = "onToggleOn", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onToggleOn(LivingEntity entity, CallbackInfo callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override != null && SkillOverrideRegistry.run(override.onToggleOn, context(entity, 0, 0, 0, 0D))) {
            callback.cancel();
        }
    }

    @Inject(method = "onToggleOff", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onToggleOff(LivingEntity entity, CallbackInfo callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override != null && SkillOverrideRegistry.run(override.onToggleOff, context(entity, 0, 0, 0, 0D))) {
            callback.cancel();
        }
    }

    @Inject(method = "onTick", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onTick(LivingEntity entity, CallbackInfo callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override != null && SkillOverrideRegistry.run(override.onTick, context(entity, 0, 0, 0, 0D))) {
            callback.cancel();
        }
    }

    @Inject(method = "onPressed", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onPressed(LivingEntity entity, int keyNumber, int mode, CallbackInfo callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override != null && SkillOverrideRegistry.run(override.onPressed, context(entity, keyNumber, mode, 0, 0D))) {
            tensuraKubeJS$applyPressedCooldown(override, mode);
            callback.cancel();
        }
    }

    @Inject(method = "onPressed", at = @At("RETURN"))
    private void tensuraKubeJS$afterPressed(LivingEntity entity, int keyNumber, int mode, CallbackInfo callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override != null) {
            tensuraKubeJS$applyPressedCooldown(override, mode);
        }
    }

    @Inject(method = "onHeld", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onHeld(LivingEntity entity, int heldTicks, int mode, CallbackInfoReturnable<Boolean> callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override == null) {
            return;
        }
        Boolean result = SkillOverrideRegistry.test(override.onHeld, context(entity, 0, mode, heldTicks, 0D));
        if (result != null) {
            callback.setReturnValue(result);
        }
    }

    @Inject(method = "onRelease", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onRelease(LivingEntity entity, int heldTicks, int keyNumber, int mode, CallbackInfo callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override != null && SkillOverrideRegistry.run(override.onRelease, context(entity, keyNumber, mode, heldTicks, 0D))) {
            callback.cancel();
        }
    }

    @Inject(method = "onScroll", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onScroll(LivingEntity entity, double delta, int mode, CallbackInfo callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override != null && SkillOverrideRegistry.run(override.onScroll, context(entity, 0, mode, 0, delta))) {
            callback.cancel();
        }
    }

    @Inject(method = "onLearnSkill", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onLearn(LivingEntity entity, CallbackInfo callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override != null && SkillOverrideRegistry.run(override.onLearn, context(entity, 0, 0, 0, 0D))) {
            callback.cancel();
        }
    }

    @Inject(method = "onForgetSkill", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onForget(LivingEntity entity, CallbackInfo callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override != null && SkillOverrideRegistry.run(override.onForget, context(entity, 0, 0, 0, 0D))) {
            callback.cancel();
        }
    }

    @Inject(method = "onSkillMastered", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onMastered(LivingEntity entity, CallbackInfo callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override != null && SkillOverrideRegistry.run(override.onMastered, context(entity, 0, 0, 0, 0D))) {
            callback.cancel();
        }
    }

    @Inject(method = "onBeingDamaged", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onBeingDamaged(LivingEntity entity, DamageSource source, float amount, CallbackInfoReturnable<Boolean> callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override == null) {
            return;
        }
        SkillDamageContext context = new SkillDamageContext(tensuraKubeJS$self(), entity, entity, source, Changeable.of(amount));
        Boolean result = SkillOverrideRegistry.test(override.onBeingDamaged, context);
        if (result != null) {
            callback.setReturnValue(result);
        }
    }

    @Inject(method = "onDamageEntity", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onDamageEntity(LivingEntity owner, LivingEntity target, DamageSource source, Changeable<Float> amount, CallbackInfoReturnable<Boolean> callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override == null) {
            return;
        }
        Boolean result = SkillOverrideRegistry.test(override.onDamageEntity,
                new SkillDamageContext(tensuraKubeJS$self(), owner, target, source, amount));
        if (result != null) {
            callback.setReturnValue(result);
        }
    }

    @Inject(method = "onTakenDamage", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onTakenDamage(LivingEntity owner, DamageSource source, Changeable<Float> amount, CallbackInfoReturnable<Boolean> callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override == null) {
            return;
        }
        Boolean result = SkillOverrideRegistry.test(override.onTakenDamage,
                new SkillDamageContext(tensuraKubeJS$self(), owner, owner, source, amount));
        if (result != null) {
            callback.setReturnValue(result);
        }
    }

    @Inject(method = "onDeath", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$onDeath(LivingEntity owner, DamageSource source, CallbackInfoReturnable<Boolean> callback) {
        SkillOverrideBuilder override = tensuraKubeJS$override();
        if (override == null) {
            return;
        }
        Boolean result = SkillOverrideRegistry.test(override.onDeath, context(owner, 0, 0, 0, 0D));
        if (result != null) {
            callback.setReturnValue(result);
        }
    }

    private SkillContext context(LivingEntity entity, int keyNumber, int mode, int heldTicks, double delta) {
        return new SkillContext(tensuraKubeJS$self(), entity, keyNumber, mode, heldTicks, delta);
    }

    private void tensuraKubeJS$applyPressedCooldown(SkillOverrideBuilder override, int mode) {
        Integer cooldown = override.getConfiguredCooldown(mode);
        if (cooldown != null) {
            tensuraKubeJS$self().setCoolDown(cooldown, mode);
        }
    }

    private <T> void setBooleanResult(com.tensura_kubejs.kubejs.callback.BooleanCallback<T> function, T context,
                                      CallbackInfoReturnable<Boolean> callback) {
        Boolean result = SkillOverrideRegistry.test(function, context);
        if (result != null) {
            callback.setReturnValue(result);
        }
    }
}
