// @vitest-environment jsdom
import { expect, it } from "vitest";
import { assertRoomMetadataFits, roomMetadataBytes } from "./roomMetadata";

it("misura UTF-8 e considera tutte le chiavi, non solo la nuova nota", () => {
  expect(roomMetadataBytes({ text: "è" })).toBeGreaterThan(JSON.stringify({ text: "è" }).length);
  expect(() => assertRoomMetadataFits({ other: "x".repeat(13_900) }, { notes: "y".repeat(200) })).toThrow("esaurito");
});

it("permette di ridurre dati anche quando la stanza è già oltre soglia", () => {
  expect(() => assertRoomMetadataFits({ notes: "x".repeat(15_000) }, { notes: "" })).not.toThrow();
});
