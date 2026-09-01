import { describe, expect, it } from "vitest";
import { dnd55, getRuleset } from "./rulesets";

describe("profilo D&D 5.5", () => {
  it("calcola il bonus di competenza per fasce di livello", () => {
    expect([1, 4, 5, 8, 9, 13, 17, 20].map((level) => dnd55.proficiencyBonus(level)))
      .toEqual([2, 2, 3, 3, 4, 5, 6, 6]);
  });

  it("calcola CD e critici 2024", () => {
    expect(dnd55.spellSaveDc(4, 2)).toBe(14);
    expect(dnd55.criticalDamage("1d10+4")).toBe("2d10+4");
    expect(dnd55.criticalDamage("2d6+1d4+3")).toBe("4d6+2d4+3");
  });

  it("usa il profilo predefinito per id sconosciuti", () => {
    expect(getRuleset("futuro").id).toBe("dnd-5.5");
  });
});
