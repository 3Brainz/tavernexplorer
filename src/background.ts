import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, TOKEN_META_KEY, TURN_META_KEY } from "./constants";
import type { TurnState } from "./types";

OBR.onReady(async () => {
  await OBR.contextMenu.create({
    id: `${EXTENSION_ID}/token-menu`,
    icons: [{
      icon: "/icon.svg",
      label: "TavernExplorer: scheda / iniziativa",
      filter: { every: [{ key: "layer", value: "CHARACTER" }] },
    }],
    onClick: async (context, elementId) => {
      if (context.items.length !== 1) return;
      const token = context.items[0];
      const linked = token.metadata[TOKEN_META_KEY] as { characterId?: string } | undefined;
      const playerMeta = await OBR.player.getMetadata();
      const activeCharacterId = playerMeta[`${EXTENSION_ID}/active-character`] as string | null | undefined;
      if (!linked?.characterId && activeCharacterId) {
        await OBR.scene.items.updateItems([token.id], (items) => {
          items[0].metadata[TOKEN_META_KEY] = { characterId: activeCharacterId };
        });
      }
      await OBR.popover.open({
        id: `${EXTENSION_ID}/sheet-popover`, url: `/?token=${encodeURIComponent(token.id)}`,
        width: 480, height: 720, anchorElementId: elementId,
      });
    },
  });

  await OBR.contextMenu.create({
    id: `${EXTENSION_ID}/initiative-menu`,
    icons: [{
      icon: "/initiative.svg", label: "Aggiungi/rimuovi dal turn order",
      filter: { every: [{ key: "layer", value: "CHARACTER" }] },
    }],
    onClick: async (context) => {
      const roomMeta = await OBR.room.getMetadata();
      const current = (roomMeta[TURN_META_KEY] as unknown as TurnState | undefined) ?? { round: 1, activeIndex: 0, entries: [] };
      const ids = new Set(context.items.map((item) => item.id));
      const alreadyPresent = context.items.every((item) => current.entries.some((entry) => entry.tokenId === item.id));
      if (alreadyPresent) current.entries = current.entries.filter((entry) => !ids.has(entry.tokenId ?? ""));
      else {
        const playerMeta = await OBR.player.getMetadata();
        const characterId = playerMeta[`${EXTENSION_ID}/active-character`] as string | undefined;
        for (const item of context.items) {
          if (current.entries.some((entry) => entry.tokenId === item.id)) continue;
          const initiativeText = window.prompt(`Iniziativa per ${item.name}`, "0");
          if (initiativeText === null) continue;
          current.entries.push({ id: crypto.randomUUID(), tokenId: item.id, characterId, name: item.name || "Senza nome", initiative: Number(initiativeText) || 0 });
        }
      }
      current.entries.sort((a, b) => b.initiative - a.initiative);
      current.activeIndex = Math.min(current.activeIndex, Math.max(0, current.entries.length - 1));
      await OBR.room.setMetadata({ [TURN_META_KEY]: current });
    },
  });
});
