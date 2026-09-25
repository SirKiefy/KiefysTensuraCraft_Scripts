package com.tensura_kubejs.kubejs.util;

import com.tensura_kubejs.kubejs.override.SkillOverrideBuilder;
import com.tensura_kubejs.kubejs.override.SkillOverrideRegistry;
import io.github.manasmods.manascore.race.api.RaceAPI;
import io.github.manasmods.manascore.skill.api.SkillAPI;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;

public final class TensuraKubeJSBindings {
    public static final ResourceLocation SKILL_REGISTRY = SkillAPI.getSkillRegistryKey().location();
    public static final ResourceLocation RACE_REGISTRY = RaceAPI.getRaceRegistryKey().location();

    private TensuraKubeJSBindings() {
    }

    public static AttributeModifier.Operation operation(String name) {
        return switch (name.toLowerCase()) {
            case "add", "add_value", "addition" -> AttributeModifier.Operation.ADD_VALUE;
            case "multiply_base", "add_multiplied_base", "multiplied_base" -> AttributeModifier.Operation.ADD_MULTIPLIED_BASE;
            case "multiply_total", "add_multiplied_total", "multiplied_total" -> AttributeModifier.Operation.ADD_MULTIPLIED_TOTAL;
            default -> throw new IllegalArgumentException("Unknown attribute operation: " + name);
        };
    }

    public static SkillOverrideBuilder modifySkill(String skillId) {
        return SkillOverrideRegistry.getOrCreate(skillId);
    }

    public static boolean grantSpirit(LivingEntity entity, String element, String level) {
        return SpiritKubeJS.grant(entity, element, level);
    }

    public static String getSpiritLevel(LivingEntity entity, String element) {
        return SpiritKubeJS.getLevel(entity, element);
    }

    public static int getSpiritLevelId(LivingEntity entity, String element) {
        return SpiritKubeJS.getLevelId(entity, element);
    }

    public static boolean hasSpiritAtLeast(LivingEntity entity, String element, String level) {
        return SpiritKubeJS.hasAtLeast(entity, element, level);
    }

    public static void clearSpirits(LivingEntity entity) {
        SpiritKubeJS.clear(entity);
    }

    public static void syncSpiritRewards(LivingEntity entity) {
        SpiritKubeJS.syncRewards(entity);
    }
}
