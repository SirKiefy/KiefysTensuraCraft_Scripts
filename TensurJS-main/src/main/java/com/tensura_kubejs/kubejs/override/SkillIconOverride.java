package com.tensura_kubejs.kubejs.override;

import io.github.manasmods.manascore.skill.api.ManasSkill;
import net.minecraft.resources.ResourceLocation;
import org.jetbrains.annotations.Nullable;

public final class SkillIconOverride {
    private SkillIconOverride() {
    }

    public static @Nullable ResourceLocation get(ManasSkill skill) {
        ResourceLocation skillId = skill.getRegistryName();
        if (skillId == null) {
            return null;
        }
        SkillOverrideBuilder override = SkillOverrideRegistry.get(skillId);
        return override == null ? null : override.icon;
    }
}
