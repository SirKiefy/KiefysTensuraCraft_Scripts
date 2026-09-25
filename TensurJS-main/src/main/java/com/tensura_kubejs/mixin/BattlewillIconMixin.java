package com.tensura_kubejs.mixin;

import com.tensura_kubejs.kubejs.override.SkillIconOverride;
import io.github.manasmods.tensura.ability.battlewill.Battlewill;
import net.minecraft.resources.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(value = Battlewill.class, remap = false)
public abstract class BattlewillIconMixin {
    @Inject(method = "getSkillIcon", at = @At("HEAD"), cancellable = true)
    private void tensuraKubeJS$getSkillIcon(CallbackInfoReturnable<ResourceLocation> callback) {
        ResourceLocation icon = SkillIconOverride.get((Battlewill) (Object) this);
        if (icon != null) {
            callback.setReturnValue(icon);
        }
    }
}
