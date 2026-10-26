import { STORAGE_CAMPAIGNS, STORAGE_CHARACTERS, STORAGE_MESSAGES, STORAGE_MONSTERS, STORAGE_NOTES, STORAGE_SHARED_INVENTORY } from "./constants";
import type { CampaignDocument, CharacterSheet, ChatMessage, MonsterSheet, PlayerNote, SharedInventoryItem } from "./types";

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  characters: {
    get: () => read<CharacterSheet[]>(STORAGE_CHARACTERS, []),
    set: (value: CharacterSheet[]) => write(STORAGE_CHARACTERS, value),
  },
  messages: {
    get: () => read<ChatMessage[]>(STORAGE_MESSAGES, []).slice(-200),
    set: (value: ChatMessage[]) => write(STORAGE_MESSAGES, value.slice(-200)),
  },
  monsters: {
    get: () => read<MonsterSheet[]>(STORAGE_MONSTERS, []),
    set: (value: MonsterSheet[]) => write(STORAGE_MONSTERS, value),
  },
  campaigns: {
    get: () => read<CampaignDocument[]>(STORAGE_CAMPAIGNS, []),
    set: (value: CampaignDocument[]) => write(STORAGE_CAMPAIGNS, value),
  },
  sharedInventory: {
    get: () => read<SharedInventoryItem[]>(STORAGE_SHARED_INVENTORY, []),
    set: (value: SharedInventoryItem[]) => write(STORAGE_SHARED_INVENTORY, value),
  },
  notes: {
    get: () => read<PlayerNote[]>(STORAGE_NOTES, []),
    set: (value: PlayerNote[]) => write(STORAGE_NOTES, value),
  },
};
