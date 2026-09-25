package com.tensura_kubejs.kubejs.builder;

import com.tensura_kubejs.kubejs.callback.ActionCallback;
import com.tensura_kubejs.kubejs.callback.BooleanCallback;
import com.tensura_kubejs.kubejs.context.SkillContext;
import com.tensura_kubejs.kubejs.context.SkillDamageContext;
import com.tensura_kubejs.kubejs.runtime.KubeJSSkill;
import com.tensura_kubejs.kubejs.util.RegistryLookups;
import dev.latvian.mods.kubejs.client.LangKubeEvent;
import dev.latvian.mods.kubejs.registry.BuilderBase;
import dev.latvian.mods.rhino.util.ReturnsSelf;
import io.github.manasmods.manascore.skill.api.ManasSkill;
import io.github.manasmods.tensura.ability.skill.Skill;
import net.minecraft.core.Holder;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.ai.attributes.Attribute;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;

import java.util.LinkedHashMap;
import java.util.Map;

@ReturnsSelf
public final class KubeJSSkillBuilder extends BuilderBase<ManasSkill> {
    public final ResourceLocation registryId;
    public String description;
    public ResourceLocation icon;
    public Skill.SkillType type = Skill.SkillType.EXTRA;
    public int modes = 1;
    public int maxHeldTime = 72000;
    public int maxMastery = 100;
    public Boolean startingSkill;
    public Boolean secondStartingSkill;

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

    public final Map<Holder<Attribute>, ManasSkill.AttributeTemplate> heldAttributes = new LinkedHashMap<>();
    public final Map<Integer, String> modeIds = new LinkedHashMap<>();
    public final Map<Integer, String> modeNames = new LinkedHashMap<>();
    public final Map<Integer, String> modeDescriptions = new LinkedHashMap<>();

    public KubeJSSkillBuilder(ResourceLocation id) {
        super(id);
        this.registryId = id;
    }

    @Override
    public ManasSkill createObject() {
        return new KubeJSSkill(this);
    }

    public KubeJSSkillBuilder name(String name) {
        displayName(Component.literal(name));
        return this;
    }

    public KubeJSSkillBuilder description(String description) {
        this.description = description;
        return this;
    }

    public KubeJSSkillBuilder icon(String icon) {
        this.icon = RegistryLookups.textureId(registryId, icon);
        return this;
    }

    public KubeJSSkillBuilder type(String type) {
        this.type = parseType(type);
        return this;
    }

    public KubeJSSkillBuilder type(Skill.SkillType type) {
        this.type = type;
        return this;
    }

    public KubeJSSkillBuilder category(String type) {
        return type(type);
    }

    public KubeJSSkillBuilder modes(int modes) {
        this.modes = Math.max(1, modes);
        return this;
    }

    public KubeJSSkillBuilder modeName(int mode, String name) {
        modeNames.put(Math.max(0, mode), name);
        return this;
    }

    public KubeJSSkillBuilder modeId(int mode, String modeId) {
        modeIds.put(Math.max(0, mode), sanitizeModeId(modeId));
        return this;
    }

    public KubeJSSkillBuilder modeDescription(int mode, String description) {
        modeDescriptions.put(Math.max(0, mode), description);
        return this;
    }

    public KubeJSSkillBuilder mode(int mode, String modeId, String name) {
        return mode(mode, modeId, name, null);
    }

    public KubeJSSkillBuilder mode(int mode, String modeId, String name, String description) {
        modeId(mode, modeId);
        modeName(mode, name);
        if (description != null && !description.isBlank()) {
            modeDescription(mode, description);
        }
        return this;
    }

    public KubeJSSkillBuilder maxHeldTime(int ticks) {
        this.maxHeldTime = Math.max(0, ticks);
        return this;
    }

    public KubeJSSkillBuilder maxMastery(int mastery) {
        this.maxMastery = Math.max(0, mastery);
        return this;
    }

    public KubeJSSkillBuilder startingSkill() {
        return startingSkill(true);
    }

    public KubeJSSkillBuilder startingSkill(boolean value) {
        this.startingSkill = value;
        return this;
    }

    public KubeJSSkillBuilder reincarnationSkill() {
        return startingSkill(true);
    }

    public KubeJSSkillBuilder reincarnationSkill(boolean value) {
        return startingSkill(value);
    }

    public KubeJSSkillBuilder secondStartingSkill() {
        return secondStartingSkill(true);
    }

    public KubeJSSkillBuilder secondStartingSkill(boolean value) {
        this.secondStartingSkill = value;
        return this;
    }

    public KubeJSSkillBuilder heldAttribute(String attribute, String modifierId, double amount, String operation) {
        return heldAttribute(attribute, modifierId, amount, AttributeModifier.Operation.valueOf(operation.toUpperCase()));
    }

    public KubeJSSkillBuilder heldAttribute(String attribute, String modifierId, double amount, AttributeModifier.Operation operation) {
        heldAttributes.put(
                RegistryLookups.attribute(attribute),
                new ManasSkill.AttributeTemplate(RegistryLookups.modifierId(id, modifierId), amount, operation)
        );
        return this;
    }

    public KubeJSSkillBuilder canInteract(BooleanCallback<SkillContext> callback) {
        this.canInteract = callback;
        return this;
    }

    public KubeJSSkillBuilder canActivate(BooleanCallback<SkillContext> callback) {
        this.canActivate = callback;
        return this;
    }

    public KubeJSSkillBuilder canBeToggled(boolean value) {
        this.canBeToggled = ctx -> value;
        return this;
    }

    public KubeJSSkillBuilder canBeToggled(BooleanCallback<SkillContext> callback) {
        this.canBeToggled = callback;
        return this;
    }

    public KubeJSSkillBuilder canTick(boolean value) {
        this.canTick = ctx -> value;
        return this;
    }

    public KubeJSSkillBuilder canTick(BooleanCallback<SkillContext> callback) {
        this.canTick = callback;
        return this;
    }

    public KubeJSSkillBuilder canScroll(boolean value) {
        this.canScroll = ctx -> value;
        return this;
    }

    public KubeJSSkillBuilder canScroll(BooleanCallback<SkillContext> callback) {
        this.canScroll = callback;
        return this;
    }

    public KubeJSSkillBuilder canIgnoreCooldown(BooleanCallback<SkillContext> callback) {
        this.canIgnoreCooldown = callback;
        return this;
    }

    public KubeJSSkillBuilder shouldReleaseOnInterrupt(BooleanCallback<SkillContext> callback) {
        this.shouldReleaseOnInterrupt = callback;
        return this;
    }

    public KubeJSSkillBuilder isMastered(BooleanCallback<SkillContext> callback) {
        this.isMastered = callback;
        return this;
    }

    public KubeJSSkillBuilder onToggleOn(ActionCallback<SkillContext> callback) {
        this.onToggleOn = callback;
        return this;
    }

    public KubeJSSkillBuilder onToggleOff(ActionCallback<SkillContext> callback) {
        this.onToggleOff = callback;
        return this;
    }

    public KubeJSSkillBuilder onTick(ActionCallback<SkillContext> callback) {
        this.onTick = callback;
        return this;
    }

    public KubeJSSkillBuilder onPressed(ActionCallback<SkillContext> callback) {
        this.onPressed = callback;
        return this;
    }

    public KubeJSSkillBuilder onHeld(BooleanCallback<SkillContext> callback) {
        this.onHeld = callback;
        return this;
    }

    public KubeJSSkillBuilder onRelease(ActionCallback<SkillContext> callback) {
        this.onRelease = callback;
        return this;
    }

    public KubeJSSkillBuilder onScroll(ActionCallback<SkillContext> callback) {
        this.onScroll = callback;
        return this;
    }

    public KubeJSSkillBuilder onLearn(ActionCallback<SkillContext> callback) {
        this.onLearn = callback;
        return this;
    }

    public KubeJSSkillBuilder onForget(ActionCallback<SkillContext> callback) {
        this.onForget = callback;
        return this;
    }

    public KubeJSSkillBuilder onMastered(ActionCallback<SkillContext> callback) {
        this.onMastered = callback;
        return this;
    }

    public KubeJSSkillBuilder onBeingDamaged(BooleanCallback<SkillDamageContext> callback) {
        this.onBeingDamaged = callback;
        return this;
    }

    public KubeJSSkillBuilder onDamageEntity(BooleanCallback<SkillDamageContext> callback) {
        this.onDamageEntity = callback;
        return this;
    }

    public KubeJSSkillBuilder onTakenDamage(BooleanCallback<SkillDamageContext> callback) {
        this.onTakenDamage = callback;
        return this;
    }

    public KubeJSSkillBuilder onDeath(BooleanCallback<SkillContext> callback) {
        this.onDeath = callback;
        return this;
    }

    @Override
    public void generateLang(LangKubeEvent lang) {
        String path = id.getPath().replace('/', '.');
        lang.add(id.getNamespace(), id.getNamespace() + ".skill." + path,
                displayName == null ? prettify(id.getPath()) : displayName.getString());
        if (description != null && !description.isBlank()) {
            lang.add(id.getNamespace(), id.getNamespace() + ".skill." + path + ".description", description);
        }
        for (int mode = 0; mode < modes; mode++) {
            String modeId = getModeIdForLang(mode);
            String modeName = modeNames.get(mode);
            if (modeName != null && !modeName.isBlank()) {
                lang.add(id.getNamespace(), id.getNamespace() + ".skill.mode." + modeId, modeName);
            }
            String modeDescription = modeDescriptions.get(mode);
            if (modeDescription != null && !modeDescription.isBlank()) {
                lang.add(id.getNamespace(), id.getNamespace() + ".skill.mode." + modeId + ".description", modeDescription);
            }
        }
    }

    public String getModeIdForLang(int mode) {
        if (modes <= 1 && !modeIds.containsKey(mode)) {
            return "default";
        }
        return modeIds.getOrDefault(mode, id.getPath().replace('/', '.') + ".mode_" + mode);
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

    private static String sanitizeModeId(String modeId) {
        return modeId.trim().toLowerCase().replace('-', '_').replace(' ', '_');
    }

    private static Skill.SkillType parseType(String type) {
        String normalized = type.trim().toLowerCase().replace('-', '_').replace(' ', '_');
        if ("抗性".equals(normalized)) return Skill.SkillType.RESISTANCE;
        if ("内在".equals(normalized) || "固有".equals(normalized)) return Skill.SkillType.INTRINSIC;
        if ("普通".equals(normalized) || "通用".equals(normalized)) return Skill.SkillType.COMMON;
        if ("额外".equals(normalized)) return Skill.SkillType.EXTRA;
        if ("独特".equals(normalized) || "独有".equals(normalized)) return Skill.SkillType.UNIQUE;
        if ("究极".equals(normalized)) return Skill.SkillType.ULTIMATE;
        return switch (normalized) {
            case "resistance", "resist" -> Skill.SkillType.RESISTANCE;
            case "intrinsic", "inherent" -> Skill.SkillType.INTRINSIC;
            case "common" -> Skill.SkillType.COMMON;
            case "extra" -> Skill.SkillType.EXTRA;
            case "unique" -> Skill.SkillType.UNIQUE;
            case "ultimate" -> Skill.SkillType.ULTIMATE;
            default -> throw new IllegalArgumentException("Unknown Tensura skill type: " + type);
        };
    }
}
