package com.tensura_kubejs.mixin;

import com.tensura_kubejs.kubejs.override.SkillIconOverride;
import io.github.manasmods.manascore.skill.api.ManasSkill;
import net.minecraft.resources.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(value = ManasSkill.class, remap = false)
public abstract class ManasSkillIconMixin {
    @Inject(method = "getSkillIcon", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$getSkillIcon(CallbackInfoReturnable<ResourceLocation> callback) {
        ResourceLocation icon = SkillIconOverride.get((ManasSkill) (Object) this);
        if (icon != null) {
            callback.setReturnValue(icon);
        }
    }
}
