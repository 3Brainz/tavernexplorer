import type { CharacterSheet } from "./types";

export type HitPointAction = "damage" | "heal" | "temporary";
type Combat = CharacterSheet["combat"];

export function applyHitPointAction(combat: Combat, action: HitPointAction, amount: number, effectiveMax = combat.hp.max): Combat {
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("Inserisci un numero intero di PF maggiore di zero");
  const max = Math.max(0, effectiveMax);
  const hp = { ...combat.hp };
  let deathSaves = combat.deathSaves;

  if (action === "damage") {
    const absorbed = Math.min(hp.temp, amount);
    hp.temp -= absorbed;
    hp.current = Math.max(0, hp.current - (amount - absorbed));
  } else if (action === "heal") {
    hp.current = Math.max(hp.current, Math.min(max, hp.current + amount));
    if (hp.current > combat.hp.current) deathSaves = { successes: 0, failures: 0 };
  } else {
    hp.temp = Math.max(hp.temp, amount);
  }

  return { ...combat, hp, deathSaves };
}
