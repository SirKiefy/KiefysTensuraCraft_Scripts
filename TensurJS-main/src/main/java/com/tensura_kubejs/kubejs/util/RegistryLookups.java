package com.tensura_kubejs.kubejs.util;

import io.github.manasmods.manascore.race.api.ManasRace;
import io.github.manasmods.manascore.race.api.RaceAPI;
import io.github.manasmods.manascore.skill.api.ManasSkill;
import io.github.manasmods.manascore.skill.api.SkillAPI;
import net.minecraft.core.Holder;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.ai.attributes.Attribute;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;

public final class RegistryLookups {
    private RegistryLookups() {
    }

    public static ResourceLocation id(String value) {
        return ResourceLocation.parse(value);
    }

    public static ResourceLocation relativeId(ResourceLocation owner, String value) {
        return value.indexOf(':') >= 0 ? id(value) : ResourceLocation.fromNamespaceAndPath(owner.getNamespace(), value);
    }

    public static ResourceLocation textureId(ResourceLocation owner, String value) {
        ResourceLocation texture = relativeId(owner, value);
        String path = texture.getPath();
        if (!path.startsWith("textures/")) {
            path = "textures/" + path;
        }
        if (!path.endsWith(".png")) {
            path += ".png";
        }
        return ResourceLocation.fromNamespaceAndPath(texture.getNamespace(), path);
    }

    public static Holder<Attribute> attribute(String id) {
        return BuiltInRegistries.ATTRIBUTE.getHolder(ResourceLocation.parse(id))
                .orElseThrow(() -> new IllegalArgumentException("Unknown attribute: " + id));
    }

    public static ResourceLocation modifierId(ResourceLocation owner, String value) {
        return value.indexOf(':') >= 0 ? id(value) : ResourceLocation.fromNamespaceAndPath(owner.getNamespace(), value);
    }

    public static ManasSkill skill(ResourceLocation id) {
        return SkillAPI.getSkillRegistry().get(id);
    }

    public static ManasRace race(ResourceLocation id) {
        return RaceAPI.getRaceRegistry().get(id);
    }

    public static ResourceKey<net.minecraft.world.level.Level> levelKey(String id) {
        return ResourceKey.create(net.minecraft.core.registries.Registries.DIMENSION, ResourceLocation.parse(id));
    }

    public static Block block(String id) {
        return BuiltInRegistries.BLOCK.get(ResourceLocation.parse(id));
    }

    public static Item item(String id) {
        return BuiltInRegistries.ITEM.get(ResourceLocation.parse(id));
    }
}
