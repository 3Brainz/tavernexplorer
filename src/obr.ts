import OBR, { buildImageUpload, buildSceneUpload } from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, INVENTORY_META_KEY, MESSAGE_CHANNEL, PARTY_META_KEY, PERMISSIONS_META_KEY, TOKEN_META_KEY, TURN_META_KEY } from "./constants";
import type { CharacterSheet, ChatMessage, PartyCharacterSummary, PermissionSettings, SharedInventoryItem, TurnEntry, TurnState } from "./types";

const emptyTurns = (): TurnState => ({ round: 1, activeIndex: 0, entries: [] });
export const DEFAULT_PERMISSIONS: PermissionSettings = { playersEditInventory: true, playersImportContent: false, playersManageTurns: false };

export async function getTurnState(): Promise<TurnState> {
  if (!OBR.isAvailable) return emptyTurns();
  const metadata = await OBR.room.getMetadata();
  const value = metadata[TURN_META_KEY];
  return value && typeof value === "object" ? (value as unknown as TurnState) : emptyTurns();
}

export async function setTurnState(state: TurnState): Promise<void> {
  if (!OBR.isAvailable) return;
  await OBR.room.setMetadata({ [TURN_META_KEY]: state });
}

export function onTurnStateChange(callback: (state: TurnState) => void): () => void {
  if (!OBR.isAvailable) return () => undefined;
  return OBR.room.onMetadataChange((metadata) => {
    const value = metadata[TURN_META_KEY];
    callback(value && typeof value === "object" ? (value as unknown as TurnState) : emptyTurns());
  });
}

export async function broadcastMessage(message: ChatMessage): Promise<void> {
  if (!OBR.isAvailable || message.visibility === "self") return;
  await OBR.broadcast.sendMessage(MESSAGE_CHANNEL, message, { destination: "REMOTE" });
}

export function onBroadcastMessage(callback: (message: ChatMessage) => void): () => void {
  if (!OBR.isAvailable) return () => undefined;
  return OBR.broadcast.onMessage(MESSAGE_CHANNEL, (event) => callback(event.data as ChatMessage));
}

export async function getPlayerInfo(): Promise<{ id: string; name: string; role: "GM" | "PLAYER" }> {
  if (!OBR.isAvailable) return { id: "preview", name: "Giocatore", role: "GM" };
  return { id: await OBR.player.getId(), name: await OBR.player.getName(), role: await OBR.player.getRole() };
}

export async function setActiveCharacter(characterId: string | null): Promise<void> {
  if (!OBR.isAvailable) return;
  await OBR.player.setMetadata({ [`${EXTENSION_ID}/active-character`]: characterId });
}

export async function addSelectedTokenToTurns(characterId: string, characterName: string, initiative: number): Promise<void> {
  if (!OBR.isAvailable) throw new Error("Apri TavernExplorer dentro Owlbear Rodeo");
  const selected = await OBR.player.getSelection();
  const tokenId = selected?.[0];
  if (!tokenId) throw new Error("Seleziona prima un token");
  await OBR.scene.items.updateItems([tokenId], (items) => {
    for (const item of items) item.metadata[TOKEN_META_KEY] = { characterId };
  });
  const state = await getTurnState();
  const entry: TurnEntry = { id: crypto.randomUUID(), name: characterName, initiative, tokenId, characterId };
  state.entries = [...state.entries.filter((item) => item.tokenId !== tokenId), entry].sort((a, b) => b.initiative - a.initiative);
  state.activeIndex = Math.min(state.activeIndex, Math.max(0, state.entries.length - 1));
  await setTurnState(state);
}

export async function uploadMapAsScene(file: File, sceneName: string): Promise<void> {
  if (!OBR.isAvailable) throw new Error("Il caricamento scene è disponibile solo dentro Owlbear Rodeo");
  const copy = new File([await file.arrayBuffer()], file.name, { type: file.type });
  const image = buildImageUpload(copy).name(sceneName).build();
  const scene = buildSceneUpload().name(sceneName).baseMap(image).build();
  await OBR.assets.uploadScenes([scene]);
}

export async function uploadRemoteMapAsScene(url: string, sceneName: string): Promise<void> {
  const response = await fetch(url); if (!response.ok) throw new Error(`Download mappa fallito (${response.status})`);
  const blob = await response.blob(); const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "webp";
  await uploadMapAsScene(new File([blob], `${sceneName}.${extension}`, { type: blob.type || "image/webp" }), sceneName);
}

export async function openFloatingPanel(view: "messages" | "turns"): Promise<void> {
  if (!OBR.isAvailable) return;
  await OBR.popover.open({ id: `${EXTENSION_ID}/${view}-panel`, url: `/?view=${view}`, width: view === "messages" ? 400 : 340, height: view === "messages" ? 620 : 500, anchorReference: "POSITION", anchorPosition: { left: 24, top: 100 }, anchorOrigin: { horizontal: "LEFT", vertical: "TOP" }, transformOrigin: { horizontal: "LEFT", vertical: "TOP" }, disableClickAway: true });
}

function summarize(sheet: CharacterSheet, ownerId: string, ownerName: string): PartyCharacterSummary {
  return { id: sheet.id, ownerId, ownerName, name: sheet.name, avatar: sheet.avatar, classDisplay: sheet.identity.classDisplay, race: sheet.identity.race, level: sheet.identity.level, ruleset: sheet.ruleset, ac: sheet.combat.ac, hp: sheet.combat.hp, initiative: sheet.combat.initiative, abilities: sheet.abilities, spellSaveDc: sheet.spellcasting.saveDc, spellAttackBonus: sheet.spellcasting.attackBonus };
}
export async function publishPartyCharacters(sheets: CharacterSheet[]): Promise<void> {
  if (!OBR.isAvailable) return; const ownerId = await OBR.player.getId(); const ownerName = await OBR.player.getName();
  await OBR.player.setMetadata({ [PARTY_META_KEY]: sheets.map((sheet) => summarize(sheet, ownerId, ownerName)) });
}
export async function getPartyCharacters(): Promise<PartyCharacterSummary[]> {
  if (!OBR.isAvailable) return [];
  return (await OBR.party.getPlayers()).flatMap((member) => Array.isArray(member.metadata[PARTY_META_KEY]) ? member.metadata[PARTY_META_KEY] as unknown as PartyCharacterSummary[] : []);
}
export function onPartyCharactersChange(callback: (characters: PartyCharacterSummary[]) => void): () => void {
  if (!OBR.isAvailable) return () => undefined;
  return OBR.party.onChange((members) => callback(members.flatMap((member) => Array.isArray(member.metadata[PARTY_META_KEY]) ? member.metadata[PARTY_META_KEY] as unknown as PartyCharacterSummary[] : [])));
}

export async function getSharedInventory(): Promise<SharedInventoryItem[]> {
  if (!OBR.isAvailable) return [];
  const metadata = await OBR.room.getMetadata();
  return Array.isArray(metadata[INVENTORY_META_KEY]) ? metadata[INVENTORY_META_KEY] as unknown as SharedInventoryItem[] : [];
}

export async function setSharedInventory(items: SharedInventoryItem[]): Promise<void> {
  const size = new Blob([JSON.stringify(items)]).size;
  if (size > 12_000) throw new Error("Inventario condiviso troppo grande per i metadata Owlbear (limite prudenziale 12 KB)");
  if (OBR.isAvailable) await OBR.room.setMetadata({ [INVENTORY_META_KEY]: items });
}

export function onSharedInventoryChange(callback: (items: SharedInventoryItem[]) => void): () => void {
  if (!OBR.isAvailable) return () => undefined;
  return OBR.room.onMetadataChange((metadata) => callback(Array.isArray(metadata[INVENTORY_META_KEY]) ? metadata[INVENTORY_META_KEY] as unknown as SharedInventoryItem[] : []));
}

export async function getPermissions(): Promise<PermissionSettings> {
  if (!OBR.isAvailable) return DEFAULT_PERMISSIONS;
  const metadata = await OBR.room.getMetadata(); const value = metadata[PERMISSIONS_META_KEY];
  return value && typeof value === "object" ? { ...DEFAULT_PERMISSIONS, ...value as Partial<PermissionSettings> } : DEFAULT_PERMISSIONS;
}
export async function setPermissions(value: PermissionSettings): Promise<void> { if (OBR.isAvailable) await OBR.room.setMetadata({ [PERMISSIONS_META_KEY]: value }); }
export function onPermissionsChange(callback: (value: PermissionSettings) => void): () => void { if (!OBR.isAvailable) return () => undefined; return OBR.room.onMetadataChange((metadata) => { const value = metadata[PERMISSIONS_META_KEY]; callback(value && typeof value === "object" ? { ...DEFAULT_PERMISSIONS, ...value as Partial<PermissionSettings> } : DEFAULT_PERMISSIONS); }); }

export { OBR };
