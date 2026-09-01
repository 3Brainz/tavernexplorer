import type { CharacterSheet } from "./types";

export interface Ruleset {
  id: string;
  version: string;
  label: string;
  proficiencyBonus(level: number): number;
  spellSaveDc(abilityModifier: number, proficiencyBonus: number): number;
  criticalDamage(formula: string): string;
  normalizeAfterImport(sheet: CharacterSheet): string[];
}

function doubleDamageDice(formula: string): string {
  return formula.replace(/(\d*)d(\d+)/gi, (_, count: string, faces: string) =>
    `${(Number(count || 1) * 2)}d${faces}`,
  );
}

export const dnd55: Ruleset = {
  id: "dnd-5.5",
  version: "2024.1",
  label: "D&D 5.5 (regole 2024)",
  proficiencyBonus(level) {
    return 2 + Math.floor((Math.max(1, level) - 1) / 4);
  },
  spellSaveDc(abilityModifier, proficiencyBonus) {
    return 8 + abilityModifier + proficiencyBonus;
  },
  criticalDamage: doubleDamageDice,
  normalizeAfterImport(sheet) {
    const warnings: string[] = [];
    const expectedPb = this.proficiencyBonus(sheet.identity.level);
    if (sheet.combat.proficiencyBonus !== expectedPb) {
      warnings.push(
        `Bonus di competenza importato ${sheet.combat.proficiencyBonus >= 0 ? "+" : ""}${sheet.combat.proficiencyBonus}; per il livello ${sheet.identity.level} il profilo ${this.label} prevede +${expectedPb}. Il valore importato è stato conservato.`,
      );
    }
    if (!sheet.name.trim()) warnings.push("Nome del personaggio mancante.");
    if (!sheet.combat.speed.trim()) warnings.push("Velocità mancante.");
    return warnings;
  },
};

export const dnd5e: Ruleset = { ...dnd55, id: "dnd-5e-2014", version: "2014.1", label: "D&D 5e (regole 2014)" };
export const RULESETS: Record<string, Ruleset> = { [dnd55.id]: dnd55, [dnd5e.id]: dnd5e };
export const DEFAULT_RULESET = dnd55;

export function getRuleset(id: string): Ruleset {
  return RULESETS[id] ?? DEFAULT_RULESET;
}
