// @vitest-environment jsdom
// @ts-expect-error Node types are intentionally absent from the browser build.
import { webcrypto } from "node:crypto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { STORAGE_MONSTERS, STORAGE_NOTES } from "./constants";
import { DEFAULT_RULESET } from "./rulesets";
import type { MonsterSheet } from "./types";

vi.mock("./obr", () => ({
  OBR: { isAvailable: false, isReady: false },
  DEFAULT_PERMISSIONS: { playersEditInventory: true, playersImportContent: false, playersManageTurns: false },
}));
vi.mock("./fivetoolsApi", () => ({
  listBestiarySources: async () => [{ id: "XMM", label: "XMM", file: "bestiary-xmm.json" }],
  loadBestiarySource: async () => [
    { id: "wolf", name: "Lupo", source: "XMM", creatureType: "Bestia", challengeRating: "1/4" },
    { id: "dragon", name: "Drago", source: "XMM", creatureType: "Drago", challengeRating: "10" },
  ].map((row) => ({ ...row, schemaVersion: 1 as const, ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, size: "M", alignment: "N", ac: 12, hp: { average: 10, formula: "2d8" }, speed: "30 ft.", abilities: { dex: 12 }, saves: {}, skills: {}, passivePerception: 10, traits: [], actions: [], reactions: [], legendaryActions: [], importWarnings: [] })) as MonsterSheet[],
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const click = async (label: string) => {
  const button = [...host.querySelectorAll("button")].find((item) => item.textContent?.includes(label));
  expect(button, `Pulsante ${label}`).toBeTruthy();
  await act(async () => button!.click());
};

it("permette di creare una nota e importare un solo mostro dal picker", async () => {
  await act(async () => root.render(<App/>));
  await click("Note");
  await click("Nuova nota");
  expect(host.querySelector('input[aria-label="Titolo nota"]')).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(STORAGE_NOTES) || "[]")).toHaveLength(1);
  await click("Bestiario");
  await click("Scegli mostri");
  expect(host.textContent).toContain("2 mostri disponibili");
  const checkbox = host.querySelector<HTMLInputElement>('.monster-import-list input[type="checkbox"]');
  expect(checkbox).toBeTruthy();
  await act(async () => checkbox!.click());
  await click("Importa 1 mostro");
  expect(JSON.parse(localStorage.getItem(STORAGE_MONSTERS) || "[]")).toHaveLength(1);
  expect([...host.querySelectorAll("button")].filter((button) => button.textContent?.includes("← Bestiario"))).toHaveLength(1);
  await click("Bestiario");
  expect(host.textContent).toContain("Lupo");
  expect(host.textContent).not.toContain("Drago");
});
