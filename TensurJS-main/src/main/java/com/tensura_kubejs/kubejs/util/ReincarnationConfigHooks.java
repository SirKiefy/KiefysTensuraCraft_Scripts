package com.tensura_kubejs.kubejs.util;

import io.github.manasmods.manascore.config.ConfigRegistry;
import io.github.manasmods.manascore.skill.api.ManasSkill;
import io.github.manasmods.manascore.skill.api.SkillAPI;
import io.github.manasmods.tensura.config.ReincarnationConfig;
import net.minecraft.resources.ResourceLocation;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class ReincarnationConfigHooks {
    private static final Set<String> STARTING_RACE_ADDS = new LinkedHashSet<>();
    private static final Set<String> RANDOM_STARTING_RACE_ADDS = new LinkedHashSet<>();
    private static final Set<String> REINCARNATION_RACE_ADDS = new LinkedHashSet<>();
    private static final Set<String> MASTERED_REINCARNATION_RACE_ADDS = new LinkedHashSet<>();
    private static final Set<String> STARTING_SKILL_ADDS = new LinkedHashSet<>();
    private static final Set<String> SECOND_SKILL_ADDS = new LinkedHashSet<>();
    private static final Set<String> STARTING_SKILL_REMOVES = new LinkedHashSet<>();
    private static final Set<String> SECOND_SKILL_REMOVES = new LinkedHashSet<>();
    private static boolean canApplyImmediately;

    private ReincarnationConfigHooks() {
    }

    public static void addStartingRace(ResourceLocation raceId, boolean randomPool) {
        String id = raceId.toString();
        STARTING_RACE_ADDS.add(id);
        if (randomPool) {
            RANDOM_STARTING_RACE_ADDS.add(id);
        }
        applyPendingIfReady();
    }

    public static void addReincarnationRace(ResourceLocation raceId, boolean randomPool, boolean masteredPool) {
        String id = raceId.toString();
        if (masteredPool) {
            MASTERED_REINCARNATION_RACE_ADDS.add(id);
        } else {
            REINCARNATION_RACE_ADDS.add(id);
        }
        applyPendingIfReady();
    }

    public static void addStartingSkill(ResourceLocation skillId, boolean secondPool) {
        addStartingSkill(skillId, null, secondPool);
    }

    public static void addStartingSkill(ResourceLocation skillId, ManasSkill skill, boolean secondPool) {
        String id = skillId.toString();
        if (secondPool) {
            SECOND_SKILL_REMOVES.remove(id);
            SECOND_SKILL_ADDS.add(id);
        } else {
            STARTING_SKILL_REMOVES.remove(id);
            STARTING_SKILL_ADDS.add(id);
        }
        applyPendingIfReady();
    }

    public static void removeStartingSkill(ResourceLocation skillId, boolean secondPool) {
        String id = skillId.toString();
        if (secondPool) {
            SECOND_SKILL_ADDS.remove(id);
            SECOND_SKILL_REMOVES.add(id);
        } else {
            STARTING_SKILL_ADDS.remove(id);
            STARTING_SKILL_REMOVES.add(id);
        }
        applyPendingIfReady();
    }

    public static void allowConfigAccess() {
        canApplyImmediately = true;
        applyPending();
    }

    private static void applyPendingIfReady() {
        if (canApplyImmediately) {
            applyPending();
        }
    }

    private static void applyPending() {
        ReincarnationConfig config = ConfigRegistry.getConfig(ReincarnationConfig.class);
        if (config == null) {
            return;
        }

        ReincarnationConfig.Races races = config.Races;
        races.startingRaces = appendAll(races.startingRaces, STARTING_RACE_ADDS);
        races.randomRaces = appendAll(races.randomRaces, RANDOM_STARTING_RACE_ADDS);
        races.reincarnationRaces = appendAll(races.reincarnationRaces, REINCARNATION_RACE_ADDS);
        races.reincarnationRacesMastered = appendAll(races.reincarnationRacesMastered, MASTERED_REINCARNATION_RACE_ADDS);

        ReincarnationConfig.Skills skills = config.Skills;
        skills.startingSkills = removeAll(appendAll(skills.startingSkills, STARTING_SKILL_ADDS), STARTING_SKILL_REMOVES);
        skills.secondSkills = removeAll(appendAll(skills.secondSkills, SECOND_SKILL_ADDS), SECOND_SKILL_REMOVES);
        config.save();

        refreshMenuSkillCache();
    }

    private static void refreshMenuSkillCache() {
        refreshMenuSkillCache("SKILLS", STARTING_SKILL_ADDS, STARTING_SKILL_REMOVES);
        refreshMenuSkillCache("SECOND_SKILLS", SECOND_SKILL_ADDS, SECOND_SKILL_REMOVES);
    }

    @SuppressWarnings("unchecked")
    private static void refreshMenuSkillCache(String fieldName, Set<String> addIds, Set<String> removeIds) {
        try {
            Class<?> menuClass = Class.forName("io.github.manasmods.tensura.menu.ReincarnationMenu");
            Field field = menuClass.getField(fieldName);
            Object value = field.get(null);
            List<ManasSkill> original = value instanceof List<?> list ? (List<ManasSkill>) list : List.of();
            field.set(null, resolveSkills(addIds, removeIds, original));
        } catch (NoSuchFieldException ignored) {
            // Newer Tensura versions rebuild this data from config and no longer expose the cache field.
        } catch (Throwable ignored) {
            // Menu cache refresh is best-effort; the config update above is the authoritative change.
        }
    }

    private static List<ManasSkill> resolveSkills(Set<String> addIds, Set<String> removeIds, List<ManasSkill> original) {
        List<ManasSkill> copy = new ArrayList<>(original);
        for (String id : removeIds) {
            ResourceLocation skillId = ResourceLocation.tryParse(id);
            if (skillId != null) {
                copy = removeSkill(copy, skillId);
            }
        }
        for (String id : addIds) {
            ResourceLocation skillId = ResourceLocation.tryParse(id);
            if (skillId == null) {
                continue;
            }
            ManasSkill skill = SkillAPI.getSkillRegistry().get(skillId);
            if (skill != null) {
                copy = appendSkill(copy, skill);
            }
        }
        return copy;
    }

    private static List<String> appendAll(List<String> original, Set<String> ids) {
        List<String> copy = new ArrayList<>(original);
        for (String id : ids) {
            if (!copy.contains(id)) {
                copy.add(id);
            }
        }
        return copy;
    }

    private static List<String> removeAll(List<String> original, Set<String> ids) {
        List<String> copy = new ArrayList<>(original);
        copy.removeIf(ids::contains);
        return copy;
    }

    private static List<ManasSkill> appendSkill(List<ManasSkill> original, ManasSkill skill) {
        List<ManasSkill> copy = new ArrayList<>(original);
        if (!copy.contains(skill)) {
            copy.add(skill);
        }
        return copy;
    }

    private static List<ManasSkill> removeSkill(List<ManasSkill> original, ResourceLocation skillId) {
        List<ManasSkill> copy = new ArrayList<>(original);
        copy.removeIf(skill -> skillId.equals(skill.getRegistryName()));
        return copy;
    }
}
