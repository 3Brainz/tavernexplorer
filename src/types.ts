export type RollMode = "normal" | "advantage" | "disadvantage";
export type Visibility = "everyone" | "self" | "gm";
export interface PermissionSettings { playersEditInventory: boolean; playersImportContent: boolean; playersManageTurns: boolean }

export interface AbilityStat {
  score: number;
  mod: number;
  save: number;
  saveProficient: boolean;
}

export interface SkillStat {
  ability: string;
  bonus: number;
  proficient: boolean;
}

export interface ActionEntry {
  id: string;
  name: string;
  attackBonus?: number;
  damage?: string;
  damageType?: string;
  saveDc?: number;
  description?: string;
  source?: string;
}

export interface SpellEntry extends ActionEntry {
  level: number;
  prepared: boolean;
  ritual: boolean;
  concentration: boolean;
  school?: string;
}

export interface InventoryEntry {
  id: string;
  name: string;
  count: number | null;
  equipped: boolean;
  description?: string;
}

export interface TraitEntry {
  id: string;
  name: string;
  source?: string;
  description: string;
}

export interface CharacterSheet {
  schemaVersion: 1;
  id: string;
  sharing?: "private" | "party";
  sourceId?: string;
  name: string;
  avatar?: string;
  ruleset: { id: string; version: string };
  identity: {
    race: string;
    className: string;
    subclass: string;
    classDisplay: string;
    level: number;
    background: string;
    alignment: string;
    experience: string;
  };
  combat: {
    ac: number;
    hp: { current: number; max: number; temp: number };
    speed: string;
    initiative: number;
    proficiencyBonus: number;
    passivePerception: number;
    inspiration: boolean;
    hitDice: { current: number; max: number; die: string };
    deathSaves: { successes: number; failures: number };
  };
  abilities: Record<string, AbilityStat>;
  skills: Record<string, SkillStat>;
  spellcasting: {
    ability: string;
    saveDc: number;
    attackBonus: number;
    slots: Record<string, { total: number; used: number }>;
  };
  actions: ActionEntry[];
  spells: SpellEntry[];
  inventory: InventoryEntry[];
  traits: TraitEntry[];
  currency: Record<string, number>;
  biography: string;
  importWarnings: string[];
}

export interface TurnEntry {
  id: string;
  name: string;
  initiative: number;
  tokenId?: string;
  characterId?: string;
  hidden?: boolean;
}

export interface TurnState {
  round: number;
  activeIndex: number;
  entries: TurnEntry[];
}

export interface ChatMessage {
  id: string;
  kind: "text" | "roll" | "share" | "system";
  author: string;
  authorId?: string;
  characterId?: string;
  title?: string;
  body: string;
  formula?: string;
  total?: number;
  dice?: number[];
  visibility: Visibility;
  createdAt: number;
}

export interface Roll20Export {
  _meta?: { sheet?: string; version?: string };
  character?: Record<string, unknown>;
  normalized?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

export interface MonsterSheet {
  schemaVersion: 1;
  id: string;
  ruleset: { id: string; version: string };
  name: string;
  source: string;
  size: string;
  creatureType: string;
  alignment: string;
  challengeRating: string;
  ac: number;
  hp: { average: number; formula: string };
  speed: string;
  abilities: Record<string, number>;
  saves: Record<string, number>;
  skills: Record<string, number>;
  passivePerception: number;
  traits: TraitEntry[];
  actions: ActionEntry[];
  reactions: ActionEntry[];
  legendaryActions: ActionEntry[];
  image?: string;
  importWarnings: string[];
}

export interface CampaignChapter {
  id: string;
  title: string;
  body: string;
  children: CampaignChapter[];
  images: Array<{ title: string; url: string; kind: "map" | "mapPlayer" | "image" }>;
}

// Scheda condivisa nella room: visibile a tutti, scrivibile da owner, GM e delegati.
export interface SharedSheet {
  sheet: CharacterSheet;
  ownerId: string;
  ownerName: string;
  editors: string[];
  updatedAt: number;
}

export interface PartyCharacterSummary {
  id: string; ownerId: string; ownerName: string; name: string; avatar?: string;
  classDisplay: string; race: string; level: number; ruleset: { id: string; version: string };
  ac: number; hp: { current: number; max: number; temp: number }; initiative: number;
  abilities: Record<string, AbilityStat>; spellSaveDc: number; spellAttackBonus: number;
}

export interface CampaignDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  source: string;
  ruleset: { id: string; version: string };
  chapters: CampaignChapter[];
  importedAt: number;
}

export interface SharedInventoryItem {
  id: string;
  name: string;
  quantity: number;
  description: string;
  assignedTo?: string;
  updatedAt: number;
}

export interface PlayerNote {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export interface TavernPack {
  $schema: "https://tavernexplorer.vercel.app/tavernpack.schema.json";
  format: "tavernpack";
  formatVersion: "1.0.0";
  exportedAt: string;
  rulesets: Array<{ id: string; version: string }>;
  data: {
    characters: CharacterSheet[];
    monsters: MonsterSheet[];
    campaigns: CampaignDocument[];
    sharedInventory: SharedInventoryItem[];
    notes?: PlayerNote[];
    session?: { messages: ChatMessage[]; turnState: TurnState };
  };
}
