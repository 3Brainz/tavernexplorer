import type { MonsterSheet } from "./types";

export function mergeMonsters(existing: MonsterSheet[], selected: MonsterSheet[]): MonsterSheet[] {
  const next = [...existing];
  for (const monster of selected) {
    const duplicate = next.findIndex((item) => item.name === monster.name && item.source === monster.source);
    if (duplicate >= 0) next[duplicate] = { ...monster, id: next[duplicate].id };
    else next.push(monster);
  }
  return next;
}
