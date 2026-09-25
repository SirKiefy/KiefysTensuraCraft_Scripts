package com.tensura_kubejs.kubejs.override;

import com.tensura_kubejs.kubejs.callback.ActionCallback;
import com.tensura_kubejs.kubejs.callback.BooleanCallback;
import com.tensura_kubejs.kubejs.context.SkillContext;
import com.tensura_kubejs.kubejs.context.SkillDamageContext;
import com.tensura_kubejs.kubejs.util.RegistryLookups;
import dev.latvian.mods.rhino.util.ReturnsSelf;
import net.minecraft.resources.ResourceLocation;

import java.util.LinkedHashMap;
import java.util.Map;

@ReturnsSelf
public final class SkillOverrideBuilder {
    public final ResourceLocation skillId;
    public ResourceLocation icon;
    public Integer defaultCooldown;
    public final Map<Integer, Integer> modeCooldowns = new LinkedHashMap<>();

    public BooleanCallback<SkillContext> canInteract;
    public BooleanCallback<SkillContext> canActivate;
    public BooleanCallback<SkillContext> canBeToggled;
    public BooleanCallback<SkillContext> canTick;
    public BooleanCallback<SkillContext> canScroll;
    public BooleanCallback<SkillContext> canIgnoreCooldown;
    public BooleanCallback<SkillContext> shouldReleaseOnInterrupt;
    public BooleanCallback<SkillContext> isMastered;

    public ActionCallback<SkillContext> onToggleOn;
    public ActionCallback<SkillContext> onToggleOff;
    public ActionCallback<SkillContext> onTick;
    public ActionCallback<SkillContext> onPressed;
    public BooleanCallback<SkillContext> onHeld;
    public ActionCallback<SkillContext> onRelease;
    public ActionCallback<SkillContext> onScroll;
    public ActionCallback<SkillContext> onLearn;
    public ActionCallback<SkillContext> onForget;
    public ActionCallback<SkillContext> onMastered;
    public BooleanCallback<SkillDamageContext> onBeingDamaged;
    public BooleanCallback<SkillDamageContext> onDamageEntity;
    public BooleanCallback<SkillDamageContext> onTakenDamage;
    public BooleanCallback<SkillContext> onDeath;

    public SkillOverrideBuilder(ResourceLocation skillId) {
        this.skillId = skillId;
    }

    public SkillOverrideBuilder icon(String icon) {
        this.icon = RegistryLookups.textureId(skillId, icon);
        return this;
    }

    public SkillOverrideBuilder cooldown(int seconds) {
        this.defaultCooldown = Math.max(0, seconds);
        return this;
    }

    public SkillOverrideBuilder cooldown(int mode, int seconds) {
        this.modeCooldowns.put(Math.max(0, mode), Math.max(0, seconds));
        return this;
    }

    public SkillOverrideBuilder canInteract(BooleanCallback<SkillContext> callback) {
        this.canInteract = callback;
        return this;
    }

    public SkillOverrideBuilder canActivate(BooleanCallback<SkillContext> callback) {
        this.canActivate = callback;
        return this;
    }

    public SkillOverrideBuilder canBeToggled(BooleanCallback<SkillContext> callback) {
        this.canBeToggled = callback;
        return this;
    }

    public SkillOverrideBuilder canTick(BooleanCallback<SkillContext> callback) {
        this.canTick = callback;
        return this;
    }

    public SkillOverrideBuilder canScroll(BooleanCallback<SkillContext> callback) {
        this.canScroll = callback;
        return this;
    }

    public SkillOverrideBuilder canIgnoreCooldown(BooleanCallback<SkillContext> callback) {
        this.canIgnoreCooldown = callback;
        return this;
    }

    public SkillOverrideBuilder shouldReleaseOnInterrupt(BooleanCallback<SkillContext> callback) {
        this.shouldReleaseOnInterrupt = callback;
        return this;
    }

    public SkillOverrideBuilder isMastered(BooleanCallback<SkillContext> callback) {
        this.isMastered = callback;
        return this;
    }

    public SkillOverrideBuilder onToggleOn(ActionCallback<SkillContext> callback) {
        this.onToggleOn = callback;
        return this;
    }

    public SkillOverrideBuilder onToggleOff(ActionCallback<SkillContext> callback) {
        this.onToggleOff = callback;
        return this;
    }

    public SkillOverrideBuilder onTick(ActionCallback<SkillContext> callback) {
        this.onTick = callback;
        return this;
    }

    public SkillOverrideBuilder onPressed(ActionCallback<SkillContext> callback) {
        this.onPressed = callback;
        return this;
    }

    public SkillOverrideBuilder onHeld(BooleanCallback<SkillContext> callback) {
        this.onHeld = callback;
        return this;
    }

    public SkillOverrideBuilder onRelease(ActionCallback<SkillContext> callback) {
        this.onRelease = callback;
        return this;
    }

    public SkillOverrideBuilder onScroll(ActionCallback<SkillContext> callback) {
        this.onScroll = callback;
        return this;
    }

    public SkillOverrideBuilder onLearn(ActionCallback<SkillContext> callback) {
        this.onLearn = callback;
        return this;
    }

    public SkillOverrideBuilder onForget(ActionCallback<SkillContext> callback) {
        this.onForget = callback;
        return this;
    }

    public SkillOverrideBuilder onMastered(ActionCallback<SkillContext> callback) {
        this.onMastered = callback;
        return this;
    }

    public SkillOverrideBuilder onBeingDamaged(BooleanCallback<SkillDamageContext> callback) {
        this.onBeingDamaged = callback;
        return this;
    }

    public SkillOverrideBuilder onDamageEntity(BooleanCallback<SkillDamageContext> callback) {
        this.onDamageEntity = callback;
        return this;
    }

    public SkillOverrideBuilder onTakenDamage(BooleanCallback<SkillDamageContext> callback) {
        this.onTakenDamage = callback;
        return this;
    }

    public SkillOverrideBuilder onDeath(BooleanCallback<SkillContext> callback) {
        this.onDeath = callback;
        return this;
    }

    public int resolveCooldown(int requested, int mode) {
        if (requested <= 0) {
            return requested;
        }
        Integer cooldown = modeCooldowns.get(mode);
        if (cooldown != null) {
            return cooldown;
        }
        return defaultCooldown == null ? requested : defaultCooldown;
    }

    public Integer getConfiguredCooldown(int mode) {
        Integer cooldown = modeCooldowns.get(mode);
        return cooldown == null ? defaultCooldown : cooldown;
    }

    public boolean hasCooldownOverride() {
        return defaultCooldown != null || !modeCooldowns.isEmpty();
    }
}
