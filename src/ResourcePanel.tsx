import { useState } from "react";
import { effectiveSheet } from "./effects";
import { isCounterRecovery, takeLongRest, takeShortRest, type RestKind } from "./rest";
import type { CharacterSheet, CounterRecovery, ResourceCounter } from "./types";
import { Button, Card, Dialog, Input, Select } from "./ui";

export function ResourcePanel({ sheet, onUpdate, onRest }: { sheet: CharacterSheet; onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void; onRest: (summary: string) => void }) {
  const [name, setName] = useState("");
  const [maximum, setMaximum] = useState(1);
  const [recovery, setRecovery] = useState<CounterRecovery>("long");
  const [diceToSpend, setDiceToSpend] = useState(0);
  const [pendingRest, setPendingRest] = useState<RestKind | null>(null);
  const [error, setError] = useState("");
  const counters = sheet.counters ?? [];
  const patch = (id: string, change: Partial<ResourceCounter>) => onUpdate((next) => { next.counters = (next.counters ?? []).map((counter) => counter.id === id ? { ...counter, ...change } : counter); return next; });
  const addCounter = () => {
    const label = name.trim();
    if (!label) return;
    const max = Math.max(1, Math.floor(maximum) || 1);
    onUpdate((next) => { (next.counters ??= []).push({ id: crypto.randomUUID(), name: label, current: max, max, recovery }); return next; });
    setName(""); setMaximum(1);
  };
  const completeRest = () => {
    if (!pendingRest) return;
    try {
      const result = pendingRest === "short" ? takeShortRest(sheet, diceToSpend) : takeLongRest(sheet);
      onUpdate(() => result.sheet);
      const label = pendingRest === "short" ? "Riposo breve" : "Riposo lungo";
      const summary = `${label} · ${sheet.name}: ${result.healed} PF recuperati${result.spentDice ? `, ${result.spentDice} dadi vita spesi (${result.rolls.join(", ")})` : ""}${result.restoredCounters.length ? ` · risorse: ${result.restoredCounters.join(", ")}` : ""}`;
      onRest(summary);
      setDiceToSpend(0); setError(""); setPendingRest(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Riposo non disponibile"); setPendingRest(null); }
  };
  const hp = effectiveSheet(sheet).combat.hp;
  return <div className="stack">
    <Card className="resource-panel"><div className="editor-heading"><h2>Risorse</h2><small>Contatori personali</small></div>
      {counters.map((counter) => <div className="resource-row" key={counter.id}>
        <Input aria-label="Nome contatore" value={counter.name} onChange={(event) => patch(counter.id, { name: event.target.value })}/>
        <div className="resource-amount"><Button variant="outline" aria-label={`Riduci ${counter.name}`} onClick={() => patch(counter.id, { current: Math.max(0, counter.current - 1) })}>−</Button><strong>{counter.current} / {counter.max}</strong><Button variant="outline" aria-label={`Aumenta ${counter.name}`} onClick={() => patch(counter.id, { current: Math.min(counter.max, counter.current + 1) })}>+</Button></div>
        <label>Massimo <Input type="number" min="1" value={counter.max} onChange={(event) => { const max = Math.max(1, Math.floor(Number(event.target.value)) || 1); patch(counter.id, { max, current: Math.min(counter.current, max) }); }}/></label>
        <label>Recupero <Select value={counter.recovery} onChange={(event) => { if (isCounterRecovery(event.target.value)) patch(counter.id, { recovery: event.target.value }); }}><option value="none">Nessuno</option><option value="short">Riposo breve</option><option value="long">Riposo lungo</option></Select></label>
        <Button variant="destructive" aria-label={`Elimina ${counter.name}`} onClick={() => onUpdate((next) => { next.counters = (next.counters ?? []).filter((item) => item.id !== counter.id); return next; })}>×</Button>
      </div>)}
      <form className="resource-add" onSubmit={(event) => { event.preventDefault(); addCounter(); }}><Input aria-label="Nome nuova risorsa" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nuova risorsa"/><Input aria-label="Massimo nuova risorsa" type="number" min="1" value={maximum} onChange={(event) => setMaximum(Number(event.target.value))}/><Select aria-label="Recupero nuova risorsa" value={recovery} onChange={(event) => { if (isCounterRecovery(event.target.value)) setRecovery(event.target.value); }}><option value="none">Nessuno</option><option value="short">Riposo breve</option><option value="long">Riposo lungo</option></Select><Button disabled={!name.trim()}>Aggiungi</Button></form>
    </Card>
    <Card className="resource-panel"><h2>Riposi</h2><p>PF {sheet.combat.hp.current}/{hp.max} · Dadi vita disponibili {sheet.combat.hitDice.current}/{sheet.combat.hitDice.max}</p><label className="rest-slot-recovery">Recupero slot incantesimo <Select aria-label="Recupero slot incantesimo" value={sheet.spellcasting.slotRecovery ?? "long"} onChange={(event) => onUpdate((next) => { next.spellcasting.slotRecovery = event.target.value === "short" ? "short" : "long"; return next; })}><option value="long">Riposo lungo</option><option value="short">Riposo breve (es. Magia del Patto)</option></Select></label><div className="rest-controls"><label>Dadi vita da spendere <Input aria-label="Dadi vita da spendere" type="number" min="0" max={sheet.combat.hitDice.current} value={diceToSpend} onChange={(event) => setDiceToSpend(Math.max(0, Math.floor(Number(event.target.value)) || 0))}/></label><Button variant="outline" onClick={() => setPendingRest("short")}>Riposo breve</Button><Button onClick={() => setPendingRest("long")}>Riposo lungo</Button></div>{error && <p role="alert" className="rest-error">{error}</p>}</Card>
    <Dialog open={pendingRest !== null} title={pendingRest === "short" ? "Conferma riposo breve" : "Conferma riposo lungo"} description={pendingRest === "short" ? `Spenderai ${diceToSpend} dadi vita; i contatori da riposo breve saranno ripristinati.` : "Ripristinerai PF, slot, dadi vita e contatori configurati. I PF temporanei termineranno."} onClose={() => setPendingRest(null)}><div className="rest-actions"><Button variant="outline" onClick={() => setPendingRest(null)}>Annulla</Button><Button onClick={completeRest}>Completa riposo</Button></div></Dialog>
  </div>;
}
