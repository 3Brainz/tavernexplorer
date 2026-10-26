// @vitest-environment jsdom
import { beforeAll, beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  ready: null as null | (() => Promise<void>),
  menus: [] as Array<{ id: string; onClick: (context: { items: Array<{ id: string; name: string; metadata: Record<string, unknown> }> }, elementId: string) => Promise<void> }>,
  role: "PLAYER" as "GM" | "PLAYER",
  updateItems: vi.fn(),
  open: vi.fn(),
  setMetadata: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@owlbear-rodeo/sdk", () => ({ default: {
  onReady: (callback: () => Promise<void>) => { mock.ready = callback; },
  contextMenu: { create: async (menu: typeof mock.menus[number]) => { mock.menus.push(menu); } },
  player: { getRole: async () => mock.role, getMetadata: async () => ({}) },
  room: { getMetadata: async () => ({}), setMetadata: mock.setMetadata },
  scene: { items: { updateItems: mock.updateItems } },
  notification: { show: mock.notify },
  popover: { open: mock.open },
} }));

beforeAll(async () => { await import("./background"); await mock.ready?.(); });
beforeEach(() => { mock.updateItems.mockClear(); mock.open.mockClear(); mock.setMetadata.mockClear(); mock.notify.mockClear(); mock.role = "PLAYER"; });

it("apre il token senza collegarlo di nascosto alla scheda attiva", async () => {
  const menu = mock.menus.find((item) => item.id.endsWith("/token-menu"))!;
  await menu.onClick({ items: [{ id: "token-1", name: "Lupo", metadata: {} }] }, "button-1");
  expect(mock.updateItems).not.toHaveBeenCalled();
  expect(mock.open).toHaveBeenCalledWith(expect.objectContaining({ url: "/?token=token-1" }));
});

it("blocca il menu iniziativa per un giocatore senza permesso", async () => {
  const menu = mock.menus.find((item) => item.id.endsWith("/initiative-menu"))!;
  await menu.onClick({ items: [{ id: "token-1", name: "Lupo", metadata: {} }] }, "button-1");
  expect(mock.setMetadata).not.toHaveBeenCalled();
  expect(mock.notify).toHaveBeenCalled();
});
