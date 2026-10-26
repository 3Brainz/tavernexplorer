import { useState } from "react";
import type { PlayerNote, Visibility } from "./types";
import { Button, Card, Select, Textarea } from "./ui";

function NoteCard({ note, onUpdate, onDelete, onShare }: { note: PlayerNote; onUpdate: (note: PlayerNote) => void; onDelete: () => void; onShare: (target: "everyone" | "gm") => void }) {
  const [target, setTarget] = useState<Visibility>("self");
  const update = (change: Partial<PlayerNote>) => onUpdate({ ...note, ...change, updatedAt: Date.now() });
  return <Card className="note-card">
    <input aria-label="Titolo nota" value={note.title} onChange={(event) => update({ title: event.target.value })} placeholder="Titolo della nota"/>
    <Textarea aria-label={`Testo della nota ${note.title}`} value={note.body} onChange={(event) => update({ body: event.target.value })} placeholder="Scrivi qui appunti, indizi, idee…"/>
    <div className="note-footer"><small>Salvata su questo browser · {new Date(note.updatedAt).toLocaleString()}</small><Button variant="destructive" onClick={onDelete}>Elimina</Button></div>
    <div className="note-share"><Select aria-label={`Condivisione della nota ${note.title}`} value={target} onChange={(event) => setTarget(event.target.value as Visibility)}><option value="self">Privata</option><option value="everyone">Tutto il party</option><option value="gm">Solo GM</option></Select><Button variant="outline" disabled={target === "self" || !note.body.trim()} onClick={() => { if (target !== "self") onShare(target); }}>Invia copia</Button></div>
  </Card>;
}

export function Notes({ notes, onChange, onShare }: { notes: PlayerNote[]; onChange: (notes: PlayerNote[]) => void; onShare: (note: PlayerNote, target: "everyone" | "gm") => void }) {
  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  return <div className="stack"><Card className="notes-intro"><div><h2>Le mie note</h2><p>Appunti privati, salvati nel browser e inclusi nel TavernPack. Puoi inviare una copia di una nota al party o al GM.</p></div><Button onClick={() => onChange([...notes, { id: crypto.randomUUID(), title: "Nuova nota", body: "", updatedAt: Date.now() }])}>+ Nuova nota</Button></Card>{sorted.map((note) => <NoteCard key={note.id} note={note} onUpdate={(updated) => onChange(notes.map((item) => item.id === note.id ? updated : item))} onDelete={() => { if (window.confirm(`Eliminare la nota “${note.title}”?`)) onChange(notes.filter((item) => item.id !== note.id)); }} onShare={(target) => onShare(note, target)}/>)}{notes.length === 0 && <p className="notes-empty">Nessuna nota. Crea la prima per tenere traccia della sessione.</p>}</div>;
}
