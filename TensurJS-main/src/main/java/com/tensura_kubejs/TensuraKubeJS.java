package com.tensura_kubejs;

import com.mojang.logging.LogUtils;
import com.tensura_kubejs.kubejs.util.ReincarnationConfigHooks;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.event.lifecycle.FMLLoadCompleteEvent;
import org.slf4j.Logger;

@Mod(TensuraKubeJS.MOD_ID)
public final class TensuraKubeJS {
    public static final String MOD_ID = "tensura_kubejs";
    public static final Logger LOGGER = LogUtils.getLogger();

    public TensuraKubeJS(IEventBus modEventBus) {
        modEventBus.addListener(this::onLoadComplete);
        LOGGER.info("Loaded Tensura KubeJS integration");
    }

    private void onLoadComplete(FMLLoadCompleteEvent event) {
        event.enqueueWork(ReincarnationConfigHooks::allowConfigAccess);
    }
}
