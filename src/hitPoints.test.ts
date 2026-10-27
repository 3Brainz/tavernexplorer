import { expect, it } from "vitest";
import { applyHitPointAction } from "./hitPoints";
import type { CharacterSheet } from "./types";

const combat = (): CharacterSheet["combat"] => ({
  ac: 12, hp: { current: 8, max: 20, temp: 5 }, speed: "30 ft", initiative: 1,
  proficiencyBonus: 2, passivePerception: 10, inspiration: false,
  hitDice: { current: 1, max: 1, die: "d8" }, deathSaves: { successes: 1, failures: 2 },
});

it("scala prima i PF temporanei e non muta la scheda originale", () => {
  const original = combat();
  expect(applyHitPointAction(original, "damage", 3).hp).toEqual({ current: 8, max: 20, temp: 2 });
  expect(applyHitPointAction(original, "damage", 9).hp).toEqual({ current: 4, max: 20, temp: 0 });
  expect(original.hp).toEqual({ current: 8, max: 20, temp: 5 });
});

it("limita le cure al massimo effettivo e azzera i salvataggi morte", () => {
  const result = applyHitPointAction(combat(), "heal", 30, 24);
  expect(result.hp).toEqual({ current: 24, max: 20, temp: 5 });
  expect(result.deathSaves).toEqual({ successes: 0, failures: 0 });
  const aboveMax = { ...combat(), hp: { current: 25, max: 20, temp: 0 } };
  expect(applyHitPointAction(aboveMax, "heal", 5).hp.current).toBe(25);
});

it("non somma i PF temporanei e lascia invariati i salvataggi morte", () => {
  expect(applyHitPointAction(combat(), "temporary", 3).hp.temp).toBe(5);
  const result = applyHitPointAction(combat(), "temporary", 9);
  expect(result.hp.temp).toBe(9);
  expect(result.deathSaves.failures).toBe(2);
});

it("rifiuta valori non interi o non positivi", () => {
  expect(() => applyHitPointAction(combat(), "damage", 0)).toThrow();
  expect(() => applyHitPointAction(combat(), "heal", 1.5)).toThrow();
});
