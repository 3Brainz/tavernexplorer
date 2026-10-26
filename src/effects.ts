import type { CharacterSheet, StatModifier } from "./types";

export const MODIFIER_TARGETS = [
  ["ac", "Classe armatura"], ["initiative", "Iniziativa"], ["hpMax", "PF massimi"],
  ["passivePerception", "Percezione passiva"], ["spellSaveDc", "CD incantesimi"],
  ["spellAttack", "Attacco incantesimi"], ["attack", "Tiri per colpire"], ["damage", "Danni"],
  ...["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].flatMap((ability) => [
    [`ability:${ability}`, `Punteggio ${ability}`], [`save:${ability}`, `TS ${ability}`],
  ]),
  ...["acrobatics", "animal_handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight_of_hand", "stealth", "survival"].map((skill) => [`skill:${skill}`, `Abilità ${skill}`]),
];

export function activeModifiers(sheet: CharacterSheet): StatModifier[] {
  return [
    ...(sheet.effects ?? []).filter((effect) => effect.active && (effect.remainingRounds === undefined || effect.remainingRounds > 0)).flatMap((effect) => effect.modifiers),
    ...sheet.inventory.filter((item) => item.equipped && (item.count === null || item.count > 0)).flatMap((item) => item.modifiers ?? []),
  ].filter((modifier) => Number.isFinite(modifier.amount));
}

export function modifierTotal(sheet: CharacterSheet, target: string): number {
  return activeModifiers(sheet).filter((modifier) => modifier.target === target).reduce((sum, modifier) => sum + modifier.amount, 0);
}

export function effectiveSheet(sheet: CharacterSheet): CharacterSheet {
  const result = structuredClone(sheet);
  const mods = activeModifiers(sheet);
  const total = (target: string) => mods.filter((mod) => mod.target === target).reduce((sum, mod) => sum + mod.amount, 0);
  for (const [key, ability] of Object.entries(result.abilities)) {
    const previousMod = ability.mod;
    ability.score += total(`ability:${key}`);
    ability.mod = Math.floor((ability.score - 10) / 2);
    ability.save += ability.mod - previousMod + total(`save:${key}`);
    for (const skill of Object.values(result.skills)) if (skill.ability === key) skill.bonus += ability.mod - previousMod;
    if (key === "dexterity") result.combat.initiative += ability.mod - previousMod;
    if (result.skills.perception?.ability === key) result.combat.passivePerception += ability.mod - previousMod;
    if (result.spellcasting.ability === key) { result.spellcasting.saveDc += ability.mod - previousMod; result.spellcasting.attackBonus += ability.mod - previousMod; }
  }
  for (const [key, skill] of Object.entries(result.skills)) skill.bonus += total(`skill:${key}`);
  result.combat.ac += total("ac");
  result.combat.initiative += total("initiative");
  result.combat.hp.max += total("hpMax");
  result.combat.passivePerception += total("passivePerception") + total("skill:perception");
  result.spellcasting.saveDc += total("spellSaveDc");
  result.spellcasting.attackBonus += total("spellAttack");
  return result;
}
