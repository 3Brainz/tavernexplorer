import { useState, type FormEvent } from "react";
import { applyHitPointAction, type HitPointAction } from "./hitPoints";
import type { CharacterSheet } from "./types";
import { Button, Input, Select } from "./ui";

interface HitPointControlProps {
  sheet: CharacterSheet;
  editable: boolean;
  onUpdate: (update: (sheet: CharacterSheet) => CharacterSheet) => void;
}

const ACTION_LABELS: Record<HitPointAction, string> = { damage: "Danni", heal: "Cure", temporary: "PF temporanei" };
const isHitPointAction = (value: string): value is HitPointAction => value === "damage" || value === "heal" || value === "temporary";

export function HitPointControl({ sheet, editable, onUpdate }: HitPointControlProps) {
  const [action, setAction] = useState<HitPointAction>("damage");
  const [amount, setAmount] = useState("1");
  const value = Number(amount);
  const valid = Number.isSafeInteger(value) && value > 0;
  const next = valid ? applyHitPointAction(sheet.combat, action, value) : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!editable || !valid) return;
    onUpdate((current) => {
      current.combat = applyHitPointAction(current.combat, action, value, sheet.combat.hp.max);
      return current;
    });
  };

  return <section className="paper hit-point-control">
    <div className="hit-point-heading"><h2>Punti ferita</h2><strong>{sheet.combat.hp.current} / {sheet.combat.hp.max}</strong>{sheet.combat.hp.temp > 0 && <span>+{sheet.combat.hp.temp} temporanei</span>}</div>
    {editable && <form onSubmit={submit} className="hit-point-form">
      <Select aria-label="Tipo di modifica PF" value={action} onChange={(event) => { if (isHitPointAction(event.target.value)) setAction(event.target.value); }}>
        {Object.entries(ACTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </Select>
      <Input aria-label="Quantità PF" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)}/>
      <Button disabled={!valid}>Applica</Button>
    </form>}
    {editable && next && <p className="hit-point-preview">Dopo {ACTION_LABELS[action].toLowerCase()}: {next.hp.current}/{sheet.combat.hp.max} PF{next.hp.temp > 0 ? ` · ${next.hp.temp} temporanei` : ""}</p>}
    {editable && action === "damage" && sheet.combat.hp.current === 0 && valid && value > sheet.combat.hp.temp && <small className="hit-point-warning">A 0 PF controlla manualmente i tiri salvezza contro la morte e il danno massiccio.</small>}
    {editable && action === "temporary" && <small className="hit-point-note">I PF temporanei non si sommano: resta il valore più alto.</small>}
  </section>;
}
