import { describe, expect, it } from "vitest";
import { canManageNote, canWriteNote, readSharedNotes } from "./sharedNotes";
import type { SharedNote } from "./types";

const note = (writePermission: SharedNote["writePermission"]): SharedNote => ({ id: "n", title: "Mappa", body: "Segreto", ownerId: "a", ownerName: "A", writePermission, updatedAt: 1 });

describe("permessi delle note condivise", () => {
  it("solo l'autore gestisce i permessi", () => {
    expect(canManageNote(note("party"), "a")).toBe(true);
    expect(canManageNote(note("party"), "gm")).toBe(false);
  });
  it("applica la scelta di scrittura a autore, GM e party", () => {
    expect(canWriteNote(note("owner"), "b", "PLAYER")).toBe(false);
    expect(canWriteNote(note("owner-gm"), "gm", "GM")).toBe(true);
    expect(canWriteNote(note("owner-gm"), "b", "PLAYER")).toBe(false);
    expect(canWriteNote(note("party"), "b", "PLAYER")).toBe(true);
  });
  it("ignora dati di stanza non validi", () => {
    expect(readSharedNotes([note("owner"), { id: "broken", writePermission: "unknown" }])).toHaveLength(1);
  });
});
