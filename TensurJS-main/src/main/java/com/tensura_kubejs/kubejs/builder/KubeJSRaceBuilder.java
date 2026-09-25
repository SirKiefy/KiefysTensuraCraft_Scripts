package com.tensura_kubejs.kubejs.builder;

import com.tensura_kubejs.kubejs.callback.ActionCallback;
import com.tensura_kubejs.kubejs.callback.BooleanCallback;
import com.tensura_kubejs.kubejs.callback.NumberCallback;
import com.tensura_kubejs.kubejs.context.RaceContext;
import com.tensura_kubejs.kubejs.context.RaceDamageContext;
import com.tensura_kubejs.kubejs.context.RaceEvolutionContext;
import com.tensura_kubejs.kubejs.runtime.KubeJSRace;
import com.tensura_kubejs.kubejs.util.RegistryLookups;
import dev.latvian.mods.kubejs.client.LangKubeEvent;
import dev.latvian.mods.kubejs.registry.BuilderBase;
import dev.latvian.mods.rhino.util.ReturnsSelf;
import io.github.manasmods.manascore.race.api.ManasRace;
import io.github.manasmods.manascore.skill.api.ManasSkill;
import io.github.manasmods.tensura.race.template.EvolutionRequirement;
import net.minecraft.core.Holder;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.ai.attributes.Attribute;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;
import net.minecraft.world.item.Item;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@ReturnsSelf
public final class KubeJSRaceBuilder extends BuilderBase<ManasRace> {
    public final ResourceLocation registryId;
    public String description;
    public ManasRace.Difficulty difficulty = ManasRace.Difficulty.EASY;
    public int maxHeldTime = 72000;
    public String respawnDimension = "minecraft:overworld";
    public String respawnPlatformBlock = "minecraft:air";
    public double minBaseAura = 0.0D;
    public double maxBaseAura = 0.0D;
    public double minBaseMagicule = 0.0D;
    public double maxBaseMagicule = 0.0D;
    public double size = 0.0D;
    public double maxHealth = 0.0D;
    public double maxSpiritualHealth = 0.0D;
    public double attack = 0.0D;
    public double attackSpeed = 0.0D;
    public double knockbackResistance = 0.0D;
    public double movementSpeed = 0.0D;
    public double swimSpeed = 0.0D;
    public boolean startingRace = false;
    public boolean randomStartingRace = false;

    public BooleanCallback<RaceContext> canActivateAbility;
    public BooleanCallback<RaceContext> canTick;
    public ActionCallback<RaceContext> onTick;
    public ActionCallback<RaceContext> onActivateAbility;
    public BooleanCallback<RaceContext> onHeldAbility;
    public ActionCallback<RaceContext> onReleaseAbility;
    public ActionCallback<RaceContext> onRaceSet;
    public BooleanCallback<RaceDamageContext> onAttackEntity;
    public BooleanCallback<RaceDamageContext> onHurt;
    public BooleanCallback<RaceContext> onDeath;
    public ActionCallback<RaceContext> onRespawn;
    public NumberCallback<RaceEvolutionContext> evolutionProgress;
    public ActionCallback<RaceEvolutionContext> onRaceEvolution;

    public final Map<Holder<Attribute>, ManasRace.AttributeTemplate> attributes = new LinkedHashMap<>();
    public final List<ResourceLocation> intrinsicSkills = new ArrayList<>();
    public final List<ResourceLocation> nextEvolutions = new ArrayList<>();
    public final List<ResourceLocation> previousEvolutions = new ArrayList<>();
    public final Map<ResourceLocation, Double> constantProgress = new LinkedHashMap<>();
    public final Map<EvolutionRequirement, Float> evolutionRequirements = new LinkedHashMap<>();
    public @Nullable ResourceLocation defaultEvolution;

    public KubeJSRaceBuilder(ResourceLocation id) {
        super(id);
        this.registryId = id;
    }

    @Override
    public ManasRace createObject() {
        return new KubeJSRace(this);
    }

    public KubeJSRaceBuilder name(String name) {
        displayName(Component.literal(name));
        return this;
    }

    public KubeJSRaceBuilder description(String description) {
        this.description = description;
        return this;
    }

    public KubeJSRaceBuilder difficulty(String difficulty) {
        this.difficulty = ManasRace.Difficulty.valueOf(difficulty.toUpperCase());
        return this;
    }

    public KubeJSRaceBuilder difficulty(ManasRace.Difficulty difficulty) {
        this.difficulty = difficulty;
        return this;
    }

    public KubeJSRaceBuilder maxHeldTime(int ticks) {
        this.maxHeldTime = Math.max(0, ticks);
        return this;
    }

    public KubeJSRaceBuilder respawn(String dimension, String platformBlock) {
        this.respawnDimension = dimension;
        this.respawnPlatformBlock = platformBlock;
        return this;
    }

    public KubeJSRaceBuilder baseAura(double min, double max) {
        this.minBaseAura = Math.max(0.0D, min);
        this.maxBaseAura = Math.max(this.minBaseAura, max);
        return this;
    }

    public KubeJSRaceBuilder baseMagicule(double min, double max) {
        this.minBaseMagicule = Math.max(0.0D, min);
        this.maxBaseMagicule = Math.max(this.minBaseMagicule, max);
        return this;
    }

    public KubeJSRaceBuilder size(double size) {
        this.size = size;
        return this;
    }

    public KubeJSRaceBuilder maxHealth(double amount) {
        this.maxHealth = amount;
        return this;
    }

    public KubeJSRaceBuilder health(double amount) {
        return maxHealth(amount);
    }

    public KubeJSRaceBuilder maxSpiritualHealth(double amount) {
        this.maxSpiritualHealth = amount;
        return this;
    }

    public KubeJSRaceBuilder spiritualHealth(double amount) {
        return maxSpiritualHealth(amount);
    }

    public KubeJSRaceBuilder attack(double amount) {
        this.attack = amount;
        return this;
    }

    public KubeJSRaceBuilder attackDamage(double amount) {
        return attack(amount);
    }

    public KubeJSRaceBuilder attackSpeed(double amount) {
        this.attackSpeed = amount;
        return this;
    }

    public KubeJSRaceBuilder knockbackResistance(double amount) {
        this.knockbackResistance = amount;
        return this;
    }

    public KubeJSRaceBuilder movementSpeed(double amount) {
        this.movementSpeed = amount;
        return this;
    }

    public KubeJSRaceBuilder speed(double amount) {
        return movementSpeed(amount);
    }

    public KubeJSRaceBuilder swimSpeed(double amount) {
        this.swimSpeed = amount;
        return this;
    }

    public KubeJSRaceBuilder startingRace() {
        return startingRace(true);
    }

    public KubeJSRaceBuilder startingRace(boolean value) {
        this.startingRace = value;
        return this;
    }

    public KubeJSRaceBuilder initialRace() {
        return startingRace(true);
    }

    public KubeJSRaceBuilder initialRace(boolean value) {
        return startingRace(value);
    }

    public KubeJSRaceBuilder randomStartingRace() {
        return randomStartingRace(true);
    }

    public KubeJSRaceBuilder randomStartingRace(boolean value) {
        this.randomStartingRace = value;
        return this;
    }

    public KubeJSRaceBuilder attribute(String attribute, String modifierId, double amount, String operation) {
        return attribute(attribute, modifierId, amount, AttributeModifier.Operation.valueOf(operation.toUpperCase()));
    }

    public KubeJSRaceBuilder attribute(String attribute, String modifierId, double amount, AttributeModifier.Operation operation) {
        attributes.put(
                RegistryLookups.attribute(attribute),
                new ManasRace.AttributeTemplate(RegistryLookups.modifierId(id, modifierId), amount, operation)
        );
        return this;
    }

    public KubeJSRaceBuilder intrinsicSkill(String skillId) {
        intrinsicSkills.add(RegistryLookups.relativeId(id, skillId));
        return this;
    }

    public KubeJSRaceBuilder nextEvolution(String raceId) {
        ResourceLocation race = RegistryLookups.relativeId(id, raceId);
        if (!nextEvolutions.contains(race)) nextEvolutions.add(race);
        return this;
    }

    public KubeJSRaceBuilder previousEvolution(String raceId) {
        ResourceLocation race = RegistryLookups.relativeId(id, raceId);
        if (!previousEvolutions.contains(race)) previousEvolutions.add(race);
        return this;
    }

    public KubeJSRaceBuilder defaultEvolution(String raceId) {
        this.defaultEvolution = RegistryLookups.relativeId(id, raceId);
        return nextEvolution(raceId);
    }

    public KubeJSRaceBuilder evolution(String raceId, double progress) {
        ResourceLocation race = RegistryLookups.relativeId(id, raceId);
        if (!nextEvolutions.contains(race)) nextEvolutions.add(race);
        constantProgress.put(race, progress);
        return this;
    }

    public KubeJSRaceBuilder evolutionProgress(NumberCallback<RaceEvolutionContext> callback) {
        this.evolutionProgress = callback;
        return this;
    }

    public KubeJSRaceBuilder epRequirement(double ep) {
        return epRequirement(ep, 100.0F);
    }

    public KubeJSRaceBuilder epRequirement(double ep, float weight) {
        return evolutionRequirement(new EvolutionRequirement.EPRequirement(ep), weight);
    }

    public KubeJSRaceBuilder itemConsumeRequirement(String itemId, int count) {
        return itemConsumeRequirement(itemId, count, 100.0F);
    }

    public KubeJSRaceBuilder itemConsumeRequirement(String itemId, int count, float weight) {
        Item item = RegistryLookups.item(itemId);
        return evolutionRequirement(new EvolutionRequirement.ItemConsumeRequirement(item, Math.max(1, count)), weight);
    }

    public KubeJSRaceBuilder itemCarryingRequirement(String itemId, int count) {
        return itemCarryingRequirement(itemId, count, 100.0F);
    }

    public KubeJSRaceBuilder itemCarryingRequirement(String itemId, int count, float weight) {
        Item item = RegistryLookups.item(itemId);
        return evolutionRequirement(new EvolutionRequirement.ItemCarryingRequirement(item, Math.max(1, count)), weight);
    }

    public KubeJSRaceBuilder skillRequirement(String skillId, boolean mastered) {
        return skillRequirement(skillId, mastered, 100.0F);
    }

    public KubeJSRaceBuilder skillRequirement(String skillId, boolean mastered, float weight) {
        ManasSkill skill = RegistryLookups.skill(RegistryLookups.relativeId(id, skillId));
        if (skill == null) {
            throw new IllegalArgumentException("Unknown skill: " + skillId);
        }
        return evolutionRequirement(new EvolutionRequirement.AbilityRequirement(skill, mastered), weight);
    }

    public KubeJSRaceBuilder evolutionRequirement(EvolutionRequirement requirement, float weight) {
        evolutionRequirements.put(requirement, Math.max(0.0F, weight));
        return this;
    }

    public KubeJSRaceBuilder canActivateAbility(BooleanCallback<RaceContext> callback) {
        this.canActivateAbility = callback;
        return this;
    }

    public KubeJSRaceBuilder canTick(boolean value) {
        this.canTick = ctx -> value;
        return this;
    }

    public KubeJSRaceBuilder canTick(BooleanCallback<RaceContext> callback) {
        this.canTick = callback;
        return this;
    }

    public KubeJSRaceBuilder onTick(ActionCallback<RaceContext> callback) {
        this.onTick = callback;
        return this;
    }

    public KubeJSRaceBuilder onActivateAbility(ActionCallback<RaceContext> callback) {
        this.onActivateAbility = callback;
        return this;
    }

    public KubeJSRaceBuilder onHeldAbility(BooleanCallback<RaceContext> callback) {
        this.onHeldAbility = callback;
        return this;
    }

    public KubeJSRaceBuilder onReleaseAbility(ActionCallback<RaceContext> callback) {
        this.onReleaseAbility = callback;
        return this;
    }

    public KubeJSRaceBuilder onRaceSet(ActionCallback<RaceContext> callback) {
        this.onRaceSet = callback;
        return this;
    }

    public KubeJSRaceBuilder onAttackEntity(BooleanCallback<RaceDamageContext> callback) {
        this.onAttackEntity = callback;
        return this;
    }

    public KubeJSRaceBuilder onHurt(BooleanCallback<RaceDamageContext> callback) {
        this.onHurt = callback;
        return this;
    }

    public KubeJSRaceBuilder onDeath(BooleanCallback<RaceContext> callback) {
        this.onDeath = callback;
        return this;
    }

    public KubeJSRaceBuilder onRespawn(ActionCallback<RaceContext> callback) {
        this.onRespawn = callback;
        return this;
    }

    public KubeJSRaceBuilder onRaceEvolution(ActionCallback<RaceEvolutionContext> callback) {
        this.onRaceEvolution = callback;
        return this;
    }

    @Override
    public void generateLang(LangKubeEvent lang) {
        String path = id.getPath().replace('/', '.');
        lang.add(id.getNamespace(), id.getNamespace() + ".race." + path,
                displayName == null ? prettify(id.getPath()) : displayName.getString());
        if (description != null && !description.isBlank()) {
            lang.add(id.getNamespace(), id.getNamespace() + ".race." + path + ".description", description);
        }
    }

    private static String prettify(String path) {
        String[] parts = path.replace('/', '_').split("_");
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (part.isEmpty()) continue;
            if (!builder.isEmpty()) builder.append(' ');
            builder.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return builder.toString();
    }
}
