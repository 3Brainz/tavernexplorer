import { useState, type FormEvent } from "react";
import { addTurnCondition, removeTurnCondition, replaceTurnEntries, setTurnInitiative } from "./turns";
import type { CharacterSheet, TurnEntry, TurnState } from "./types";

const CONDITION_SUGGESTIONS = ["Accecato", "Affascinato", "Afferrato", "Assordato", "Avvelenato", "Incapacitato", "Invisibile", "Paralizzato", "Pietrificato", "Prono", "Spaventato", "Stordito", "Trattenuto"];

function ConditionEditor({ entry, state, canManage, onChange, onRollInitiative }: { entry: TurnEntry; state: TurnState; canManage: boolean; onChange: (state: TurnState) => void; onRollInitiative: (entry: TurnEntry) => void }) {
  const [name, setName] = useState("");
  const [rounds, setRounds] = useState("");
  const conditions = entry.conditions ?? [];
  const add = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const remainingRounds = rounds ? Number(rounds) : undefined;
    if (remainingRounds !== undefined && (!Number.isInteger(remainingRounds) || remainingRounds < 1)) return;
    onChange(addTurnCondition(state, entry.id, { id: crypto.randomUUID(), name: trimmed, remainingRounds }));
    setName(""); setRounds("");
  };
  return <details className="turn-details"><summary>{conditions.length ? `${conditions.length} ${conditions.length === 1 ? "condizione" : "condizioni"}` : "Condizioni e iniziativa"}</summary>
    <div className="turn-condition-list">{conditions.map((condition) => <span className="turn-condition" key={condition.id}>{condition.name}{condition.remainingRounds != null && <small> · {condition.remainingRounds} round</small>}{canManage && <button aria-label={`Rimuovi ${condition.name}`} onClick={() => onChange(removeTurnCondition(state, entry.id, condition.id))}>×</button>}</span>)}{conditions.length === 0 && <small>Nessuna condizione attiva.</small>}</div>
    {canManage && <><form className="turn-condition-form" onSubmit={add}><input aria-label={`Condizione per ${entry.name}`} list="turn-condition-suggestions" value={name} onChange={(event) => setName(event.target.value)} placeholder="Condizione"/><input aria-label="Durata in round" type="number" min="1" max="99" value={rounds} onChange={(event) => setRounds(event.target.value)} placeholder="∞" title="Vuoto = fino alla rimozione manuale"/><button disabled={!name.trim()}>Aggiungi</button></form><div className="turn-initiative-roll"><label>Bonus iniziativa <input aria-label={`Bonus iniziativa di ${entry.name}`} type="number" value={entry.initiativeBonus ?? 0} onChange={(event) => onChange({ ...state, entries: state.entries.map((item) => item.id === entry.id ? { ...item, initiativeBonus: Number(event.target.value) || 0 } : item) })}/></label><button onClick={() => onRollInitiative(entry)}>Tira d20</button></div></>}
  </details>;
}

interface TurnOrderProps {
  state: TurnState;
  canManage: boolean;
  onChange: (state: TurnState) => void;
  onNext: () => void;
  onPrevious: () => void;
  onRollInitiative: (entry: TurnEntry) => void;
  onFocusToken?: (tokenId: string) => void;
  active: CharacterSheet | null;
  onAttach: () => void;
}

export function TurnOrder({ state, canManage, onChange, onNext, onPrevious, onRollInitiative, onFocusToken, active, onAttach }: TurnOrderProps) {
  return <div className="stack">
    <section className="turn-header">
      <div><small>Round</small><strong>{state.round}</strong></div>
      <div className="turn-navigation">
        <button onClick={onPrevious} disabled={!canManage || !state.entries.length || (state.round === 1 && state.activeIndex === 0)} aria-label="Turno precedente">←</button>
        <button onClick={onNext} disabled={!canManage || !state.entries.length}>Turno successivo →</button>
      </div>
    </section>
    <button className="primary" onClick={onAttach} disabled={!canManage || !active}>Collega scheda e token selezionato</button>
    <section className="turn-list">
      <datalist id="turn-condition-suggestions">{CONDITION_SUGGESTIONS.map((condition) => <option key={condition} value={condition}/>)}</datalist>
      {state.entries.length === 0 && <p className="turn-empty">Nessun partecipante. Seleziona un token sulla mappa e collegalo a una scheda.</p>}
      {state.entries.map((entry, index) => <article className={`turn-entry ${index === state.activeIndex ? "current" : ""}`} key={entry.id}>
        <div className="turn-entry-main">
          <span className="order">{index + 1}</span>
          <div><strong>{entry.name}</strong>{index === state.activeIndex && <small>Turno attuale</small>}</div>
          <input aria-label={`Iniziativa di ${entry.name}`} type="number" value={entry.initiative} disabled={!canManage} onChange={(event) => onChange(setTurnInitiative(state, entry.id, Number(event.target.value) || 0))}/>
          {entry.tokenId && onFocusToken && <button aria-label={`Trova ${entry.name} sulla mappa`} title="Trova sulla mappa" onClick={() => { if (entry.tokenId) onFocusToken(entry.tokenId); }}>⌖</button>}
          {canManage && <button className="danger" aria-label={`Rimuovi ${entry.name}`} onClick={() => onChange(replaceTurnEntries(state, state.entries.filter((item) => item.id !== entry.id)))}>×</button>}
        </div>
        <ConditionEditor entry={entry} state={state} canManage={canManage} onChange={onChange} onRollInitiative={onRollInitiative}/>
      </article>)}
    </section>
    {canManage && state.entries.length > 0 && <button onClick={() => onChange({ round: 1, activeIndex: 0, entries: [] })}>Svuota ordine</button>}
  </div>;
}
