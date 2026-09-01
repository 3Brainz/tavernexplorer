import { useEffect, useMemo, useRef, useState } from "react";
import { ABILITY_LABELS, SKILL_LABELS } from "./constants";
import { roll, supportsRollMode } from "./dice";
import { importRoll20 } from "./importer";
import { import5eToolsCampaign, import5eToolsMonsters } from "./import5etools";
import { listAdventures, listBestiarySources, loadAdventure, loadBestiarySource, type FiveToolsAdventure, type FiveToolsSource } from "./fivetoolsApi";
import { DEFAULT_RULESET, getRuleset } from "./rulesets";
import { storage } from "./storage";
import { createTavernPack, parseTavernPack } from "./tavernpack";
import { Alert, Badge, Button, Card, Dialog, Input, Select, Spinner } from "./ui";
import {
  DEFAULT_PERMISSIONS, OBR, addSelectedTokenToTurns, broadcastMessage, getPartyCharacters, getPermissions, getPlayerInfo, getTurnState,
  getSharedInventory, assignCharacterToSelectedToken, assignSheetToPlayer, canEditSheet, getPartyMembers, getSharedSheets, getTokenAssignments, onBroadcastMessage, onPartyCharactersChange, onPermissionsChange, onSharedInventoryChange, onSharedSheetsChange, onTurnStateChange, openFloatingPanel, publishPartyCharacters, publishSharedSheets, setActiveCharacter, setPermissions, setSheetEditors, setSharedInventory, setTurnState, showRollOnMap, updateSharedSheet, uploadMapAsScene, uploadMonsterTokens, uploadRemoteMapAsScene,
} from "./obr";
import type { ActionEntry, CampaignDocument, CharacterSheet, ChatMessage, MonsterSheet, PartyCharacterSummary, PermissionSettings, Roll20Export, RollMode, SharedInventoryItem, SharedSheet, SpellEntry, TavernPack, TurnState, Visibility } from "./types";

type AppTab = "sheet" | "turns" | "messages" | "library" | "compendium" | "campaigns" | "shared" | "party" | "settings";
type SheetTab = "main" | "actions" | "spells" | "inventory" | "traits" | "bio" | "edit";
const SHEET_TAB_LABELS: Record<SheetTab, string> = { main: "Base", actions: "Azioni", spells: "Magia", inventory: "Zaino", traits: "Tratti", bio: "Bio", edit: "Modifica" };

const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const makeMessage = (partial: Partial<ChatMessage>): ChatMessage => ({
  id: crypto.randomUUID(), kind: "text", author: "Giocatore", body: "", visibility: "everyone", createdAt: Date.now(), ...partial,
});

export default function App() {
  const floatingView = new URLSearchParams(window.location.search).get("view") as "messages" | "turns" | null;
  const [characters, setCharacters] = useState<CharacterSheet[]>(storage.characters.get());
  const [activeId, setActiveId] = useState<string | null>(() => storage.characters.get()[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(storage.messages.get());
  const [monsters, setMonsters] = useState<MonsterSheet[]>(storage.monsters.get());
  const [campaigns, setCampaigns] = useState<CampaignDocument[]>(storage.campaigns.get());
  const [sharedInventory, setSharedInventoryState] = useState<SharedInventoryItem[]>(storage.sharedInventory.get());
  const [permissions, setPermissionState] = useState<PermissionSettings>(DEFAULT_PERMISSIONS);
  const [partyCharacters, setPartyCharacters] = useState<PartyCharacterSummary[]>([]);
  const [sharedSheets, setSharedSheets] = useState<SharedSheet[]>([]);
  const [partyMembers, setPartyMembers] = useState<Array<{ id: string; name: string; role: "GM" | "PLAYER" }>>([]);
  const [openPartySheetId, setOpenPartySheetId] = useState<string | null>(null);
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [turns, setTurns] = useState<TurnState>({ round: 1, activeIndex: 0, entries: [] });
  const [tab, setTab] = useState<AppTab>(floatingView === "messages" ? "messages" : floatingView === "turns" ? "turns" : characters.length ? "sheet" : "library");
  const [sheetTab, setSheetTab] = useState<SheetTab>("main");
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [visibility, setVisibility] = useState<Visibility>("everyone");
  const [player, setPlayer] = useState({ id: "preview", name: "Giocatore", role: "PLAYER" as "GM" | "PLAYER" });
  const [draft, setDraft] = useState("");
  const [rollRequest, setRollRequest] = useState<{ title: string; formula: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLInputElement>(null);
  const charactersRef = useRef(characters);
  const active = characters.find((character) => character.id === activeId) ?? null;

  const saveCharacters = (next: CharacterSheet[]) => { setCharacters(next); storage.characters.set(next); };
  const saveMessages = (next: ChatMessage[]) => { const trimmed = next.slice(-200); setMessages(trimmed); storage.messages.set(trimmed); };
  const updateActive = (update: (sheet: CharacterSheet) => CharacterSheet) => {
    if (!active) return;
    saveCharacters(characters.map((character) => character.id === active.id ? update(structuredClone(character)) : character));
  };

  useEffect(() => {
    if (!OBR.isAvailable) { setPlayer({ id: "preview", name: "Modalità anteprima", role: "GM" }); return; }
    return OBR.onReady(() => {
      getPlayerInfo().then(setPlayer);
      getTurnState().then(setTurns);
      getSharedInventory().then((items) => { if (items.length) { setSharedInventoryState(items); storage.sharedInventory.set(items); } });
      getPermissions().then(setPermissionState);
      getPartyCharacters().then(setPartyCharacters);
      getSharedSheets().then(setSharedSheets);
      getPartyMembers().then(setPartyMembers);
      publishPartyCharacters(charactersRef.current);
      publishSharedSheets(charactersRef.current);
      const stopTurns = onTurnStateChange(setTurns);
      const stopMessages = onBroadcastMessage((message) => {
        setMessages((current) => { const next = [...current.filter((item) => item.id !== message.id), message].slice(-200); storage.messages.set(next); return next; });
      });
      const stopInventory = onSharedInventoryChange((items) => { setSharedInventoryState(items); storage.sharedInventory.set(items); });
      const stopPermissions = onPermissionsChange(setPermissionState);
      const stopParty = onPartyCharactersChange(setPartyCharacters);
      const stopSheets = onSharedSheetsChange(setSharedSheets);
      const stopMembers = OBR.party.onChange((members) => setPartyMembers(members.map((member) => ({ id: member.id, name: member.name, role: member.role }))));
      return () => { stopTurns(); stopMessages(); stopInventory(); stopPermissions(); stopParty(); stopSheets(); stopMembers(); };
    });
  }, []);

  useEffect(() => { setActiveCharacter(activeId); }, [activeId]);
  useEffect(() => { charactersRef.current = characters; publishPartyCharacters(characters); publishSharedSheets(characters); }, [characters]);
  useEffect(() => { const sync = (event: StorageEvent) => { if (event.key?.includes("/messages/")) setMessages(storage.messages.get()); }; window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync); }, []);

  async function publish(message: ChatMessage) {
    saveMessages([...messages, message]);
    await broadcastMessage(message);
    if (OBR.isAvailable && message.visibility !== "self") await OBR.notification.show(message.title ? `${message.author}: ${message.title}` : message.body.slice(0, 90), "INFO");
  }

  async function executeRoll(title: string, formula: string, mode: RollMode) {
    try {
      const result = roll(formula, mode);
      await publish(makeMessage({ kind: "roll", author: active?.name ?? player.name, characterId: active?.id, title, body: `${result.formula} → ${result.total}`, formula: result.formula, total: result.total, dice: result.dice, visibility }));
      if (active && visibility === "everyone") await showRollOnMap(active.id, title, result.total);
      if (OBR.isAvailable) await openFloatingPanel("messages"); else setTab("messages");
    } catch (error) {
      if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Tiro non valido", "ERROR");
    }
  }

  function performRoll(title: string, formula: string) { if (supportsRollMode(formula)) setRollRequest({ title, formula }); else void executeRoll(title, formula, rollMode); }

  async function shareEntry(entry: ActionEntry | SpellEntry) {
    await publish(makeMessage({ kind: "share", author: active?.name ?? player.name, characterId: active?.id, title: entry.name, body: entry.description || [entry.damage && `Danno ${entry.damage}`, entry.saveDc && `CD ${entry.saveDc}`].filter(Boolean).join(" · ") || "Nessuna descrizione", visibility }));
    if (OBR.isAvailable) await openFloatingPanel("messages"); else setTab("messages");
  }

  async function importFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Roll20Export | CharacterSheet | TavernPack;
      if ("format" in parsed && parsed.format === "tavernpack") {
        const pack = parseTavernPack(parsed);
        if (!window.confirm("Importare questo TavernPack sostituendo i dati locali correnti?")) return;
        saveCharacters(pack.data.characters); setMonsters(pack.data.monsters); storage.monsters.set(pack.data.monsters);
        setCampaigns(pack.data.campaigns); storage.campaigns.set(pack.data.campaigns);
        await saveSharedInventory(pack.data.sharedInventory);
        if (pack.data.session) { saveMessages(pack.data.session.messages); await changeTurns(pack.data.session.turnState); }
        setActiveId(pack.data.characters[0]?.id ?? null); setTab("library"); return;
      }
      const sheet = "schemaVersion" in parsed ? parsed as CharacterSheet : importRoll20(parsed as Roll20Export);
      if (!sheet.ruleset) sheet.ruleset = { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version };
      saveCharacters([...characters.filter((item) => item.id !== sheet.id), sheet]);
      setActiveId(sheet.id); setTab("sheet");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Importazione fallita";
      if (OBR.isAvailable) await OBR.notification.show(message, "ERROR"); else window.alert(message);
    }
  }

  async function import5eToolsFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      if (Array.isArray(parsed.monster)) {
        const imported = import5eToolsMonsters(parsed);
        const next = [...monsters];
        for (const monster of imported) {
          const duplicate = next.findIndex((item) => item.name === monster.name && item.source === monster.source);
          if (duplicate >= 0) next[duplicate] = monster; else next.push(monster);
        }
        setMonsters(next); storage.monsters.set(next); setSelectedMonsterId(imported[0]?.id ?? null); setTab("compendium");
        if (OBR.isAvailable) { const count = await uploadMonsterTokens(imported); await OBR.notification.show(count ? `${count} token creati come CHARACTER con prefisso beasts/` : "Nessun token disponibile per questi mostri", count ? "SUCCESS" : "WARNING"); }
      } else if (Array.isArray(parsed.data)) {
        const imported = import5eToolsCampaign(parsed);
        const next = [...campaigns.filter((item) => !(item.title === imported.title && item.source === imported.source)), imported];
        setCampaigns(next); storage.campaigns.set(next); setSelectedCampaignId(imported.id); setTab("campaigns");
      } else throw new Error("JSON 5e.tools non riconosciuto: atteso `monster` oppure `data`");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Importazione 5e.tools fallita";
      if (OBR.isAvailable) await OBR.notification.show(message, "ERROR"); else window.alert(message);
    }
  }

  function exportCharacter() {
    if (!active) return;
    const blob = new Blob([JSON.stringify(active, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${active.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.tavernexplorer.json`; link.click(); URL.revokeObjectURL(link.href);
  }

  function exportPack() {
    const pack = createTavernPack({ characters, monsters, campaigns, sharedInventory, session: { messages, turnState: turns } });
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `tavernexplorer-${new Date().toISOString().slice(0, 10)}.tavernpack.json`; link.click(); URL.revokeObjectURL(link.href);
  }

  async function saveSharedInventory(items: SharedInventoryItem[]) {
    if (player.role !== "GM" && !permissions.playersEditInventory) return;
    setSharedInventoryState(items); storage.sharedInventory.set(items); await setSharedInventory(items);
  }

  async function sendText() {
    if (!draft.trim()) return;
    await publish(makeMessage({ author: active?.name ?? player.name, characterId: active?.id, body: draft.trim(), visibility }));
    setDraft("");
  }

  async function changeTurns(next: TurnState) { if (player.role !== "GM" && !permissions.playersManageTurns) return; setTurns(next); await setTurnState(next); }
  async function nextTurn() {
    if (!turns.entries.length) return;
    const wraps = turns.activeIndex >= turns.entries.length - 1;
    await changeTurns({ ...turns, activeIndex: wraps ? 0 : turns.activeIndex + 1, round: wraps ? turns.round + 1 : turns.round });
  }

  const visibleMessages = useMemo(() => messages.filter((message) => message.visibility !== "gm" || player.role === "GM" || message.author === active?.name), [messages, player.role, active?.name]);

  return <div className="app">
    {floatingView && <FloatingHandle view={floatingView}/>} 
    {!floatingView && <>
    <header className="topbar">
      <div className="brand"><img src="/icon.svg" alt=""/><div><strong>TavernExplorer</strong><small>{DEFAULT_RULESET.label}</small></div></div>
      <select value={activeId ?? ""} onChange={(event) => { setActiveId(event.target.value || null); if (event.target.value) setTab("sheet"); }}>
        <option value="">Nessuna scheda</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
      </select>
    </header>

    <nav className="app-tabs">
      <button className={tab === "sheet" ? "active" : ""} onClick={() => setTab("sheet")}>Scheda</button>
      <button className={tab === "turns" ? "active" : ""} onClick={() => setTab("turns")}>Turni <span>{turns.entries.length}</span></button>
      <button className={tab === "messages" ? "active" : ""} onClick={() => { if (OBR.isAvailable) void openFloatingPanel("messages"); else setTab("messages"); }}>Messaggi ↗</button>
      <button className={tab === "compendium" ? "active" : ""} onClick={() => setTab("compendium")}>Bestiario</button>
      <button className={tab === "campaigns" ? "active" : ""} onClick={() => setTab("campaigns")}>Avventure</button>
      <button className={tab === "shared" ? "active" : ""} onClick={() => setTab("shared")}>Inventario comune</button>
      <button className={tab === "party" ? "active" : ""} onClick={() => setTab("party")}>Party <span>{sharedSheets.length || partyCharacters.length}</span></button>
      <button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}>Libreria</button>
      {player.role === "GM" && <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Permessi</button>}
    </nav>
    </>}

    <main>
      {tab === "sheet" && (active ? <SheetView sheet={active} sheetTab={sheetTab} setSheetTab={setSheetTab} rollMode={rollMode} setRollMode={setRollMode} visibility={visibility} setVisibility={setVisibility} onRoll={performRoll} onShare={shareEntry} onUpdate={updateActive}/> : <Empty onImport={() => fileRef.current?.click()}/>)}
      {tab === "turns" && <div className="stack">{!floatingView && OBR.isAvailable && <Button variant="outline" onClick={() => void openFloatingPanel("turns")}>Apri turn order sulla mappa ↗</Button>}<TurnOrder state={turns} isGm={player.role === "GM" || permissions.playersManageTurns} onChange={changeTurns} onNext={nextTurn} active={active} onAttach={async () => { if (!active) return; await addSelectedTokenToTurns(active.id, active.name, active.combat.initiative); }}/></div>} 
      {tab === "messages" && <Messages messages={visibleMessages} draft={draft} setDraft={setDraft} visibility={visibility} setVisibility={setVisibility} onSend={sendText}/>} 
      {tab === "library" && <Library characters={characters} activeId={activeId} onSelect={(id) => { setActiveId(id); setTab("sheet"); }} onImport={() => fileRef.current?.click()} onExport={exportCharacter} onExportPack={exportPack} onDelete={(id) => { const next = characters.filter((item) => item.id !== id); saveCharacters(next); if (activeId === id) setActiveId(next[0]?.id ?? null); }}/>} 
      {tab === "compendium" && <Bestiary canManage={player.role === "GM" || permissions.playersImportContent} monsters={monsters} selectedId={selectedMonsterId} onSelect={setSelectedMonsterId} onImport={() => contentRef.current?.click()} onImported={(next) => { setMonsters(next); storage.monsters.set(next); }} onDelete={(id) => { const next = monsters.filter((item) => item.id !== id); setMonsters(next); storage.monsters.set(next); setSelectedMonsterId(null); }} onRoll={performRoll} onShare={shareEntry} onAddTurn={async (monster) => { const initiative = Math.floor((monster.abilities.dex - 10) / 2); await addSelectedTokenToTurns(monster.id, monster.name, initiative); }}/>} 
      {tab === "campaigns" && <Campaigns canManage={player.role === "GM" || permissions.playersImportContent} documents={campaigns} selectedId={selectedCampaignId} onSelect={setSelectedCampaignId} onImport={() => contentRef.current?.click()} onImported={(next) => { setCampaigns(next); storage.campaigns.set(next); }} onDelete={(id) => { const next = campaigns.filter((item) => item.id !== id); setCampaigns(next); storage.campaigns.set(next); setSelectedCampaignId(null); }} onMap={() => mapRef.current?.click()} onAdventureMap={async (image) => { try { await uploadRemoteMapAsScene(image.url, image.title); if (OBR.isAvailable) await OBR.notification.show(`${image.title} caricata nelle scene`, "SUCCESS"); } catch (error) { const message = error instanceof Error ? error.message : "Caricamento mappa fallito"; if (OBR.isAvailable) await OBR.notification.show(message, "ERROR"); else window.alert(message); } }} onShare={async (title, body) => { await publish(makeMessage({ kind: "share", author: active?.name ?? player.name, title, body, visibility })); }}/>} 
      {tab === "shared" && <SharedInventory editable={player.role === "GM" || permissions.playersEditInventory} items={sharedInventory} characters={characters} onChange={saveSharedInventory}/>} 
      {tab === "party" && <Party characters={partyCharacters} sheets={sharedSheets} members={partyMembers} player={player} openId={openPartySheetId} onOpen={setOpenPartySheetId} onRoll={performRoll} onShare={shareEntry} onUpdateShared={async (sheetId, update) => { const entry = sharedSheets.find((item) => item.sheet.id === sheetId); if (!entry) return; const next = update(structuredClone(entry.sheet)); setSharedSheets((current) => current.map((item) => item.sheet.id === sheetId ? { ...item, sheet: next } : item)); if (entry.ownerId === player.id) { saveCharacters(charactersRef.current.map((character) => character.id === sheetId ? next : character)); } else { await updateSharedSheet(sheetId, next); } }} onEditorsChange={async (sheetId, editors) => { setSharedSheets((current) => current.map((item) => item.sheet.id === sheetId ? { ...item, editors } : item)); await setSheetEditors(sheetId, editors); }} onAssignPlayer={async (sheetId, ownerId) => { const member = partyMembers.find((item) => item.id === ownerId); if (!member) return; await assignSheetToPlayer(sheetId, member.id, member.name); setSharedSheets(await getSharedSheets()); }}/>} 
      {tab === "settings" && player.role === "GM" && <Permissions value={permissions} onChange={async (next) => { setPermissionState(next); await setPermissions(next); }}/>} 
    </main>
    <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; }}/>
    <input ref={contentRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) import5eToolsFile(file); event.target.value = ""; }}/>
    <input ref={mapRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { const name = window.prompt("Nome della nuova scena", file.name.replace(/\.[^.]+$/, "")); if (name) { try { await uploadMapAsScene(file, name); } catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Caricamento fallito", "ERROR"); } } } event.target.value = ""; }}/>
    <Dialog open={Boolean(rollRequest)} title={rollRequest?.title ?? "Tiro"} description={rollRequest?.formula} onClose={() => setRollRequest(null)}><div className="roll-choice"><Button onClick={() => { if (rollRequest) void executeRoll(rollRequest.title, rollRequest.formula, "normal"); setRollRequest(null); }}>Normale</Button><Button variant="secondary" onClick={() => { if (rollRequest) void executeRoll(rollRequest.title, rollRequest.formula, "advantage"); setRollRequest(null); }}>Vantaggio</Button><Button variant="secondary" onClick={() => { if (rollRequest) void executeRoll(rollRequest.title, rollRequest.formula, "disadvantage"); setRollRequest(null); }}>Svantaggio</Button></div></Dialog>
  </div>;
}

function FloatingHandle({ view }: { view: "messages" | "turns" }) {
  const query = new URLSearchParams(window.location.search); const origin = { left: Number(query.get("left")) || 24, top: Number(query.get("top")) || 100 };
  const drag = useRef<{ x: number; y: number } | null>(null); const [offset, setOffset] = useState({ x: 0, y: 0 });
  return <div className="floating-handle" style={{ transform: `translate(${offset.x}px,${offset.y}px)` }} onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button")) return; drag.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (drag.current) setOffset({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }); }} onPointerUp={(event) => { if (!drag.current) return; event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; void openFloatingPanel(view, { left: Math.max(0, origin.left + offset.x), top: Math.max(0, origin.top + offset.y) }); }}><span>⠿ Trascina {view === "messages" ? "messaggi" : "turn order"}</span><Button variant="ghost" aria-label="Chiudi pannello" onClick={() => void OBR.popover.close(`it.tavernexplorer/${view}-panel`)}>×</Button></div>;
}

function SheetView({ sheet, sheetTab, setSheetTab, rollMode, setRollMode, visibility, setVisibility, onRoll, onShare, onUpdate }: { sheet: CharacterSheet; sheetTab: SheetTab; setSheetTab: (tab: SheetTab) => void; rollMode: RollMode; setRollMode: (mode: RollMode) => void; visibility: Visibility; setVisibility: (value: Visibility) => void; onRoll: (title: string, formula: string) => void; onShare: (entry: ActionEntry | SpellEntry) => void; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  const ruleset = getRuleset(sheet.ruleset.id);
  return <>
    <section className="hero">
      {sheet.avatar && <img src={sheet.avatar} alt="" referrerPolicy="no-referrer"/>}
      <div><h1>{sheet.name}</h1><p>{sheet.identity.classDisplay || `${sheet.identity.subclass} ${sheet.identity.className} ${sheet.identity.level}`} · {sheet.identity.race}</p><small>{ruleset.label} · schema {sheet.schemaVersion}</small></div>
    </section>
    <div className="roll-controls">
      <select value={rollMode} onChange={(event) => setRollMode(event.target.value as RollMode)}><option value="normal">Normale</option><option value="advantage">Vantaggio</option><option value="disadvantage">Svantaggio</option></select>
      <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}><option value="everyone">Tutti</option><option value="self">Solo io</option><option value="gm">GM</option></select>
    </div>
    <nav className="sheet-tabs">{(["main", "actions", "spells", "inventory", "traits", "bio", "edit"] as SheetTab[]).map((item) => <button key={item} className={sheetTab === item ? "active" : ""} onClick={() => setSheetTab(item)}>{SHEET_TAB_LABELS[item]}</button>)}</nav>
    {sheetTab === "main" && <MainSheet sheet={sheet} onRoll={onRoll} onUpdate={onUpdate}/>} 
    {sheetTab === "actions" && <EntryList entries={sheet.actions} onRoll={onRoll} onShare={onShare}/>} 
    {sheetTab === "spells" && <Spells sheet={sheet} onRoll={onRoll} onShare={onShare} onUpdate={onUpdate}/>} 
    {sheetTab === "inventory" && <Inventory sheet={sheet} onUpdate={onUpdate}/>} 
    {sheetTab === "traits" && <EntryList entries={sheet.traits.map((trait) => ({ ...trait, source: trait.source }))} onRoll={onRoll} onShare={onShare}/>} 
    {sheetTab === "bio" && <section className="paper"><h2>Biografia</h2><p className="prose">{sheet.biography || "Nessuna biografia."}</p>{sheet.importWarnings.length > 0 && <details className="warnings"><summary>{sheet.importWarnings.length} note d’importazione</summary><ul>{sheet.importWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}</section>}
    {sheetTab === "edit" && <><CharacterEditor sheet={sheet} onUpdate={onUpdate}/><DeepCharacterEditor sheet={sheet} onUpdate={onUpdate}/></>} 
  </>;
}

function CharacterEditor({ sheet, onUpdate }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  const field = (label: string, value: string | number, apply: (next: CharacterSheet, value: string) => void, type = "text") => <label><span>{label}</span><Input type={type} value={value} onChange={(event) => onUpdate((next) => { apply(next, event.target.value); return next; })}/></label>;
  return <div className="stack"><Card><h2>Identità</h2><div className="editor-grid">{field("Nome", sheet.name, (next, value) => { next.name = value; })}{field("Razza", sheet.identity.race, (next, value) => { next.identity.race = value; })}{field("Classe", sheet.identity.className, (next, value) => { next.identity.className = value; })}{field("Sottoclasse", sheet.identity.subclass, (next, value) => { next.identity.subclass = value; })}{field("Descrizione classe", sheet.identity.classDisplay, (next, value) => { next.identity.classDisplay = value; })}{field("Livello", sheet.identity.level, (next, value) => { next.identity.level = Math.max(1, Number(value) || 1); }, "number")}{field("Background", sheet.identity.background, (next, value) => { next.identity.background = value; })}{field("Allineamento", sheet.identity.alignment, (next, value) => { next.identity.alignment = value; })}</div></Card><Card><h2>Combattimento</h2><div className="editor-grid">{field("CA", sheet.combat.ac, (next, value) => { next.combat.ac = Number(value) || 0; }, "number")}{field("PF attuali", sheet.combat.hp.current, (next, value) => { next.combat.hp.current = Number(value) || 0; }, "number")}{field("PF massimi", sheet.combat.hp.max, (next, value) => { next.combat.hp.max = Number(value) || 0; }, "number")}{field("PF temporanei", sheet.combat.hp.temp, (next, value) => { next.combat.hp.temp = Number(value) || 0; }, "number")}{field("Iniziativa", sheet.combat.initiative, (next, value) => { next.combat.initiative = Number(value) || 0; }, "number")}{field("Velocità", sheet.combat.speed, (next, value) => { next.combat.speed = value; })}{field("CD incantesimi", sheet.spellcasting.saveDc, (next, value) => { next.spellcasting.saveDc = Number(value) || 0; }, "number")}{field("Attacco incantesimi", sheet.spellcasting.attackBonus, (next, value) => { next.spellcasting.attackBonus = Number(value) || 0; }, "number")}</div></Card><Card><h2>Caratteristiche</h2><div className="editor-grid">{Object.entries(sheet.abilities).map(([key, ability]) => field(ABILITY_LABELS[key] ?? key, ability.score, (next, value) => { const score = Number(value) || 0; next.abilities[key].score = score; next.abilities[key].mod = Math.floor((score - 10) / 2); }, "number"))}</div></Card><Card><h2>Biografia</h2><textarea className="ui-textarea" value={sheet.biography} onChange={(event) => onUpdate((next) => { next.biography = event.target.value; return next; })}/></Card></div>;
}

function DeepCharacterEditor({ sheet, onUpdate }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  const patchAction = (id: string, patch: Partial<ActionEntry>) => onUpdate((next) => { Object.assign(next.actions.find((entry) => entry.id === id)!, patch); return next; });
  return <div className="stack deep-editor"><Card><div className="editor-heading"><h2>Abilità e tiri salvezza</h2></div><div className="skill-editor">{Object.entries(sheet.skills).map(([key, skill]) => <div key={key}><span>{SKILL_LABELS[key] ?? key}</span><Input aria-label={`Bonus ${key}`} type="number" value={skill.bonus} onChange={(event) => onUpdate((next) => { next.skills[key].bonus = Number(event.target.value) || 0; return next; })}/><label><input type="checkbox" checked={skill.proficient} onChange={(event) => onUpdate((next) => { next.skills[key].proficient = event.target.checked; return next; })}/> Competente</label></div>)}</div><div className="save-editor">{Object.entries(sheet.abilities).map(([key, ability]) => <label key={key}><span>TS {ABILITY_LABELS[key] ?? key}</span><Input type="number" value={ability.save} onChange={(event) => onUpdate((next) => { next.abilities[key].save = Number(event.target.value) || 0; return next; })}/><input type="checkbox" checked={ability.saveProficient} onChange={(event) => onUpdate((next) => { next.abilities[key].saveProficient = event.target.checked; return next; })}/></label>)}</div></Card><Card><div className="editor-heading"><h2>Azioni e attacchi</h2><Button onClick={() => onUpdate((next) => { next.actions.push({ id: crypto.randomUUID(), name: "Nuova azione", description: "" }); return next; })}>Aggiungi</Button></div>{sheet.actions.map((entry) => <article className="editable-entry" key={entry.id}><Input value={entry.name} onChange={(event) => patchAction(entry.id, { name: event.target.value })}/><Input type="number" placeholder="Bonus attacco" value={entry.attackBonus ?? ""} onChange={(event) => patchAction(entry.id, { attackBonus: event.target.value === "" ? undefined : Number(event.target.value) })}/><Input placeholder="Danno, es. 1d8+3" value={entry.damage ?? ""} onChange={(event) => patchAction(entry.id, { damage: event.target.value })}/><textarea className="ui-textarea" value={entry.description ?? ""} onChange={(event) => patchAction(entry.id, { description: event.target.value })}/><Button variant="destructive" onClick={() => onUpdate((next) => { next.actions = next.actions.filter((item) => item.id !== entry.id); return next; })}>Elimina</Button></article>)}</Card><Card><div className="editor-heading"><h2>Incantesimi</h2><Button onClick={() => onUpdate((next) => { next.spells.push({ id: crypto.randomUUID(), name: "Nuovo incantesimo", level: 0, prepared: false, ritual: false, concentration: false, description: "" }); return next; })}>Aggiungi</Button></div>{sheet.spells.map((spell) => <article className="editable-entry" key={spell.id}><Input value={spell.name} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.name = event.target.value; return next; })}/><Input type="number" min="0" max="9" value={spell.level} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.level = Number(event.target.value) || 0; return next; })}/><div className="check-row"><label><input type="checkbox" checked={spell.prepared} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.prepared = event.target.checked; return next; })}/> Preparato</label><label><input type="checkbox" checked={spell.ritual} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.ritual = event.target.checked; return next; })}/> Rituale</label><label><input type="checkbox" checked={spell.concentration} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.concentration = event.target.checked; return next; })}/> Concentrazione</label></div><textarea className="ui-textarea" value={spell.description ?? ""} onChange={(event) => onUpdate((next) => { next.spells.find((item) => item.id === spell.id)!.description = event.target.value; return next; })}/><Button variant="destructive" onClick={() => onUpdate((next) => { next.spells = next.spells.filter((item) => item.id !== spell.id); return next; })}>Elimina</Button></article>)}</Card><Card><div className="editor-heading"><h2>Inventario personale</h2><Button onClick={() => onUpdate((next) => { next.inventory.push({ id: crypto.randomUUID(), name: "Nuovo oggetto", count: 1, equipped: false, description: "" }); return next; })}>Aggiungi</Button></div>{sheet.inventory.map((item) => <article className="editable-entry compact" key={item.id}><Input value={item.name} onChange={(event) => onUpdate((next) => { next.inventory.find((entry) => entry.id === item.id)!.name = event.target.value; return next; })}/><Input type="number" value={item.count ?? ""} onChange={(event) => onUpdate((next) => { next.inventory.find((entry) => entry.id === item.id)!.count = event.target.value === "" ? null : Number(event.target.value); return next; })}/><label><input type="checkbox" checked={item.equipped} onChange={(event) => onUpdate((next) => { next.inventory.find((entry) => entry.id === item.id)!.equipped = event.target.checked; return next; })}/> Equipaggiato</label><Button variant="destructive" onClick={() => onUpdate((next) => { next.inventory = next.inventory.filter((entry) => entry.id !== item.id); return next; })}>Elimina</Button></article>)}</Card><Card><h2>Valute</h2><div className="editor-grid">{Object.entries(sheet.currency).map(([key, value]) => <label key={key}><span>{key.toUpperCase()}</span><Input type="number" value={value} onChange={(event) => onUpdate((next) => { next.currency[key] = Number(event.target.value) || 0; return next; })}/></label>)}</div></Card></div>;
}

function MainSheet({ sheet, onRoll, onUpdate }: { sheet: CharacterSheet; onRoll: (title: string, formula: string) => void; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  return <div className="stack">
    <section className="combat-grid">
      <Metric label="CA" value={sheet.combat.ac}/><Metric label="Iniziativa" value={signed(sheet.combat.initiative)} onClick={() => onRoll("Iniziativa", `1d20${signed(sheet.combat.initiative)}`)}/><Metric label="Velocità" value={sheet.combat.speed}/><Metric label="Competenza" value={signed(sheet.combat.proficiencyBonus)}/><Metric label="Percezione passiva" value={sheet.combat.passivePerception}/><Metric label="CD incantesimi" value={sheet.spellcasting.saveDc}/>
    </section>
    <section className="paper hp"><h2>Punti ferita</h2><button onClick={() => onUpdate((next) => { next.combat.hp.current = Math.max(0, next.combat.hp.current - 1); return next; })}>−</button><strong>{sheet.combat.hp.current} / {sheet.combat.hp.max}</strong><button onClick={() => onUpdate((next) => { next.combat.hp.current = Math.min(next.combat.hp.max, next.combat.hp.current + 1); return next; })}>+</button>{sheet.combat.hp.temp > 0 && <span>Temp {sheet.combat.hp.temp}</span>}</section>
    <section className="abilities">{Object.entries(sheet.abilities).map(([key, stat]) => <article key={key}><button onClick={() => onRoll(ABILITY_LABELS[key] ?? key, `1d20${signed(stat.mod)}`)}><small>{ABILITY_LABELS[key] ?? key}</small><strong>{stat.score}</strong><span>{signed(stat.mod)}</span></button><button className={stat.saveProficient ? "proficient" : ""} onClick={() => onRoll(`TS ${ABILITY_LABELS[key] ?? key}`, `1d20${signed(stat.save)}`)}>TS {signed(stat.save)}</button></article>)}</section>
    <section className="paper"><h2>Abilità</h2><div className="skills">{Object.entries(sheet.skills).map(([key, skill]) => <button key={key} onClick={() => onRoll(SKILL_LABELS[key] ?? key, `1d20${signed(skill.bonus)}`)}><span className={skill.proficient ? "dot filled" : "dot"}/><span>{SKILL_LABELS[key] ?? key}</span><strong>{signed(skill.bonus)}</strong></button>)}</div></section>
  </div>;
}

function Metric({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) { const content = <><strong>{value}</strong><small>{label}</small></>; return onClick ? <button className="metric" onClick={onClick}>{content}</button> : <div className="metric">{content}</div>; }

function EntryList({ entries, onRoll, onShare }: { entries: ActionEntry[]; onRoll: (title: string, formula: string) => void; onShare: (entry: ActionEntry) => void }) {
  if (!entries.length) return <Empty/>;
  return <section className="entry-list">{entries.map((entry) => <details key={entry.id} className="entry"><summary><span><strong>{entry.name}</strong><small>{entry.source}</small></span><span>{entry.attackBonus != null && signed(entry.attackBonus)} {entry.damage}</span></summary><p>{entry.description || "Nessuna descrizione."}</p><div className="entry-actions">{entry.attackBonus != null && <button onClick={() => onRoll(`${entry.name} — attacco`, `1d20${signed(entry.attackBonus!)}`)}>Attacco</button>}{entry.damage && <button onClick={() => onRoll(`${entry.name} — danno`, entry.damage!)}>Danno</button>}<button onClick={() => onShare(entry)}>Mostra</button></div></details>)}</section>;
}

function Spells({ sheet, onRoll, onShare, onUpdate }: { sheet: CharacterSheet; onRoll: (title: string, formula: string) => void; onShare: (entry: ActionEntry | SpellEntry) => void; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  const levels = [...new Set(sheet.spells.map((spell) => spell.level))].sort((a, b) => a - b);
  return <div className="stack"><section className="paper spell-head"><div><strong>CD {sheet.spellcasting.saveDc}</strong><small>Salvezza</small></div><div><strong>{signed(sheet.spellcasting.attackBonus)}</strong><small>Attacco</small></div></section>{Object.entries(sheet.spellcasting.slots).map(([key, slot]) => <section className="slot" key={key}><span>{key.replace("level_", "Livello ")}</span><button onClick={() => onUpdate((next) => { next.spellcasting.slots[key].used = Math.max(0, next.spellcasting.slots[key].used - 1); return next; })}>−</button><strong>{Math.max(0, slot.total - slot.used)} / {slot.total}</strong><button onClick={() => onUpdate((next) => { next.spellcasting.slots[key].used = Math.min(slot.total, next.spellcasting.slots[key].used + 1); return next; })}>+</button></section>)}{levels.map((level) => <section key={level}><h2>{level === 0 ? "Trucchetti" : `Livello ${level}`}</h2><EntryList entries={sheet.spells.filter((spell) => spell.level === level)} onRoll={onRoll} onShare={onShare}/></section>)}</div>;
}

function Inventory({ sheet, onUpdate }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  return <div className="stack"><section className="paper currency">{Object.entries(sheet.currency).map(([key, value]) => <span key={key}><strong>{value}</strong>{key.toUpperCase()}</span>)}</section><section className="entry-list">{sheet.inventory.map((item) => <article className="inventory-row" key={item.id}><span>{item.name}</span>{item.count != null && <div><button onClick={() => onUpdate((next) => { const found = next.inventory.find((entry) => entry.id === item.id)!; found.count = Math.max(0, (found.count ?? 0) - 1); return next; })}>−</button><strong>{item.count}</strong><button onClick={() => onUpdate((next) => { const found = next.inventory.find((entry) => entry.id === item.id)!; found.count = (found.count ?? 0) + 1; return next; })}>+</button></div>}</article>)}</section></div>;
}

function TurnOrder({ state, isGm, onChange, onNext, active, onAttach }: { state: TurnState; isGm: boolean; onChange: (state: TurnState) => void; onNext: () => void; active: CharacterSheet | null; onAttach: () => void }) {
  return <div className="stack"><section className="turn-header"><div><small>Round</small><strong>{state.round}</strong></div><button onClick={onNext} disabled={!state.entries.length}>Turno successivo →</button></section><button className="primary" onClick={onAttach} disabled={!active}>Collega scheda e token selezionato</button><section className="turn-list">{state.entries.map((entry, index) => <article className={index === state.activeIndex ? "current" : ""} key={entry.id}><span className="order">{index + 1}</span><div><strong>{entry.name}</strong>{index === state.activeIndex && <small>Turno attuale</small>}</div><input aria-label="Iniziativa" type="number" value={entry.initiative} disabled={!isGm} onChange={(event) => { const entries = state.entries.map((item) => item.id === entry.id ? { ...item, initiative: Number(event.target.value) } : item).sort((a, b) => b.initiative - a.initiative); onChange({ ...state, entries }); }}/>{isGm && <button className="danger" onClick={() => onChange({ ...state, entries: state.entries.filter((item) => item.id !== entry.id), activeIndex: 0 })}>×</button>}</article>)}</section>{isGm && state.entries.length > 0 && <button onClick={() => onChange({ round: 1, activeIndex: 0, entries: [] })}>Svuota ordine</button>}</div>;
}

function Messages({ messages, draft, setDraft, visibility, setVisibility, onSend }: { messages: ChatMessage[]; draft: string; setDraft: (value: string) => void; visibility: Visibility; setVisibility: (value: Visibility) => void; onSend: () => void }) {
  return <div className="messages"><section className="message-list">{messages.length === 0 && <Empty/>}{messages.map((message) => <article key={message.id} className={`message ${message.kind}`}><header><strong>{message.author}</strong><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {message.visibility === "everyone" ? "tutti" : message.visibility === "gm" ? "GM" : "privato"}</small></header>{message.title && <h3>{message.title}</h3>}<p>{message.body}</p>{message.kind === "roll" && <div className="roll-result"><span>{message.dice?.join(" + ")}</span><strong>{message.total}</strong></div>}</article>)}</section><section className="composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }} placeholder="Scrivi un messaggio…"/><div><select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}><option value="everyone">Tutti</option><option value="self">Solo io</option><option value="gm">GM</option></select><button className="primary" onClick={onSend}>Invia</button></div></section></div>;
}

function Library({ characters, activeId, onSelect, onImport, onExport, onExportPack, onDelete }: { characters: CharacterSheet[]; activeId: string | null; onSelect: (id: string) => void; onImport: () => void; onExport: () => void; onExportPack: () => void; onDelete: (id: string) => void }) {
  return <div className="stack"><section className="library-actions"><button className="primary" onClick={onImport}>Importa JSON / TavernPack</button><button onClick={onExport} disabled={!activeId}>Esporta scheda</button><button onClick={onExportPack}>Esporta tutto</button></section>{characters.map((character) => <article className="library-card" key={character.id}><button className="character-open" onClick={() => onSelect(character.id)}>{character.avatar && <img src={character.avatar} alt=""/>}<span><strong>{character.name}</strong><small>{character.identity.classDisplay} · {getRuleset(character.ruleset.id).label}</small></span></button><button className="danger" onClick={() => { if (window.confirm(`Eliminare ${character.name}? È consigliato esportare prima un backup.`)) onDelete(character.id); }}>×</button></article>)}{characters.length === 0 && <Empty onImport={onImport}/>}</div>;
}

function Bestiary({ monsters, selectedId, canManage, onSelect, onImport, onImported, onDelete, onRoll, onShare, onAddTurn }: { monsters: MonsterSheet[]; selectedId: string | null; canManage: boolean; onSelect: (id: string | null) => void; onImport: () => void; onImported: (items: MonsterSheet[]) => void; onDelete: (id: string) => void; onRoll: (title: string, formula: string) => void; onShare: (entry: ActionEntry) => void; onAddTurn: (monster: MonsterSheet) => void }) {
  const removeSelected = () => { const selected = monsters.find((monster) => monster.id === selectedId); if (selected && canManage && window.confirm(`Eliminare ${selected.name}?`)) onDelete(selected.id); };
  const [sources, setSources] = useState<FiveToolsSource[]>([]); const [sourceId, setSourceId] = useState(""); const [pickerOpen, setPickerOpen] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  useEffect(() => { listBestiarySources().then((rows) => { setSources(rows); setSourceId(rows.find((row) => row.id === "XMM")?.id ?? rows[0]?.id ?? ""); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Catalogo non disponibile")); }, []);
  async function remoteImport() { const source = sources.find((row) => row.id === sourceId); if (!source) return; setLoading(true); setError(""); try { const imported = await loadBestiarySource(source); const next = [...monsters]; for (const monster of imported) { const duplicate = next.findIndex((item) => item.name === monster.name && item.source === monster.source); if (duplicate >= 0) next[duplicate] = monster; else next.push(monster); } onImported(next); if (OBR.isAvailable) { const count = await uploadMonsterTokens(imported); await OBR.notification.show(`${count} token creati come CHARACTER con prefisso beasts/`, "SUCCESS"); } onSelect(imported[0]?.id ?? null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Importazione fallita"); } finally { setLoading(false); } }
  const selected = monsters.find((monster) => monster.id === selectedId);
  if (selected && canManage) return <div className="stack"><div className="library-actions"><Button variant="ghost" onClick={() => onSelect(null)}>← Bestiario</Button><Button variant="destructive" onClick={removeSelected}>Elimina mostro</Button></div><Bestiary monsters={monsters} selectedId={selectedId} canManage={false} onSelect={onSelect} onImport={onImport} onImported={onImported} onDelete={onDelete} onRoll={onRoll} onShare={onShare} onAddTurn={onAddTurn}/></div>;
  if (!selected && !canManage) return <div className="stack"><Alert>Il GM ha riservato importazione ed eliminazione dei contenuti.</Alert><section className="monster-grid">{monsters.map((monster) => <button key={monster.id} onClick={() => onSelect(monster.id)}><strong>{monster.name}</strong><small>{monster.creatureType} · GS {monster.challengeRating}</small><span>CA {monster.ac} · PF {monster.hp.average}</span></button>)}</section>{monsters.length === 0 && <Empty/>}</div>;
  if (selected) return <div className="stack"><button onClick={() => onSelect(null)}>← Bestiario</button><section className="hero">{selected.image && <img src={selected.image} alt=""/>}<div><h1>{selected.name}</h1><p>{selected.size} {selected.creatureType} · GS {selected.challengeRating}</p><small>{selected.source} · {getRuleset(selected.ruleset.id).label}</small></div></section><section className="combat-grid"><Metric label="CA" value={selected.ac}/><Metric label="PF medi" value={selected.hp.average}/><Metric label="Dadi vita" value={selected.hp.formula}/><Metric label="Velocità" value={selected.speed}/><Metric label="Percezione" value={selected.passivePerception}/><Metric label="GS" value={selected.challengeRating}/></section><button className="primary" onClick={() => onAddTurn(selected)}>Collega al token e aggiungi ai turni</button>{selected.traits.length > 0 && <section><h2>Tratti</h2><EntryList entries={selected.traits} onRoll={onRoll} onShare={onShare}/></section>}<section><h2>Azioni</h2><EntryList entries={selected.actions} onRoll={onRoll} onShare={onShare}/></section>{selected.reactions.length > 0 && <section><h2>Reazioni</h2><EntryList entries={selected.reactions} onRoll={onRoll} onShare={onShare}/></section>}{selected.legendaryActions.length > 0 && <section><h2>Azioni leggendarie</h2><EntryList entries={selected.legendaryActions} onRoll={onRoll} onShare={onShare}/></section>}</div>;
  return <div className="stack"><Card className="remote-import"><h2>Catalogo 5e.tools</h2><p>Scarica solo il manuale scelto e lo converte nello standard TavernExplorer.</p><Button variant="outline" className="picker-button" onClick={() => setPickerOpen(true)}><span>{sources.find((source) => source.id === sourceId)?.label ?? "Scegli una sorgente"}</span><span>⌕</span></Button><Button onClick={remoteImport} disabled={loading || !sourceId}>{loading && <Spinner/>}{loading ? "Importazione…" : "Importa sorgente"}</Button>{error && <Alert tone="danger">{error}</Alert>}</Card><CatalogDialog open={pickerOpen} title="Scegli un manuale" description="Cerca per sigla sorgente 5e.tools" items={sources.map((source) => ({ id: source.id, label: source.label, detail: source.file }))} selectedId={sourceId} onSelect={(id) => { setSourceId(id); setPickerOpen(false); }} onClose={() => setPickerOpen(false)}/><section className="library-actions"><Button variant="outline" onClick={onImport}>Importa file 5e.tools</Button></section><section className="monster-grid">{monsters.map((monster) => <button key={monster.id} onClick={() => onSelect(monster.id)}><strong>{monster.name}</strong><small>{monster.creatureType} · GS {monster.challengeRating}</small><span>CA {monster.ac} · PF {monster.hp.average}</span></button>)}</section>{monsters.length === 0 && <Empty/>}</div>;
}

function ChapterView({ chapter, onShare, onMap }: { chapter: CampaignDocument["chapters"][number]; onShare: (title: string, body: string) => void; onMap: (image: CampaignDocument["chapters"][number]["images"][number]) => void }) {
  return <details className="chapter"><summary>{chapter.title}</summary><div><button onClick={() => onShare(chapter.title, chapter.body)}>Condividi estratto</button><p>{chapter.body}</p>{chapter.images.length > 0 && <section className="chapter-images">{chapter.images.map((image) => <article className={image.kind !== "image" ? "adventure-map" : "adventure-image"} key={`${image.title}-${image.url}`}><a href={image.url} target="_blank" rel="noreferrer">{image.title}</a><Badge>{image.kind === "mapPlayer" ? "Mappa giocatori" : image.kind === "map" ? "Mappa GM" : "Immagine"}</Badge><Button variant="secondary" onClick={() => onMap(image)}>Carica come scena</Button></article>)}</section>}{chapter.children.map((child) => <ChapterView key={child.id} chapter={child} onShare={onShare} onMap={onMap}/>)}</div></details>;
}

function Campaigns({ documents, selectedId, canManage, onSelect, onImport, onImported, onDelete, onMap, onAdventureMap, onShare }: { documents: CampaignDocument[]; selectedId: string | null; canManage: boolean; onSelect: (id: string | null) => void; onImport: () => void; onImported: (items: CampaignDocument[]) => void; onDelete: (id: string) => void; onMap: () => void; onAdventureMap: (image: CampaignDocument["chapters"][number]["images"][number]) => void; onShare: (title: string, body: string) => void }) {
  const removeSelected = () => { const selected = documents.find((document) => document.id === selectedId); if (selected && canManage && window.confirm(`Eliminare ${selected.title}?`)) onDelete(selected.id); };
  const [catalog, setCatalog] = useState<FiveToolsAdventure[]>([]); const [adventureId, setAdventureId] = useState(""); const [pickerOpen, setPickerOpen] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  useEffect(() => { listAdventures().then((rows) => { setCatalog(rows); setAdventureId(rows[0]?.id ?? ""); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Catalogo non disponibile")); }, []);
  async function remoteImport() { const adventure = catalog.find((row) => row.id === adventureId); if (!adventure) return; setLoading(true); setError(""); try { const imported = await loadAdventure(adventure); const next = [...documents.filter((item) => !(item.title === imported.title && item.source === imported.source)), imported]; onImported(next); onSelect(imported.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Importazione fallita"); } finally { setLoading(false); } }
  const selected = documents.find((document) => document.id === selectedId);
  if (selected && canManage) return <div className="stack"><div className="library-actions"><Button variant="ghost" onClick={() => onSelect(null)}>← Avventure</Button><Button variant="destructive" onClick={removeSelected}>Elimina avventura</Button></div><Campaigns documents={documents} selectedId={selectedId} canManage={false} onSelect={onSelect} onImport={onImport} onImported={onImported} onDelete={onDelete} onMap={onMap} onAdventureMap={onAdventureMap} onShare={onShare}/></div>;
  if (!selected && !canManage) return <div className="stack"><Alert>Il GM ha riservato importazione ed eliminazione dei contenuti.</Alert>{documents.map((document) => <button className="campaign-card" key={document.id} onClick={() => onSelect(document.id)}><strong>{document.title}</strong><small>{document.source} · {document.chapters.length} capitoli</small></button>)}{documents.length === 0 && <Empty/>}</div>;
  if (selected) return <div className="stack"><button onClick={() => onSelect(null)}>← Avventure</button><section className="paper"><h2>{selected.title}</h2><p>{selected.source} · {getRuleset(selected.ruleset.id).label}</p><button className="primary" onClick={onMap}>Carica una mappa dal dispositivo</button></section><section className="chapters">{selected.chapters.map((chapter) => <ChapterView key={chapter.id} chapter={chapter} onShare={onShare} onMap={onAdventureMap}/>)}</section></div>;
  return <div className="stack"><Card className="remote-import"><h2>Avventure 5e.tools</h2><p>Scegli un'avventura: viene scaricata su richiesta e normalizzata in capitoli TavernExplorer.</p><Button variant="outline" className="picker-button" onClick={() => setPickerOpen(true)}><span>{catalog.find((adventure) => adventure.id === adventureId)?.name ?? "Cerca un'avventura"}</span><span>⌕</span></Button><Button disabled={loading || !adventureId} onClick={remoteImport}>{loading && <Spinner/>}{loading ? "Importazione…" : "Importa avventura"}</Button>{error && <Alert tone="danger">{error}</Alert>}</Card><CatalogDialog open={pickerOpen} title="Cerca un'avventura" description="Ricerca interattiva nel catalogo 5e.tools" items={catalog.map((adventure) => ({ id: adventure.id, label: adventure.name, detail: adventure.source }))} selectedId={adventureId} onSelect={(id) => { setAdventureId(id); setPickerOpen(false); }} onClose={() => setPickerOpen(false)}/><section className="library-actions"><Button variant="outline" onClick={onImport}>Importa file 5e.tools</Button><Button variant="secondary" onClick={onMap}>Carica mappa</Button></section>{documents.map((document) => <button className="campaign-card" key={document.id} onClick={() => onSelect(document.id)}><strong>{document.title}</strong><small>{document.source} · {document.chapters.length} capitoli</small></button>)}{documents.length === 0 && <Empty/>}</div>;
}

function CatalogDialog({ open, title, description, items, selectedId, onSelect, onClose }: { open: boolean; title: string; description: string; items: Array<{ id: string; label: string; detail: string }>; selectedId: string; onSelect: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  useEffect(() => { if (open) setQuery(""); }, [open]);
  const visible = items.filter((item) => `${item.label} ${item.detail}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Dialog open={open} title={title} description={description} onClose={onClose}><div className="catalog-search"><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digita per cercare…" aria-label="Cerca nel catalogo"/></div><div className="catalog-list">{visible.map((item) => <button className={`catalog-option ${item.id === selectedId ? "active" : ""}`} key={item.id} onClick={() => onSelect(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}{visible.length === 0 && <div className="catalog-empty">Nessun risultato</div>}</div></Dialog>;
}

function SharedInventory({ items, characters, editable, onChange }: { items: SharedInventoryItem[]; characters: CharacterSheet[]; editable: boolean; onChange: (items: SharedInventoryItem[]) => Promise<void> }) {
  const [name, setName] = useState(""); const [quantity, setQuantity] = useState(1); const [description, setDescription] = useState("");
  const update = (id: string, change: Partial<SharedInventoryItem>) => onChange(items.map((item) => item.id === id ? { ...item, ...change, updatedAt: Date.now() } : item));
  if (!editable) return <div className="stack"><Alert>Il GM ha impostato questo inventario in sola lettura.</Alert><Card>{items.map((item) => <article className="shared-row" key={item.id}><span><strong>{item.name}</strong><small>{item.description}</small></span><strong>× {item.quantity}</strong></article>)}{items.length === 0 && <p>Nessun oggetto condiviso.</p>}</Card></div>;
  return <div className="stack"><Card><h2>Inventario comune</h2><p>Sincronizzato nella stanza Owlbear. In anteprima resta salvato nel browser.</p></Card><form className="inventory-form" onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; void onChange([...items, { id: crypto.randomUUID(), name: name.trim(), quantity: Math.max(0, quantity), description: description.trim(), updatedAt: Date.now() }]); setName(""); setQuantity(1); setDescription(""); }}><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Oggetto"/><Input type="number" min="0" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}/><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Note"/><Button>Aggiungi</Button></form><Card>{items.map((item) => <article className="shared-row" key={item.id}><span><strong>{item.name}</strong><small>{item.description}</small><Select value={item.assignedTo ?? ""} onChange={(event) => void update(item.id, { assignedTo: event.target.value || undefined })}><option value="">Gruppo</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</Select></span><div><Button variant="outline" onClick={() => void update(item.id, { quantity: Math.max(0, item.quantity - 1) })}>−</Button><strong>{item.quantity}</strong><Button variant="outline" onClick={() => void update(item.id, { quantity: item.quantity + 1 })}>+</Button></div><Button variant="destructive" onClick={() => void onChange(items.filter((entry) => entry.id !== item.id))}>×</Button></article>)}{items.length === 0 && <p>Nessun oggetto condiviso.</p>}</Card></div>;
}

function Permissions({ value, onChange }: { value: PermissionSettings; onChange: (value: PermissionSettings) => Promise<void> }) {
  const options: Array<{ key: keyof PermissionSettings; title: string; description: string }> = [
    { key: "playersEditInventory", title: "Modificare inventario comune", description: "Aggiungere, assegnare, cambiare quantità ed eliminare oggetti." },
    { key: "playersImportContent", title: "Gestire bestiario e avventure", description: "Importare ed eliminare contenuti 5e.tools." },
    { key: "playersManageTurns", title: "Gestire ordine dei turni", description: "Cambiare iniziativa, avanzare e rimuovere partecipanti." },
  ];
  return <div className="stack"><Card><h2>Autorizzazioni stanza</h2><p>Queste impostazioni sono condivise tramite i metadata Owlbear e possono essere cambiate solo dal GM.</p></Card><Card>{options.map((option) => <label className="permission-row" key={option.key}><span><strong>{option.title}</strong><small>{option.description}</small></span><input type="checkbox" checked={value[option.key]} onChange={(event) => void onChange({ ...value, [option.key]: event.target.checked })}/></label>)}</Card></div>;
}

function Party({ characters, sheets, members, player, openId, onOpen, onRoll, onShare, onUpdateShared, onEditorsChange, onAssignPlayer }: { characters: PartyCharacterSummary[]; sheets: SharedSheet[]; members: Array<{ id: string; name: string; role: "GM" | "PLAYER" }>; player: { id: string; name: string; role: "GM" | "PLAYER" }; openId: string | null; onOpen: (id: string | null) => void; onRoll: (title: string, formula: string) => void; onShare: (entry: ActionEntry | SpellEntry) => void; onUpdateShared: (sheetId: string, update: (sheet: CharacterSheet) => CharacterSheet) => void; onEditorsChange: (sheetId: string, editors: string[]) => void; onAssignPlayer: (sheetId: string, ownerId: string) => void }) {
  const opened = sheets.find((entry) => entry.sheet.id === openId);
  if (opened) return <PartySheet entry={opened} members={members} player={player} onBack={() => onOpen(null)} onRoll={onRoll} onShare={onShare} onUpdateShared={onUpdateShared} onEditorsChange={onEditorsChange}/>;
  // Fallback ai riassunti finché tutti i client non pubblicano la scheda completa.
  const cards = sheets.length ? sheets.map((entry) => ({ entry, summary: summaryOf(entry) })) : characters.map((summary) => ({ entry: null, summary }));
  return <div className="stack"><Card><h2>Party della stanza</h2><p>Le schede dei giocatori connessi sono visibili a tutto il party. Le modifiche restano riservate al proprietario, al DM e ai delegati.</p></Card>{player.role === "GM" && sheets.length > 0 && <AssignmentPanel sheets={sheets} members={members} onAssignPlayer={onAssignPlayer}/>}{cards.map(({ entry, summary }) => <Card className="party-card" key={`${summary.ownerId}-${summary.id}`}><header>{summary.avatar && <img src={summary.avatar} alt="" referrerPolicy="no-referrer"/>}<div><h2>{summary.name}</h2><p>{summary.classDisplay} · {summary.race}</p><small>Giocatore: {summary.ownerName} · {getRuleset(summary.ruleset.id).label}</small></div>{entry && <Button variant="outline" onClick={() => onOpen(summary.id)}>{canEditSheet(entry, player.id, player.role) ? "Apri e modifica" : "Apri scheda"}</Button>}</header><section className="combat-grid"><Metric label="CA" value={summary.ac}/><Metric label="PF" value={`${summary.hp.current}/${summary.hp.max}`}/><Metric label="Iniziativa" value={signed(summary.initiative)}/><Metric label="CD magia" value={summary.spellSaveDc}/><Metric label="Attacco magia" value={signed(summary.spellAttackBonus)}/><Metric label="Livello" value={summary.level}/></section><section className="party-abilities">{Object.entries(summary.abilities).map(([key, ability]) => <div key={key}><small>{ABILITY_LABELS[key] ?? key}</small><strong>{ability.score}</strong><span>{signed(ability.mod)}</span></div>)}</section></Card>)}{cards.length === 0 && <Empty/>}</div>;
}

function AssignmentPanel({ sheets, members, onAssignPlayer }: { sheets: SharedSheet[]; members: Array<{ id: string; name: string; role: "GM" | "PLAYER" }>; onAssignPlayer: (sheetId: string, ownerId: string) => void }) {
  const [sheetId, setSheetId] = useState(sheets[0]?.sheet.id ?? "");
  const [tokens, setTokens] = useState<Array<{ tokenId: string; tokenName: string; characterId: string }>>([]);
  const [status, setStatus] = useState("");
  const refresh = () => { getTokenAssignments().then(setTokens).catch(() => undefined); };
  useEffect(refresh, []);
  const assignToken = async (id: string | null) => {
    try { const tokenName = await assignCharacterToSelectedToken(id); setStatus(id ? `Token "${tokenName}" collegato.` : `Token "${tokenName}" scollegato.`); refresh(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Assegnazione fallita"); }
  };
  const nameOf = (id: string) => sheets.find((entry) => entry.sheet.id === id)?.sheet.name ?? "Scheda rimossa";
  return <Card><h2>Assegnazioni del DM</h2><p>Collega una scheda al token selezionato sulla mappa oppure passala a un altro giocatore.</p>
    <div className="assign-row"><Select aria-label="Scheda da assegnare" value={sheetId} onChange={(event) => setSheetId(event.target.value)}>{sheets.map((entry) => <option key={entry.sheet.id} value={entry.sheet.id}>{entry.sheet.name} · {entry.ownerName}</option>)}</Select><Button onClick={() => void assignToken(sheetId)} disabled={!sheetId}>Assegna al token selezionato</Button><Button variant="secondary" onClick={() => void assignToken(null)}>Scollega token</Button></div>
    <div className="assign-row"><Select aria-label="Nuovo proprietario" defaultValue="" onChange={(event) => { if (event.target.value && sheetId) { onAssignPlayer(sheetId, event.target.value); setStatus("Proprietario aggiornato."); event.target.value = ""; } }}><option value="">Assegna a un giocatore…</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.role === "GM" ? " (DM)" : ""}</option>)}</Select></div>
    {status && <small className="assign-status">{status}</small>}
    {tokens.length > 0 && <ul className="assign-list">{tokens.map((token) => <li key={token.tokenId}><span>{token.tokenName}</span><strong>{nameOf(token.characterId)}</strong></li>)}</ul>}
  </Card>;
}

function summaryOf(entry: SharedSheet): PartyCharacterSummary {
  const sheet = entry.sheet;
  return { id: sheet.id, ownerId: entry.ownerId, ownerName: entry.ownerName, name: sheet.name, avatar: sheet.avatar, classDisplay: sheet.identity.classDisplay, race: sheet.identity.race, level: sheet.identity.level, ruleset: sheet.ruleset, ac: sheet.combat.ac, hp: sheet.combat.hp, initiative: sheet.combat.initiative, abilities: sheet.abilities, spellSaveDc: sheet.spellcasting.saveDc, spellAttackBonus: sheet.spellcasting.attackBonus };
}

function PartySheet({ entry, members, player, onBack, onRoll, onShare, onUpdateShared, onEditorsChange }: { entry: SharedSheet; members: Array<{ id: string; name: string; role: "GM" | "PLAYER" }>; player: { id: string; name: string; role: "GM" | "PLAYER" }; onBack: () => void; onRoll: (title: string, formula: string) => void; onShare: (entry: ActionEntry | SpellEntry) => void; onUpdateShared: (sheetId: string, update: (sheet: CharacterSheet) => CharacterSheet) => void; onEditorsChange: (sheetId: string, editors: string[]) => void }) {
  const [sheetTab, setSheetTab] = useState<SheetTab>("main");
  const editable = canEditSheet(entry, player.id, player.role);
  const canDelegate = player.role === "GM" || entry.ownerId === player.id;
  const update = (updater: (sheet: CharacterSheet) => CharacterSheet) => onUpdateShared(entry.sheet.id, updater);
  const toggleEditor = (id: string) => onEditorsChange(entry.sheet.id, entry.editors.includes(id) ? entry.editors.filter((item) => item !== id) : [...entry.editors, id]);
  const tabs: SheetTab[] = editable ? ["main", "actions", "spells", "inventory", "traits", "bio", "edit"] : ["main", "actions", "spells", "inventory", "traits", "bio"];
  return <div className="stack">
    <div className="library-actions"><Button variant="ghost" onClick={onBack}>← Party</Button><span className="party-owner">{entry.sheet.name} · {entry.ownerName}{editable ? "" : " · sola lettura"}</span></div>
    {canDelegate && <Card><h2>Chi può modificare</h2><p>Il proprietario e il DM possono sempre modificare. Aggiungi altri giocatori qui.</p><div className="editor-delegates">{members.filter((member) => member.id !== entry.ownerId && member.role !== "GM").map((member) => <label key={member.id}><input type="checkbox" checked={entry.editors.includes(member.id)} onChange={() => toggleEditor(member.id)}/> {member.name}</label>)}{members.filter((member) => member.id !== entry.ownerId && member.role !== "GM").length === 0 && <small>Nessun altro giocatore connesso.</small>}</div></Card>}
    <nav className="sheet-tabs">{tabs.map((key) => <button key={key} className={sheetTab === key ? "active" : ""} onClick={() => setSheetTab(key)}>{SHEET_TAB_LABELS[key]}</button>)}</nav>
    <div className={editable ? undefined : "readonly-sheet"}>
    {sheetTab === "main" && <MainSheet sheet={entry.sheet} onRoll={onRoll} onUpdate={editable ? update : noopUpdate}/>}
    {sheetTab === "actions" && <EntryList entries={entry.sheet.actions} onRoll={onRoll} onShare={onShare}/>}
    {sheetTab === "spells" && <Spells sheet={entry.sheet} onRoll={onRoll} onShare={onShare} onUpdate={editable ? update : noopUpdate}/>}
    {sheetTab === "inventory" && <Inventory sheet={entry.sheet} onUpdate={editable ? update : noopUpdate}/>}
    {sheetTab === "traits" && <EntryList entries={entry.sheet.traits.map((trait) => ({ ...trait, source: trait.source }))} onRoll={onRoll} onShare={onShare}/>}
    {sheetTab === "bio" && <section className="paper"><h2>Biografia</h2><p className="prose">{entry.sheet.biography || "Nessuna biografia."}</p></section>}
    {sheetTab === "edit" && editable && <><CharacterEditor sheet={entry.sheet} onUpdate={update}/><DeepCharacterEditor sheet={entry.sheet} onUpdate={update}/></>}
    </div>
  </div>;
}

const noopUpdate = () => undefined;


function Empty({ onImport }: { onImport?: () => void }) { return <section className="empty"><img src="/icon.svg" alt=""/><h2>Niente da mostrare</h2><p>Importa un personaggio esportato da Roll20 per iniziare.</p>{onImport && <button className="primary" onClick={onImport}>Importa JSON</button>}</section>; }
