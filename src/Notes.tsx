import { useEffect, useState } from "react";
import { canManageNote, canWriteNote, isWritePermission } from "./sharedNotes";
import type { NoteOrganization, NoteWritePermission, PlayerNote, SharedNote } from "./types";
import { Button, Card, Input, Select, Textarea } from "./ui";

type Player = { id: string; name: string; role: "GM" | "PLAYER" };
type Folder = NoteOrganization["folders"][number];
type NoteDraft = { title: string; body: string; writePermission: NoteWritePermission; version: number; base: { title: string; body: string; writePermission: NoteWritePermission }; stale: boolean };
const draftFrom = (title: string, body: string, writePermission: NoteWritePermission, version: number): NoteDraft => ({ title, body, writePermission, version, base: { title, body, writePermission }, stale: false });

function FolderSelect({ folders, value, onChange }: { folders: Folder[]; value: string; onChange: (id: string) => void }) {
  return <label className="note-folder-select">Cartella personale <Select aria-label="Cartella della nota" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Senza cartella</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</Select></label>;
}

function PrivateNote({ note, folders, folderId, onMove, onUpdate, onDelete, onPublish, onSendToGm }: { note: PlayerNote; folders: Folder[]; folderId: string; onMove: (id: string) => void; onUpdate: (note: PlayerNote) => void; onDelete: () => void; onPublish: () => void; onSendToGm: () => void }) {
  const update = (change: Partial<PlayerNote>) => onUpdate({ ...note, ...change, updatedAt: Date.now() });
  return <Card className="note-card">
    <input aria-label="Titolo nota" value={note.title} onChange={(event) => update({ title: event.target.value })} placeholder="Titolo della nota"/>
    <Textarea aria-label={`Testo della nota ${note.title}`} value={note.body} onChange={(event) => update({ body: event.target.value })} placeholder="Scrivi qui appunti, indizi, idee…"/>
    <FolderSelect folders={folders} value={folderId} onChange={onMove}/>
    <div className="note-footer"><small>Privata · salvata su questo browser · {new Date(note.updatedAt).toLocaleString()}</small><Button variant="destructive" onClick={onDelete}>Elimina</Button></div>
    <div className="note-share"><Button variant="outline" onClick={onPublish}>Condividi col party</Button><Button variant="outline" disabled={!note.body.trim()} onClick={onSendToGm}>Invia copia al GM</Button></div>
  </Card>;
}

function SharedNoteCard({ note, player, folders, folderId, onMove, onSave, onDelete, onMakePrivate }: { note: SharedNote; player: Player; folders: Folder[]; folderId: string; onMove: (id: string) => void; onSave: (note: SharedNote) => Promise<void>; onDelete: () => Promise<void>; onMakePrivate: () => Promise<void> }) {
  const writable = canWriteNote(note, player.id, player.role);
  const owner = canManageNote(note, player.id);
  const [draft, setDraft] = useState(() => draftFrom(note.title, note.body, note.writePermission, note.updatedAt));
  const [saving, setSaving] = useState(false);
  const { id, updatedAt, title, body, writePermission } = note;
  useEffect(() => { setDraft((current) => {
    const edited = current.title !== current.base.title || current.body !== current.base.body || current.writePermission !== current.base.writePermission;
    const matchesSaved = current.title === title && current.body === body && current.writePermission === writePermission;
    return current.version !== updatedAt && edited && !matchesSaved ? { ...current, stale: true } : draftFrom(title, body, writePermission, updatedAt);
  }); }, [id, updatedAt, title, body, writePermission]);
  const dirty = draft.title !== draft.base.title || draft.body !== draft.base.body || draft.writePermission !== draft.base.writePermission;
  return <Card className="note-card">
    <input aria-label="Titolo nota condivisa" value={draft.title} disabled={!writable} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Titolo della nota"/>
    <Textarea aria-label={`Testo della nota condivisa ${note.title}`} value={draft.body} disabled={!writable} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Scrivi qui appunti, indizi, idee…"/>
    <FolderSelect folders={folders} value={folderId} onChange={onMove}/>
    {draft.stale && <div className="note-conflict">Questa nota è cambiata mentre la modificavi. Copia il tuo testo prima di ricaricare.<Button variant="outline" onClick={() => setDraft(draftFrom(title, body, writePermission, updatedAt))}>Ricarica</Button></div>}
    <div className="note-footer"><small>Di {note.ownerName} · visibile al party · {new Date(note.updatedAt).toLocaleString()}</small>{owner && <Button variant="destructive" onClick={() => void onDelete()}>Rimuovi</Button>}</div>
    <div className="note-share"><span className="note-read">Lettura: tutto il party</span><label>Può scrivere <Select aria-label={`Permesso di scrittura della nota ${note.title}`} value={draft.writePermission} disabled={!owner} onChange={(event) => { if (isWritePermission(event.target.value)) setDraft({ ...draft, writePermission: event.target.value }); }}><option value="owner">Solo autore</option><option value="owner-gm">Autore e GM</option><option value="party">Tutto il party</option></Select></label>{writable && <Button disabled={!dirty || saving || draft.stale} onClick={async () => { setSaving(true); try { await onSave({ ...note, title: draft.title, body: draft.body, writePermission: draft.writePermission, updatedAt: draft.version }); } finally { setSaving(false); } }}>Salva modifiche</Button>}{owner && <Button variant="outline" onClick={() => void onMakePrivate()}>Rendi privata</Button>}</div>
  </Card>;
}

export function Notes({ notes, sharedNotes, organization, player, onChange, onOrganizationChange, onPublish, onSaveShared, onDeleteShared, onMakePrivate, onSendToGm }: { notes: PlayerNote[]; sharedNotes: SharedNote[]; organization: NoteOrganization; player: Player; onChange: (notes: PlayerNote[]) => void; onOrganizationChange: (value: NoteOrganization) => void; onPublish: (note: PlayerNote) => Promise<void>; onSaveShared: (note: SharedNote) => Promise<void>; onDeleteShared: (id: string) => Promise<void>; onMakePrivate: (note: SharedNote) => Promise<void>; onSendToGm: (note: PlayerNote) => void }) {
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [newFolder, setNewFolder] = useState("");
  const folders = organization.folders ?? [];
  const placements = organization.placements ?? {};
  const move = (id: string, folderId: string) => onOrganizationChange({ folders, placements: { ...placements, [id]: folderId } });
  const visible = (note: PlayerNote) => selectedFolder === "all" || (selectedFolder === "unfiled" ? !placements[note.id] : placements[note.id] === selectedFolder);
  const sorted = notes.filter(visible).sort((a, b) => b.updatedAt - a.updatedAt);
  const sortedShared = sharedNotes.filter(visible).sort((a, b) => b.updatedAt - a.updatedAt);
  const createFolder = () => {
    const name = newFolder.trim();
    if (!name || folders.some((folder) => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
    const id = crypto.randomUUID(); onOrganizationChange({ folders: [...folders, { id, name }], placements });
    setNewFolder(""); setSelectedFolder(id);
  };
  const renameFolder = (folder: Folder) => {
    const name = window.prompt("Nuovo nome della cartella", folder.name)?.trim();
    if (!name || folders.some((item) => item.id !== folder.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
    onOrganizationChange({ folders: folders.map((item) => item.id === folder.id ? { ...item, name } : item), placements });
  };
  const deleteFolder = (folder: Folder) => {
    if (!window.confirm(`Eliminare la cartella “${folder.name}”? Le note resteranno disponibili senza cartella.`)) return;
    onOrganizationChange({ folders: folders.filter((item) => item.id !== folder.id), placements: Object.fromEntries(Object.entries(placements).filter(([, id]) => id !== folder.id)) });
    setSelectedFolder("all");
  };
  return <div className="stack">
    <Card className="note-folders"><div className="editor-heading"><h2>Cartelle</h2><small>Organizzazione personale su questo browser</small></div><div className="folder-list"><button className={selectedFolder === "all" ? "active" : ""} onClick={() => setSelectedFolder("all")}>Tutte</button><button className={selectedFolder === "unfiled" ? "active" : ""} onClick={() => setSelectedFolder("unfiled")}>Senza cartella</button>{folders.map((folder) => <span className="folder-item" key={folder.id}><button className={selectedFolder === folder.id ? "active" : ""} onClick={() => setSelectedFolder(folder.id)}>{folder.name}</button><button aria-label={`Rinomina ${folder.name}`} onClick={() => renameFolder(folder)}>✎</button><button aria-label={`Elimina ${folder.name}`} onClick={() => deleteFolder(folder)}>×</button></span>)}</div><form className="folder-form" onSubmit={(event) => { event.preventDefault(); createFolder(); }}><Input aria-label="Nome nuova cartella" value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder="Nuova cartella"/><Button disabled={!newFolder.trim()}>Crea</Button></form></Card>
    <Card className="notes-intro"><div><h2>Note private</h2><p>Le nuove note restano sul tuo browser. Puoi pubblicarle nella stanza con lettura per il party e scrittura configurabile per ogni nota.</p></div><Button onClick={() => { const note = { id: crypto.randomUUID(), title: "Nuova nota", body: "", updatedAt: Date.now() }; onChange([...notes, note]); if (folders.some((folder) => folder.id === selectedFolder)) move(note.id, selectedFolder); }}>+ Nuova nota</Button></Card>
    {sorted.map((note) => <PrivateNote key={note.id} note={note} folders={folders} folderId={placements[note.id] ?? ""} onMove={(id) => move(note.id, id)} onUpdate={(updated) => onChange(notes.map((item) => item.id === note.id ? updated : item))} onDelete={() => { if (window.confirm(`Eliminare la nota “${note.title}”?`)) onChange(notes.filter((item) => item.id !== note.id)); }} onPublish={() => void onPublish(note)} onSendToGm={() => onSendToGm(note)}/>)}
    {sorted.length === 0 && <p className="notes-empty">Nessuna nota privata in questa cartella.</p>}
    <Card className="notes-intro"><div><h2>Note condivise</h2><p>Tutti nella stanza possono leggerle. Solo l’autore sceglie chi può scrivere o rimuovere la condivisione.</p></div></Card>
    {sortedShared.map((note) => <SharedNoteCard key={note.id} note={note} player={player} folders={folders} folderId={placements[note.id] ?? ""} onMove={(id) => move(note.id, id)} onSave={onSaveShared} onDelete={() => onDeleteShared(note.id)} onMakePrivate={() => onMakePrivate(note)}/>)}
    {sortedShared.length === 0 && <p className="notes-empty">Nessuna nota condivisa in questa cartella.</p>}
  </div>;
}
