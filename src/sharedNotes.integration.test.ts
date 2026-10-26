import { beforeEach, expect, it, vi } from "vitest";
import type { SharedNote } from "./types";

const room = vi.hoisted((): { metadata: Record<string, unknown>; playerId: string; role: "GM" | "PLAYER" } => ({
  metadata: {},
  playerId: "author",
  role: "PLAYER",
}));

vi.mock("@owlbear-rodeo/sdk", () => ({ default: {
  isAvailable: true,
  player: { getId: async () => room.playerId, getName: async () => room.playerId, getRole: async () => room.role },
  room: { getMetadata: async () => room.metadata, setMetadata: async (value: Record<string, unknown>) => { room.metadata = { ...room.metadata, ...value }; } },
} }));

const sample = (): SharedNote => ({ id: "n1", title: "Indizio", body: "Una porta", ownerId: "author", ownerName: "Autore", writePermission: "owner-gm", updatedAt: 1 });

beforeEach(() => { room.metadata = {}; room.playerId = "author"; room.role = "PLAYER"; });

it("pubblica una nota e permette al GM di modificarla", async () => {
  const { getSharedNotes, saveSharedNote } = await import("./obr");
  await saveSharedNote(sample());
  expect(await getSharedNotes()).toHaveLength(1);
  room.playerId = "gm"; room.role = "GM";
  const note = (await getSharedNotes())[0];
  await saveSharedNote({ ...note, body: "Una porta segreta" });
  expect((await getSharedNotes())[0].body).toBe("Una porta segreta");
});

it("blocca scrittura non autorizzata e versione obsoleta", async () => {
  const { saveSharedNote } = await import("./obr");
  await saveSharedNote(sample());
  room.playerId = "other";
  await expect(saveSharedNote({ ...sample(), body: "Sbagliato" })).rejects.toThrow("permesso");
  room.playerId = "author";
  await expect(saveSharedNote({ ...sample(), updatedAt: 0 })).rejects.toThrow("aggiornata");
});
