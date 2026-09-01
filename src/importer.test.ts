// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { importRoll20 } from "./importer";

const fixture = {
  _meta: { sheet: "ogl5e", version: "1.2" },
  character: { id: "roll20-1", name: "Duston", bio_text: "%3Cp%3ECiao%20%u2019oste%3C%2Fp%3E" },
  normalized: {
    identity: { character_name: "", race: "Umano", class: "Warlock", subclass: "Fiend", class_display: "Fiend Warlock 4", level: 4, experience: "4400" },
    combat: { ac: 12, hp: { current: 35, max: 35 }, hit_dice: { current: 4, max: 4 }, initiative: 1, proficiency_bonus: 2, passive_perception: 11, speed: "6q" },
    abilities: { charisma: { score: 18, mod: 4, save: 6, save_proficient: true } },
    skills: { persuasion: { ability: "charisma", bonus: 6, proficient: true } },
    spellcasting: { save_dc: 14, attack_bonus: 6, slots: { level_2: { total: 2, expended: 1 } }, spells: { cantrips: [{ name: "Eldritch Blast", level: 0, description: "Infligge 1d10 danni da forza." }] } },
    attacks: [{ name: "Eldritch Blast", attack_bonus: "+6", damage: "1d10 + 4", damage_type: "forza", _rowid: "attack-1" }],
    inventory: [{ name: "Dagger", count: 2, _rowid: "item-1" }],
    traits: [{ name: "Lucky", source: "Talento", description: "Fortunato", _rowid: "trait-1" }],
    currency: { gp: 8 },
  },
};

describe("import Roll20 ogl5e", () => {
  it("usa normalized come fonte e applica il profilo versionato", () => {
    const sheet = importRoll20(fixture);
    expect(sheet.name).toBe("Duston");
    expect(sheet.ruleset).toEqual({ id: "dnd-5.5", version: "2024.1" });
    expect(sheet.actions[0]).toMatchObject({ name: "Eldritch Blast", attackBonus: 6, damage: "1d10+4" });
    expect(sheet.spells[0]).toMatchObject({ name: "Eldritch Blast", damage: "1d10+4" });
    expect(sheet.spellcasting.slots.level_2).toEqual({ total: 2, used: 1 });
    expect(sheet.biography).toBe("Ciao ’oste");
    expect(sheet.importWarnings.some((warning) => warning.includes("character.name"))).toBe(true);
  });

  it("rifiuta sheet diverse da ogl5e", () => {
    expect(() => importRoll20({ ...fixture, _meta: { sheet: "pathfinder", version: "1.2" } })).toThrow("non supportata");
  });
});
