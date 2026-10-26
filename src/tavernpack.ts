import { DEFAULT_RULESET } from "./rulesets";
import type { CampaignDocument, CharacterSheet, ChatMessage, MonsterSheet, PlayerNote, SharedInventoryItem, TavernPack, TurnState } from "./types";

export function createTavernPack(data: { characters: CharacterSheet[]; monsters: MonsterSheet[]; campaigns: CampaignDocument[]; sharedInventory: SharedInventoryItem[]; notes?: PlayerNote[]; session?: { messages: ChatMessage[]; turnState: TurnState } }): TavernPack {
  return {
    $schema: "https://tavernexplorer.vercel.app/tavernpack.schema.json",
    format: "tavernpack",
    formatVersion: "1.0.0",
    exportedAt: new Date().toISOString(),
    rulesets: [{ id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }],
    data: structuredClone(data),
  };
}

export function parseTavernPack(value: unknown): TavernPack {
  if (!value || typeof value !== "object") throw new Error("TavernPack non valido");
  const pack = value as Partial<TavernPack>;
  if (pack.format !== "tavernpack" || pack.formatVersion !== "1.0.0" || !pack.data) throw new Error("Formato TavernPack non supportato");
  return pack as TavernPack;
}
