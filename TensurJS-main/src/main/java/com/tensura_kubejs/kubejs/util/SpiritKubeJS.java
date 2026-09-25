package com.tensura_kubejs.kubejs.util;

import io.github.manasmods.tensura.ability.magic.Element;
import io.github.manasmods.tensura.ability.magic.spiritual.SpiritualMagic;
import io.github.manasmods.tensura.block.entity.PrayingPathBlockEntity;
import io.github.manasmods.tensura.storage.TensuraStorages;
import io.github.manasmods.tensura.storage.spirit.ISpiritWielder;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;

import java.util.Locale;

public final class SpiritKubeJS {
    private SpiritKubeJS() {
    }

    public static boolean grant(LivingEntity entity, String elementName, String levelName) {
        Element element = parseElement(elementName);
        SpiritualMagic.SpiritLevel level = parseLevel(levelName);
        ISpiritWielder spirit = TensuraStorages.getSpiritFrom(entity);
        if (spirit.getSpiritLevelId(element) >= level.getId()) {
            return false;
        }
        boolean granted = spirit.setSpiritLevel(element, level);
        if (granted) {
            spirit.markDirty();
            if (entity instanceof Player player) {
                PrayingPathBlockEntity.grantSpiritMagic(player, element, level);
                PrayingPathBlockEntity.grantManipulation(player, element);
            }
        }
        return granted;
    }

    public static String getLevel(LivingEntity entity, String elementName) {
        SpiritualMagic.SpiritLevel level = TensuraStorages.getSpiritFrom(entity).getSpiritLevel(parseElement(elementName));
        return level == null ? "none" : level.getSerializedName();
    }

    public static int getLevelId(LivingEntity entity, String elementName) {
        return TensuraStorages.getSpiritFrom(entity).getSpiritLevelId(parseElement(elementName));
    }

    public static boolean hasAtLeast(LivingEntity entity, String elementName, String levelName) {
        return getLevelId(entity, elementName) >= parseLevel(levelName).getId();
    }

    public static void clear(LivingEntity entity) {
        ISpiritWielder spirit = TensuraStorages.getSpiritFrom(entity);
        spirit.clearSpiritLevel();
        spirit.markDirty();
    }

    public static void syncRewards(LivingEntity entity) {
        if (!(entity instanceof Player player)) {
            return;
        }
        ISpiritWielder spirit = TensuraStorages.getSpiritFrom(entity);
        for (Element element : Element.values()) {
            SpiritualMagic.SpiritLevel level = spirit.getSpiritLevel(element);
            if (level != null) {
                PrayingPathBlockEntity.grantSpiritMagic(player, element, level);
                PrayingPathBlockEntity.grantManipulation(player, element);
            }
        }
    }

    private static Element parseElement(String name) {
        String normalized = normalize(name);
        return switch (normalized) {
            case "dark", "暗", "暗属性" -> Element.DARKNESS;
            case "earth", "土", "土属性" -> Element.EARTH;
            case "fire", "flame", "火", "火属性" -> Element.FLAME;
            case "light", "光", "光属性" -> Element.LIGHT;
            case "space", "空间", "空间属性" -> Element.SPACE;
            case "water", "水", "水属性" -> Element.WATER;
            case "wind", "风", "风属性" -> Element.WIND;
            case "holy", "神圣", "神圣属性" -> Element.HOLY;
            default -> {
                for (Element element : Element.values()) {
                    if (element.name().equalsIgnoreCase(normalized) || element.getSerializedName().equalsIgnoreCase(normalized)) {
                        yield element;
                    }
                }
                throw new IllegalArgumentException("Unknown spirit element: " + name);
            }
        };
    }

    private static SpiritualMagic.SpiritLevel parseLevel(String name) {
        String normalized = normalize(name);
        normalized = switch (normalized) {
            case "小精灵", "低级", "低级精灵" -> "lesser";
            case "middle", "中级", "中级精灵" -> "medium";
            case "大精灵", "高级", "高级精灵" -> "greater";
            case "精灵王", "精灵之王", "王级", "王级精灵" -> "lord";
            default -> normalized;
        };
        for (SpiritualMagic.SpiritLevel level : SpiritualMagic.SpiritLevel.values()) {
            if (level.name().equalsIgnoreCase(normalized) || level.getSerializedName().equalsIgnoreCase(normalized)) {
                return level;
            }
        }
        throw new IllegalArgumentException("Unknown spirit level: " + name);
    }

    private static String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
