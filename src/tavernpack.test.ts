import { describe, expect, it } from "vitest";
import { parseCharacterSheet, parseTavernPack } from "./tavernpack";

const pack = () => ({ format: "tavernpack", formatVersion: "1.0.0", data: { characters: [], monsters: [], campaigns: [], sharedInventory: [], notes: [] } });

describe("TavernPack validation", () => {
  it("accetta un backup vuoto valido", () => {
    expect(parseTavernPack(pack()).data.notes).toEqual([]);
  });

  it("rifiuta un backup incompleto prima di sostituire i dati", () => {
    expect(() => parseTavernPack({ ...pack(), data: { characters: [] } })).toThrow("TavernPack: mostri");
    expect(() => parseTavernPack({ ...pack(), data: { ...pack().data, characters: [{ id: "broken" }] } })).toThrow("TavernPack: schede");
  });

  it("rifiuta una scheda JSON parziale", () => {
    expect(() => parseCharacterSheet({ schemaVersion: 1, id: "x", name: "X" })).toThrow("scheda: identità");
  });

  it("conserva le cartelle e rifiuta riferimenti malformati", () => {
    const organization = { folders: [{ id: "f1", name: "Indizi" }], placements: { n1: "f1" } };
    expect(parseTavernPack({ ...pack(), data: { ...pack().data, noteOrganization: organization } }).data.noteOrganization).toEqual(organization);
    expect(() => parseTavernPack({ ...pack(), data: { ...pack().data, noteOrganization: { folders: [], placements: { n1: 5 } } } })).toThrow("cartelle");
  });
});
