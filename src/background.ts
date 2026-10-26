import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, PERMISSIONS_META_KEY, TURN_META_KEY } from "./constants";
import { replaceTurnEntries } from "./turns";
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
      const permissions = roomMeta[PERMISSIONS_META_KEY] as { playersManageTurns?: boolean } | undefined;
      if (await OBR.player.getRole() !== "GM" && !permissions?.playersManageTurns) {
        await OBR.notification.show("Il GM gestisce l'ordine dei turni", "WARNING");
        return;
      }
      const current = (roomMeta[TURN_META_KEY] as unknown as TurnState | undefined) ?? { round: 1, activeIndex: 0, entries: [] };
      const ids = new Set(context.items.map((item) => item.id));
      const alreadyPresent = context.items.every((item) => current.entries.some((entry) => entry.tokenId === item.id));
      const entries = alreadyPresent ? current.entries.filter((entry) => !ids.has(entry.tokenId ?? "")) : [...current.entries];
      if (!alreadyPresent) {
        const playerMeta = await OBR.player.getMetadata();
        const characterId = playerMeta[`${EXTENSION_ID}/active-character`] as string | undefined;
        for (const item of context.items) {
          if (entries.some((entry) => entry.tokenId === item.id)) continue;
          const initiativeText = window.prompt(`Iniziativa per ${item.name}`, "0");
          if (initiativeText === null) continue;
          entries.push({ id: crypto.randomUUID(), tokenId: item.id, characterId, name: item.name || "Senza nome", initiative: Number(initiativeText) || 0 });
        }
      }
      await OBR.room.setMetadata({ [TURN_META_KEY]: replaceTurnEntries(current, entries) });
    },
  });
});
