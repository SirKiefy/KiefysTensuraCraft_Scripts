package com.tensura_kubejs.kubejs.override;

import com.tensura_kubejs.TensuraKubeJS;
import com.tensura_kubejs.kubejs.callback.ActionCallback;
import com.tensura_kubejs.kubejs.callback.BooleanCallback;
import io.github.manasmods.manascore.skill.api.ManasSkillInstance;
import net.minecraft.resources.ResourceLocation;
import org.jetbrains.annotations.Nullable;

import java.util.LinkedHashMap;
import java.util.Map;

public final class SkillOverrideRegistry {
    private static final Map<ResourceLocation, SkillOverrideBuilder> OVERRIDES = new LinkedHashMap<>();

    private SkillOverrideRegistry() {
    }

    public static SkillOverrideBuilder getOrCreate(String skillId) {
        ResourceLocation id = ResourceLocation.parse(skillId);
        return OVERRIDES.computeIfAbsent(id, SkillOverrideBuilder::new);
    }

    public static @Nullable SkillOverrideBuilder get(ResourceLocation skillId) {
        return OVERRIDES.get(skillId);
    }

    public static @Nullable SkillOverrideBuilder get(ManasSkillInstance instance) {
        return get(instance.getSkillId());
    }

    public static <T> boolean run(@Nullable ActionCallback<T> callback, T context) {
        if (callback == null) {
            return false;
        }
        try {
            callback.run(context);
            return true;
        } catch (Throwable throwable) {
            TensuraKubeJS.LOGGER.error("Error in KubeJS skill override callback", throwable);
            return false;
        }
    }

    public static <T> @Nullable Boolean test(@Nullable BooleanCallback<T> callback, T context) {
        if (callback == null) {
            return null;
        }
        try {
            return callback.test(context);
        } catch (Throwable throwable) {
            TensuraKubeJS.LOGGER.error("Error in KubeJS skill override callback", throwable);
            return null;
        }
    }
}
