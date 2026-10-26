import { expect, it, vi } from "vitest";
import { importRoll20 } from "./importer";

const room = vi.hoisted((): { metadata: Record<string, unknown>; playerId: string; role: "GM" | "PLAYER"; writes: number } => ({ metadata: {}, playerId: "author", role: "PLAYER", writes: 0 }));

vi.mock("@owlbear-rodeo/sdk", () => ({ default: {
  isAvailable: true,
  player: { getId: async () => room.playerId, getName: async () => room.playerId, getRole: async () => room.role },
  room: { getMetadata: async () => room.metadata, setMetadata: async (value: Record<string, unknown>) => { room.metadata = { ...room.metadata, ...value }; room.writes += 1; } },
} }));

it("non ripubblica schede identiche e blocca una sovrascrittura dopo modifiche remote", async () => {
  const { getSharedSheets, publishSharedSheets, updateSharedSheet } = await import("./obr");
  const sheet = importRoll20({ character: { name: "Eroe" }, normalized: { identity: { character_name: "Eroe" } } });
  sheet.sharing = "party";
  await publishSharedSheets([sheet]);
  expect(room.writes).toBe(1);
  await publishSharedSheets([sheet]);
  expect(room.writes).toBe(1);

  room.playerId = "gm"; room.role = "GM";
  const remote = (await getSharedSheets())[0];
  await updateSharedSheet(sheet.id, { ...remote.sheet, biography: "Modifica del GM" }, remote.updatedAt);
  room.playerId = "author"; room.role = "PLAYER";
  await expect(publishSharedSheets([{ ...sheet, biography: "Modifica locale" }])).rejects.toThrow("scegli quale versione");
  expect((await getSharedSheets())[0].sheet.biography).toBe("Modifica del GM");
});
