import OBR, { buildImageUpload, buildSceneUpload, buildText } from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, INVENTORY_META_KEY, MESSAGE_CHANNEL, PARTY_META_KEY, PERMISSIONS_META_KEY, ROLL_LABEL_META_KEY, SHEETS_META_KEY, TOKEN_META_KEY, TURN_META_KEY } from "./constants";
import type { CharacterSheet, ChatMessage, PartyCharacterSummary, PermissionSettings, SharedInventoryItem, SharedSheet, TurnEntry, TurnState } from "./types";

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

// Token di riserva: iniziali del mostro su disco colorato, cosi' ogni import produce comunque un token.
function fallbackTokenFile(name: string): File {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "?";
  let hash = 0; for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="72" fill="hsl(${hash % 360},55%,32%)" stroke="#0b0b0d" stroke-width="6"/><text x="75" y="75" fill="#f5f5f4" font-family="Georgia,serif" font-size="58" font-weight="bold" text-anchor="middle" dominant-baseline="central">${initials.replace(/[<>&]/g, "")}</text></svg>`;
  return new File([svg], `${name}.svg`, { type: "image/svg+xml" });
}

export async function uploadMonsterTokens(monsters: Array<{ name: string; source: string; image?: string }>): Promise<number> {
  if (!OBR.isAvailable) return 0; let uploaded = 0;
  for (let offset = 0; offset < monsters.length; offset += 20) {
    const batch = monsters.slice(offset, offset + 20); const assets = [];
    for (const monster of batch) {
      let file: File | null = null;
      if (monster.image) {
        try { const response = await fetch(monster.image); if (response.ok) { const blob = await response.blob(); file = new File([blob], `${monster.name}.webp`, { type: blob.type || "image/webp" }); } }
        catch { /* Un token mancante non deve annullare l'intero manuale. */ }
      }
      if (!file) file = fallbackTokenFile(monster.name);
      assets.push(buildImageUpload(file).name(`beasts/${monster.name}`).description(`beasts · ${monster.source} · TavernExplorer`).build());
    }
    if (assets.length) { await OBR.assets.uploadImages(assets, "CHARACTER"); uploaded += assets.length; }
  }
  return uploaded;
}

// Collega il token selezionato a una scheda: il DM sceglie chi e' chi sulla mappa.
export async function assignCharacterToSelectedToken(characterId: string | null): Promise<string> {
  if (!OBR.isAvailable) throw new Error("Apri TavernExplorer dentro Owlbear Rodeo");
  const selected = await OBR.player.getSelection();
  const tokenId = selected?.[0];
  if (!tokenId) throw new Error("Seleziona prima un token sulla mappa");
  let tokenName = "token";
  await OBR.scene.items.updateItems([tokenId], (items) => {
    for (const item of items) {
      tokenName = item.name || tokenName;
      if (characterId) item.metadata[TOKEN_META_KEY] = { characterId };
      else delete item.metadata[TOKEN_META_KEY];
    }
  });
  return tokenName;
}

export async function getTokenAssignments(): Promise<Array<{ tokenId: string; tokenName: string; characterId: string }>> {
  if (!OBR.isAvailable || !(await OBR.scene.isReady())) return [];
  return (await OBR.scene.items.getItems()).flatMap((item) => {
    const characterId = (item.metadata[TOKEN_META_KEY] as { characterId?: string } | undefined)?.characterId;
    return characterId ? [{ tokenId: item.id, tokenName: item.name || "Token", characterId }] : [];
  });
}

// Riassegna il proprietario di una scheda condivisa. Il nuovo owner potra' modificarla.
export async function assignSheetToPlayer(sheetId: string, ownerId: string, ownerName: string): Promise<void> {
  if (!OBR.isAvailable) return;
  const existing = await getSharedSheets();
  const next = existing.map((entry) => entry.sheet.id === sheetId ? { ...entry, ownerId, ownerName, editors: entry.editors.filter((id) => id !== ownerId), updatedAt: Date.now() } : entry);
  await OBR.room.setMetadata({ [SHEETS_META_KEY]: next });
}

// Mostra il risultato sulla mappa attaccato al token del personaggio; sparisce da solo.
export async function showRollOnMap(characterId: string, label: string, total: number): Promise<void> {
  if (!OBR.isAvailable || !(await OBR.scene.isReady())) return;
  const items = await OBR.scene.items.getItems();
  const token = items.find((item) => (item.metadata[TOKEN_META_KEY] as { characterId?: string } | undefined)?.characterId === characterId);
  if (!token) return;
  const text = buildText().plainText(`${label}: ${total}`).attachedTo(token.id).position({ x: token.position.x, y: token.position.y - 60 })
    .fontSize(28).fontWeight(700).strokeColor("#000000").strokeWidth(2).fillOpacity(1).disableHit(true).locked(true).layer("TEXT")
    .metadata({ [ROLL_LABEL_META_KEY]: true }).build();
  await OBR.scene.items.addItems([text]);
  setTimeout(() => { void OBR.scene.items.deleteItems([text.id]).catch(() => undefined); }, 6000);
}

export async function openFloatingPanel(view: "messages" | "turns", position?: { left: number; top: number }): Promise<void> {
  if (!OBR.isAvailable) return;
  const saved = localStorage.getItem(`${EXTENSION_ID}/${view}-position`); const fallback = saved ? JSON.parse(saved) as { left: number; top: number } : { left: 24, top: 100 }; const anchorPosition = position ?? fallback;
  localStorage.setItem(`${EXTENSION_ID}/${view}-position`, JSON.stringify(anchorPosition));
  await OBR.popover.open({ id: `${EXTENSION_ID}/${view}-panel`, url: `/?view=${view}&left=${anchorPosition.left}&top=${anchorPosition.top}`, width: view === "messages" ? 400 : 340, height: view === "messages" ? 620 : 500, anchorReference: "POSITION", anchorPosition, anchorOrigin: { horizontal: "LEFT", vertical: "TOP" }, transformOrigin: { horizontal: "LEFT", vertical: "TOP" }, disableClickAway: true });
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

function readSheets(metadata: Record<string, unknown>): SharedSheet[] {
  const value = metadata[SHEETS_META_KEY];
  return Array.isArray(value) ? value as unknown as SharedSheet[] : [];
}

// ponytail: controllo lato UI. I metadata della stanza sono scrivibili da ogni
// client e l'SDK non offre ACL per chiave: impedisce le modifiche accidentali,
// non un client ostile. Serve un backend se un giorno conta davvero.
export function canEditSheet(entry: SharedSheet, playerId: string, role: "GM" | "PLAYER"): boolean {
  return role === "GM" || entry.ownerId === playerId || entry.editors.includes(playerId);
}

export async function getSharedSheets(): Promise<SharedSheet[]> {
  if (!OBR.isAvailable) return [];
  return readSheets(await OBR.room.getMetadata());
}

export function onSharedSheetsChange(callback: (sheets: SharedSheet[]) => void): () => void {
  if (!OBR.isAvailable) return () => undefined;
  return OBR.room.onMetadataChange((metadata) => callback(readSheets(metadata)));
}

// Pubblica le schede possedute da questo giocatore lasciando intatte quelle altrui.
export async function publishSharedSheets(sheets: CharacterSheet[]): Promise<void> {
  if (!OBR.isAvailable) return;
  const ownerId = await OBR.player.getId(); const ownerName = await OBR.player.getName();
  const existing = await getSharedSheets();
  const mine = new Map(existing.filter((entry) => entry.ownerId === ownerId).map((entry) => [entry.sheet.id, entry]));
  // Una scheda riassegnata dal DM a un altro giocatore non deve tornare indietro alla prossima pubblicazione.
  const reassigned = new Set(existing.filter((entry) => entry.ownerId !== ownerId).map((entry) => entry.sheet.id));
  const next = [
    ...existing.filter((entry) => entry.ownerId !== ownerId),
    ...sheets.filter((sheet) => !reassigned.has(sheet.id)).map((sheet) => ({ sheet, ownerId, ownerName, editors: mine.get(sheet.id)?.editors ?? [], updatedAt: Date.now() })),
  ];
  await OBR.room.setMetadata({ [SHEETS_META_KEY]: next });
}

// Scrive la scheda di chiunque, previo controllo dei permessi lato chiamante.
export async function updateSharedSheet(sheetId: string, sheet: CharacterSheet): Promise<void> {
  if (!OBR.isAvailable) return;
  const existing = await getSharedSheets();
  const next = existing.map((entry) => entry.sheet.id === sheetId ? { ...entry, sheet, updatedAt: Date.now() } : entry);
  await OBR.room.setMetadata({ [SHEETS_META_KEY]: next });
}

export async function setSheetEditors(sheetId: string, editors: string[]): Promise<void> {
  if (!OBR.isAvailable) return;
  const existing = await getSharedSheets();
  const next = existing.map((entry) => entry.sheet.id === sheetId ? { ...entry, editors, updatedAt: Date.now() } : entry);
  await OBR.room.setMetadata({ [SHEETS_META_KEY]: next });
}

export async function getPartyMembers(): Promise<Array<{ id: string; name: string; role: "GM" | "PLAYER" }>> {
  if (!OBR.isAvailable) return [];
  return (await OBR.party.getPlayers()).map((member) => ({ id: member.id, name: member.name, role: member.role }));
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
