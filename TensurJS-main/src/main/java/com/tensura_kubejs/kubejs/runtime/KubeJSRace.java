package com.tensura_kubejs.kubejs.runtime;

import com.mojang.datafixers.util.Pair;
import com.tensura_kubejs.TensuraKubeJS;
import com.tensura_kubejs.kubejs.builder.KubeJSRaceBuilder;
import com.tensura_kubejs.kubejs.callback.ActionCallback;
import com.tensura_kubejs.kubejs.callback.BooleanCallback;
import com.tensura_kubejs.kubejs.context.RaceContext;
import com.tensura_kubejs.kubejs.context.RaceDamageContext;
import com.tensura_kubejs.kubejs.context.RaceEvolutionContext;
import com.tensura_kubejs.kubejs.util.ReincarnationConfigHooks;
import com.tensura_kubejs.kubejs.util.RegistryLookups;
import io.github.manasmods.manascore.network.api.util.Changeable;
import io.github.manasmods.manascore.race.api.ManasRace;
import io.github.manasmods.manascore.race.api.ManasRaceInstance;
import io.github.manasmods.manascore.skill.api.ManasSkill;
import io.github.manasmods.tensura.config.race.RaceConfig;
import io.github.manasmods.tensura.race.TensuraRace;
import io.github.manasmods.tensura.race.template.DefaultRace;
import io.github.manasmods.tensura.race.template.EvolutionRequirement;
import net.minecraft.core.Holder;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.attributes.Attribute;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class KubeJSRace extends DefaultRace {
    private final KubeJSRaceBuilder builder;
    private final RaceConfig.Default defaultConfig;

    public KubeJSRace(KubeJSRaceBuilder builder) {
        super(builder.difficulty);
        this.builder = builder;
        this.defaultConfig = new KubeJSDefaultRaceConfig(builder);
        applyDefaultAttributeModifiers();
        for (Map.Entry<Holder<Attribute>, AttributeTemplate> entry : builder.attributes.entrySet()) {
            this.attributeModifiers.put(entry.getKey(), entry.getValue());
        }
        if (builder.startingRace) {
            ReincarnationConfigHooks.addStartingRace(builder.registryId, builder.randomStartingRace);
        }
    }

    @Override
    public RaceConfig.Default getDefaultConfig() {
        return defaultConfig;
    }

    @Override
    public boolean canActivateAbility(ManasRaceInstance instance, LivingEntity user) {
        return test(builder.canActivateAbility, new RaceContext(instance, user, 0), super.canActivateAbility(instance, user));
    }

    @Override
    public int getMaxHeldTime(ManasRaceInstance instance, LivingEntity entity) {
        return builder.maxHeldTime;
    }

    @Override
    public boolean canTick(ManasRaceInstance instance, LivingEntity entity) {
        return test(builder.canTick, new RaceContext(instance, entity, 0), super.canTick(instance, entity));
    }

    @Override
    public void onTick(ManasRaceInstance instance, LivingEntity living) {
        run(builder.onTick, new RaceContext(instance, living, 0));
    }

    @Override
    public void onActivateAbility(ManasRaceInstance instance, LivingEntity entity) {
        run(builder.onActivateAbility, new RaceContext(instance, entity, 0));
    }

    @Override
    public boolean onHeldAbility(ManasRaceInstance instance, LivingEntity entity, int heldTicks) {
        return test(builder.onHeldAbility, new RaceContext(instance, entity, heldTicks), super.onHeldAbility(instance, entity, heldTicks));
    }

    @Override
    public void onReleaseAbility(ManasRaceInstance instance, LivingEntity entity, int heldTicks) {
        run(builder.onReleaseAbility, new RaceContext(instance, entity, heldTicks));
    }

    @Override
    public void onRaceSet(ManasRaceInstance instance, LivingEntity living) {
        run(builder.onRaceSet, new RaceContext(instance, living, 0));
    }

    @Override
    public boolean onAttackEntity(ManasRaceInstance instance, LivingEntity owner, LivingEntity target, DamageSource source, Changeable<Float> amount) {
        return test(builder.onAttackEntity, new RaceDamageContext(instance, owner, target, source, amount), super.onAttackEntity(instance, owner, target, source, amount));
    }

    @Override
    public boolean onHurt(ManasRaceInstance instance, LivingEntity owner, DamageSource source, Changeable<Float> amount) {
        return test(builder.onHurt, new RaceDamageContext(instance, owner, owner, source, amount), super.onHurt(instance, owner, source, amount));
    }

    @Override
    public boolean onDeath(ManasRaceInstance instance, LivingEntity owner, DamageSource source) {
        return test(builder.onDeath, new RaceContext(instance, owner, 0), super.onDeath(instance, owner, source));
    }

    @Override
    public void onRespawn(ManasRaceInstance instance, ServerPlayer owner, boolean conqueredEnd) {
        run(builder.onRespawn, new RaceContext(instance, owner, 0));
    }

    @Override
    public Pair<ResourceKey<Level>, BlockState> getRespawnDimension(ManasRaceInstance instance, LivingEntity owner) {
        return Pair.of(RegistryLookups.levelKey(builder.respawnDimension), RegistryLookups.block(builder.respawnPlatformBlock).defaultBlockState());
    }

    @Override
    public List<ManasSkill> getIntrinsicSkills(ManasRaceInstance instance, LivingEntity entity) {
        List<ManasSkill> skills = new ArrayList<>();
        for (ResourceLocation id : builder.intrinsicSkills) {
            ManasSkill skill = RegistryLookups.skill(id);
            if (skill != null) skills.add(skill);
        }
        return skills;
    }

    @Override
    public List<ManasRace> getNextEvolutions(ManasRaceInstance instance, LivingEntity entity) {
        return resolveRaces(builder.nextEvolutions);
    }

    @Override
    public List<ManasRace> getPreviousEvolutions(ManasRaceInstance instance, LivingEntity entity) {
        return resolveRaces(builder.previousEvolutions);
    }

    @Override
    public @Nullable ManasRace getDefaultEvolution(ManasRaceInstance instance, LivingEntity entity) {
        return builder.defaultEvolution == null ? null : RegistryLookups.race(builder.defaultEvolution);
    }

    @Override
    public float getEvolutionProgress(ManasRaceInstance instance, LivingEntity entity, ManasRace evolution) {
        ResourceLocation id = evolution.getRegistryName();
        if (id != null && builder.constantProgress.containsKey(id)) {
            return percent(builder.constantProgress.get(id));
        }
        if (builder.evolutionProgress != null) {
            try {
                return percent(builder.evolutionProgress.get(new RaceEvolutionContext(instance, entity, evolution)));
            } catch (Throwable throwable) {
                TensuraKubeJS.LOGGER.error("Error in KubeJS race evolution progress callback", throwable);
            }
        }
        return super.getEvolutionProgress(instance, entity, evolution);
    }

    @Override
    public Map<EvolutionRequirement, Float> getEvolutionRequirements(ManasRaceInstance previous, LivingEntity entity) {
        return builder.evolutionRequirements.isEmpty() ? Map.of() : new LinkedHashMap<>(builder.evolutionRequirements);
    }

    @Override
    public void onRaceEvolution(ManasRaceInstance instance, LivingEntity living, ManasRaceInstance evolution) {
        if (evolution.getRace() instanceof TensuraRace race) {
            race.triggerEvolutionRewards(evolution, living);
        }
        run(builder.onRaceEvolution, new RaceEvolutionContext(instance, living, evolution));
    }

    private static List<ManasRace> resolveRaces(List<ResourceLocation> ids) {
        List<ManasRace> races = new ArrayList<>();
        for (ResourceLocation id : ids) {
            ManasRace race = RegistryLookups.race(id);
            if (race != null) races.add(race);
        }
        return races;
    }

    private static float percent(double value) {
        return (float) (Math.max(0D, Math.min(1D, value)) * 100.0D);
    }

    private static <T> void run(@Nullable ActionCallback<T> callback, T context) {
        if (callback == null) return;
        try {
            callback.run(context);
        } catch (Throwable throwable) {
            TensuraKubeJS.LOGGER.error("Error in KubeJS race callback", throwable);
        }
    }

    private static <T> boolean test(@Nullable BooleanCallback<T> callback, T context, boolean fallback) {
        if (callback == null) return fallback;
        try {
            return callback.test(context);
        } catch (Throwable throwable) {
            TensuraKubeJS.LOGGER.error("Error in KubeJS race callback", throwable);
            return fallback;
        }
    }

    private static final class KubeJSDefaultRaceConfig extends RaceConfig.Default {
        private final KubeJSRaceBuilder builder;

        private KubeJSDefaultRaceConfig(KubeJSRaceBuilder builder) {
            this.builder = builder;
        }

        @Override
        public double getMinAura() {
            return builder.minBaseAura;
        }

        @Override
        public double getMaxAura() {
            return builder.maxBaseAura;
        }

        @Override
        public double getMinMagicule() {
            return builder.minBaseMagicule;
        }

        @Override
        public double getMaxMagicule() {
            return builder.maxBaseMagicule;
        }

        @Override
        public double getSize() {
            return builder.size;
        }

        @Override
        public double getMaxHealth() {
            return builder.maxHealth;
        }

        @Override
        public double getMaxSpiritualHealth() {
            return builder.maxSpiritualHealth;
        }

        @Override
        public double getAttack() {
            return builder.attack;
        }

        @Override
        public double getAttackSpeed() {
            return builder.attackSpeed;
        }

        @Override
        public double getKnockbackResistance() {
            return builder.knockbackResistance;
        }

        @Override
        public double getMovementSpeed() {
            return builder.movementSpeed;
        }

        @Override
        public double getSwimSpeed() {
            return builder.swimSpeed;
        }
    }
}
