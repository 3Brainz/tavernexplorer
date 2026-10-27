import { expect, it, vi } from "vitest";
import { importRoll20 } from "./importer";
import type { SharedSheet, TurnEntry } from "./types";

vi.mock("@owlbear-rodeo/sdk", () => ({ default: {} }));

it("mostra solo stato utile e non espone condizioni nascoste ai giocatori", async () => {
  const { tokenStatusText } = await import("./tokenStatus");
  const sheet = importRoll20({ character: { name: "Ada" }, normalized: { identity: { character_name: "Ada" } } });
  sheet.combat.hp = { current: 8, max: 20, temp: 3 };
  const shared: SharedSheet = { sheet, ownerId: "player", ownerName: "Player", editors: [], updatedAt: 1 };
  const turn: TurnEntry = { id: "turn", name: "Ada", initiative: 10, hidden: true, conditions: [{ id: "c", name: "Avvelenato", remainingRounds: 2 }] };

  expect(tokenStatusText(shared, turn, "PLAYER")).toBe("PF 8/20 +3");
  expect(tokenStatusText(shared, turn, "GM")).toBe("PF 8/20 +3 | Avvelenato 2r");
  sheet.combat.hp = { current: 20, max: 20, temp: 0 };
  expect(tokenStatusText(shared, undefined, "PLAYER")).toBeNull();
});
