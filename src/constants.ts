export const EXTENSION_ID = "it.tavernexplorer";
export const TOKEN_META_KEY = `${EXTENSION_ID}/character`;
export const TURN_META_KEY = `${EXTENSION_ID}/turn-order`;
export const MESSAGE_CHANNEL = `${EXTENSION_ID}/messages`;
export const STORAGE_CHARACTERS = `${EXTENSION_ID}/characters/v1`;
export const STORAGE_MESSAGES = `${EXTENSION_ID}/messages/v1`;
export const STORAGE_MONSTERS = `${EXTENSION_ID}/monsters/v1`;
export const STORAGE_CAMPAIGNS = `${EXTENSION_ID}/campaigns/v1`;
export const STORAGE_SHARED_INVENTORY = `${EXTENSION_ID}/shared-inventory/v1`;
export const INVENTORY_META_KEY = `${EXTENSION_ID}/shared-inventory`;
export const PERMISSIONS_META_KEY = `${EXTENSION_ID}/permissions`;
export const PARTY_META_KEY = `${EXTENSION_ID}/party-characters`;

export const ABILITY_LABELS: Record<string, string> = {
  strength: "Forza",
  dexterity: "Destrezza",
  constitution: "Costituzione",
  intelligence: "Intelligenza",
  wisdom: "Saggezza",
  charisma: "Carisma",
};

export const SKILL_LABELS: Record<string, string> = {
  acrobatics: "Acrobazia",
  animal_handling: "Addestrare animali",
  arcana: "Arcano",
  athletics: "Atletica",
  deception: "Inganno",
  history: "Storia",
  insight: "Intuizione",
  intimidation: "Intimidire",
  investigation: "Indagare",
  medicine: "Medicina",
  nature: "Natura",
  perception: "Percezione",
  performance: "Intrattenere",
  persuasion: "Persuasione",
  religion: "Religione",
  sleight_of_hand: "Rapidità di mano",
  stealth: "Furtività",
  survival: "Sopravvivenza",
};
