import { useEffect, useMemo, useRef, useState } from "react";
import { ABILITY_LABELS, SKILL_LABELS } from "./constants";
import { roll } from "./dice";
import { importRoll20 } from "./importer";
import { import5eToolsCampaign, import5eToolsMonsters } from "./import5etools";
import { listAdventures, listBestiarySources, loadAdventure, loadBestiarySource, type FiveToolsAdventure, type FiveToolsSource } from "./fivetoolsApi";
import { DEFAULT_RULESET, getRuleset } from "./rulesets";
import { storage } from "./storage";
import { createTavernPack, parseTavernPack } from "./tavernpack";
import { Alert, Badge, Button, Card, Dialog, Input, Select, Spinner } from "./ui";
import {
  DEFAULT_PERMISSIONS, OBR, addSelectedTokenToTurns, broadcastMessage, getPartyCharacters, getPermissions, getPlayerInfo, getTurnState,
  getSharedInventory, onBroadcastMessage, onPartyCharactersChange, onPermissionsChange, onSharedInventoryChange, onTurnStateChange, openFloatingPanel, publishPartyCharacters, setActiveCharacter, setPermissions, setSharedInventory, setTurnState, uploadMapAsScene, uploadRemoteMapAsScene,
} from "./obr";
import type { ActionEntry, CampaignDocument, CharacterSheet, ChatMessage, MonsterSheet, PartyCharacterSummary, PermissionSettings, Roll20Export, RollMode, SharedInventoryItem, SpellEntry, TavernPack, TurnState, Visibility } from "./types";

type AppTab = "sheet" | "turns" | "messages" | "library" | "compendium" | "campaigns" | "shared" | "party" | "settings";
type SheetTab = "main" | "actions" | "spells" | "inventory" | "traits" | "bio" | "edit";

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
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [turns, setTurns] = useState<TurnState>({ round: 1, activeIndex: 0, entries: [] });
  const [tab, setTab] = useState<AppTab>(floatingView === "messages" ? "messages" : floatingView === "turns" ? "turns" : characters.length ? "sheet" : "library");
  const [sheetTab, setSheetTab] = useState<SheetTab>("main");
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [visibility, setVisibility] = useState<Visibility>("everyone");
  const [player, setPlayer] = useState({ id: "preview", name: "Giocatore", role: "PLAYER" as "GM" | "PLAYER" });
  const [draft, setDraft] = useState("");
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
      publishPartyCharacters(charactersRef.current);
      const stopTurns = onTurnStateChange(setTurns);
      const stopMessages = onBroadcastMessage((message) => {
        setMessages((current) => { const next = [...current.filter((item) => item.id !== message.id), message].slice(-200); storage.messages.set(next); return next; });
      });
      const stopInventory = onSharedInventoryChange((items) => { setSharedInventoryState(items); storage.sharedInventory.set(items); });
      const stopPermissions = onPermissionsChange(setPermissionState);
      const stopParty = onPartyCharactersChange(setPartyCharacters);
      return () => { stopTurns(); stopMessages(); stopInventory(); stopPermissions(); stopParty(); };
    });
  }, []);

  useEffect(() => { setActiveCharacter(activeId); }, [activeId]);
  useEffect(() => { charactersRef.current = characters; publishPartyCharacters(characters); }, [characters]);
  useEffect(() => { const sync = (event: StorageEvent) => { if (event.key?.includes("/messages/")) setMessages(storage.messages.get()); }; window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync); }, []);

  async function publish(message: ChatMessage) {
    saveMessages([...messages, message]);
    await broadcastMessage(message);
    if (OBR.isAvailable && message.visibility !== "self") await OBR.notification.show(message.title ? `${message.author}: ${message.title}` : message.body.slice(0, 90), "INFO");
  }

  async function performRoll(title: string, formula: string) {
    try {
      const result = roll(formula, rollMode);
      await publish(makeMessage({ kind: "roll", author: active?.name ?? player.name, characterId: active?.id, title, body: `${result.formula} → ${result.total}`, formula: result.formula, total: result.total, dice: result.dice, visibility }));
      if (OBR.isAvailable) await openFloatingPanel("messages"); else setTab("messages");
    } catch (error) {
      if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Tiro non valido", "ERROR");
    }
  }

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
      {player.role === "GM" && <button className={tab === "party" ? "active" : ""} onClick={() => setTab("party")}>Party <span>{partyCharacters.length}</span></button>}
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
      {tab === "party" && player.role === "GM" && <Party characters={partyCharacters}/>} 
      {tab === "settings" && player.role === "GM" && <Permissions value={permissions} onChange={async (next) => { setPermissionState(next); await setPermissions(next); }}/>} 
    </main>
    <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ""; }}/>
    <input ref={contentRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) import5eToolsFile(file); event.target.value = ""; }}/>
    <input ref={mapRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { const name = window.prompt("Nome della nuova scena", file.name.replace(/\.[^.]+$/, "")); if (name) { try { await uploadMapAsScene(file, name); } catch (error) { if (OBR.isAvailable) await OBR.notification.show(error instanceof Error ? error.message : "Caricamento fallito", "ERROR"); } } } event.target.value = ""; }}/>
  </div>;
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
    <nav className="sheet-tabs">{(["main", "actions", "spells", "inventory", "traits", "bio", "edit"] as SheetTab[]).map((item) => <button key={item} className={sheetTab === item ? "active" : ""} onClick={() => setSheetTab(item)}>{({ main: "Base", actions: "Azioni", spells: "Magia", inventory: "Zaino", traits: "Tratti", bio: "Bio", edit: "Modifica" } as Record<SheetTab, string>)[item]}</button>)}</nav>
    {sheetTab === "main" && <MainSheet sheet={sheet} onRoll={onRoll} onUpdate={onUpdate}/>} 
    {sheetTab === "actions" && <EntryList entries={sheet.actions} onRoll={onRoll} onShare={onShare}/>} 
    {sheetTab === "spells" && <Spells sheet={sheet} onRoll={onRoll} onShare={onShare} onUpdate={onUpdate}/>} 
    {sheetTab === "inventory" && <Inventory sheet={sheet} onUpdate={onUpdate}/>} 
    {sheetTab === "traits" && <EntryList entries={sheet.traits.map((trait) => ({ ...trait, source: trait.source }))} onRoll={onRoll} onShare={onShare}/>} 
    {sheetTab === "bio" && <section className="paper"><h2>Biografia</h2><p className="prose">{sheet.biography || "Nessuna biografia."}</p>{sheet.importWarnings.length > 0 && <details className="warnings"><summary>{sheet.importWarnings.length} note d’importazione</summary><ul>{sheet.importWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}</section>}
    {sheetTab === "edit" && <CharacterEditor sheet={sheet} onUpdate={onUpdate}/>} 
  </>;
}

function CharacterEditor({ sheet, onUpdate }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void }) {
  const field = (label: string, value: string | number, apply: (next: CharacterSheet, value: string) => void, type = "text") => <label><span>{label}</span><Input type={type} value={value} onChange={(event) => onUpdate((next) => { apply(next, event.target.value); return next; })}/></label>;
  return <div className="stack"><Card><h2>Identità</h2><div className="editor-grid">{field("Nome", sheet.name, (next, value) => { next.name = value; })}{field("Razza", sheet.identity.race, (next, value) => { next.identity.race = value; })}{field("Classe", sheet.identity.className, (next, value) => { next.identity.className = value; })}{field("Sottoclasse", sheet.identity.subclass, (next, value) => { next.identity.subclass = value; })}{field("Descrizione classe", sheet.identity.classDisplay, (next, value) => { next.identity.classDisplay = value; })}{field("Livello", sheet.identity.level, (next, value) => { next.identity.level = Math.max(1, Number(value) || 1); }, "number")}{field("Background", sheet.identity.background, (next, value) => { next.identity.background = value; })}{field("Allineamento", sheet.identity.alignment, (next, value) => { next.identity.alignment = value; })}</div></Card><Card><h2>Combattimento</h2><div className="editor-grid">{field("CA", sheet.combat.ac, (next, value) => { next.combat.ac = Number(value) || 0; }, "number")}{field("PF attuali", sheet.combat.hp.current, (next, value) => { next.combat.hp.current = Number(value) || 0; }, "number")}{field("PF massimi", sheet.combat.hp.max, (next, value) => { next.combat.hp.max = Number(value) || 0; }, "number")}{field("PF temporanei", sheet.combat.hp.temp, (next, value) => { next.combat.hp.temp = Number(value) || 0; }, "number")}{field("Iniziativa", sheet.combat.initiative, (next, value) => { next.combat.initiative = Number(value) || 0; }, "number")}{field("Velocità", sheet.combat.speed, (next, value) => { next.combat.speed = value; })}{field("CD incantesimi", sheet.spellcasting.saveDc, (next, value) => { next.spellcasting.saveDc = Number(value) || 0; }, "number")}{field("Attacco incantesimi", sheet.spellcasting.attackBonus, (next, value) => { next.spellcasting.attackBonus = Number(value) || 0; }, "number")}</div></Card><Card><h2>Caratteristiche</h2><div className="editor-grid">{Object.entries(sheet.abilities).map(([key, ability]) => field(ABILITY_LABELS[key] ?? key, ability.score, (next, value) => { const score = Number(value) || 0; next.abilities[key].score = score; next.abilities[key].mod = Math.floor((score - 10) / 2); }, "number"))}</div></Card><Card><h2>Biografia</h2><textarea className="ui-textarea" value={sheet.biography} onChange={(event) => onUpdate((next) => { next.biography = event.target.value; return next; })}/></Card></div>;
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
  async function remoteImport() { const source = sources.find((row) => row.id === sourceId); if (!source) return; setLoading(true); setError(""); try { const imported = await loadBestiarySource(source); const next = [...monsters]; for (const monster of imported) { const duplicate = next.findIndex((item) => item.name === monster.name && item.source === monster.source); if (duplicate >= 0) next[duplicate] = monster; else next.push(monster); } onImported(next); onSelect(imported[0]?.id ?? null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Importazione fallita"); } finally { setLoading(false); } }
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

function Party({ characters }: { characters: PartyCharacterSummary[] }) {
  return <div className="stack"><Card><h2>Party della stanza</h2><p>Le schede importate dai giocatori connessi sono pubblicate automaticamente al DM.</p></Card>{characters.map((character) => <Card className="party-card" key={`${character.ownerId}-${character.id}`}><header>{character.avatar && <img src={character.avatar} alt="" referrerPolicy="no-referrer"/>}<div><h2>{character.name}</h2><p>{character.classDisplay} · {character.race}</p><small>Giocatore: {character.ownerName} · {getRuleset(character.ruleset.id).label}</small></div></header><section className="combat-grid"><Metric label="CA" value={character.ac}/><Metric label="PF" value={`${character.hp.current}/${character.hp.max}`}/><Metric label="Iniziativa" value={signed(character.initiative)}/><Metric label="CD magia" value={character.spellSaveDc}/><Metric label="Attacco magia" value={signed(character.spellAttackBonus)}/><Metric label="Livello" value={character.level}/></section><section className="party-abilities">{Object.entries(character.abilities).map(([key, ability]) => <div key={key}><small>{ABILITY_LABELS[key] ?? key}</small><strong>{ability.score}</strong><span>{signed(ability.mod)}</span></div>)}</section></Card>)}{characters.length === 0 && <Empty/>}</div>;
}

function Empty({ onImport }: { onImport?: () => void }) { return <section className="empty"><img src="/icon.svg" alt=""/><h2>Niente da mostrare</h2><p>Importa un personaggio esportato da Roll20 per iniziare.</p>{onImport && <button className="primary" onClick={onImport}>Importa JSON</button>}</section>; }
