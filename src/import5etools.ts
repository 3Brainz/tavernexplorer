import { DEFAULT_RULESET } from "./rulesets";
import type { ActionEntry, CampaignChapter, CampaignDocument, MonsterSheet, TraitEntry } from "./types";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => value == null ? "" : String(value);
const number = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const uid = () => crypto.randomUUID();

function stripTags(value: string): string {
  return value
    .replace(/\{@(?:hit|dc) ([^}|]+)(?:\|[^}]*)?}/g, "$1")
    .replace(/\{@(?:damage|dice) ([^}|]+)(?:\|[^}]*)?}/g, "$1")
    .replace(/\{@\w+ ([^}|]+)(?:\|[^}]*)?}/g, "$1")
    .replace(/\{@\w+}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function renderEntries(entries: unknown): string {
  if (typeof entries === "string") return stripTags(entries);
  if (typeof entries === "number") return String(entries);
  if (Array.isArray(entries)) return entries.map(renderEntries).filter(Boolean).join("\n\n");
  const entry = obj(entries);
  if (!Object.keys(entry).length) return "";
  if (entry.type === "list") return array(entry.items).map((item) => `• ${renderEntries(item)}`).join("\n");
  if (entry.type === "table") {
    const header = array(entry.colLabels).map(text).join(" | ");
    const rows = array(entry.rows).map((row) => array(row).map(renderEntries).join(" | ")).join("\n");
    return [header, rows].filter(Boolean).join("\n");
  }
  const name = text(entry.name);
  const body = renderEntries(entry.entries ?? entry.entry ?? entry.items);
  return [name && `${stripTags(name)}:`, body].filter(Boolean).join(" ").trim();
}

function firstRollFormula(value: string): string | undefined {
  return value.match(/\b\d+d\d+(?:\s*[+-]\s*\d+)?\b/i)?.[0].replace(/\s+/g, "");
}

function parseAttackBonus(raw: unknown, rendered: string): number | undefined {
  const serialized = JSON.stringify(raw);
  const tagged = /\{@hit\s+([+-]?\d+)/.exec(serialized);
  const plain = /(?:Melee|Ranged|Spell) Attack:\s*([+-]\d+)/i.exec(rendered);
  const value = tagged?.[1] ?? plain?.[1];
  return value == null ? undefined : number(value);
}

function importEntries(value: unknown, source: string): ActionEntry[] {
  return array(value).map((raw) => {
    const entry = obj(raw);
    const description = renderEntries(entry.entries ?? entry.entry);
    const damageMatches = [...description.matchAll(/\b\d+d\d+(?:\s*[+-]\s*\d+)?\b/gi)];
    return {
      id: uid(), name: stripTags(text(entry.name)) || "Azione", source,
      attackBonus: parseAttackBonus(raw, description), damage: damageMatches.at(-1)?.[0].replace(/\s+/g, "") ?? firstRollFormula(description),
      saveDc: number(JSON.stringify(raw).match(/\{@dc\s+(\d+)/)?.[1]) || undefined,
      description,
    };
  });
}

function importTraits(value: unknown): TraitEntry[] {
  return array(value).map((raw) => { const entry = obj(raw); return { id: uid(), name: stripTags(text(entry.name)) || "Tratto", description: renderEntries(entry.entries), source: "5e.tools" }; });
}

function readAc(value: unknown): number {
  const first = array(value)[0] ?? value;
  return typeof first === "number" ? first : number(obj(first).ac);
}

function readSpeed(value: unknown): string {
  const speed = obj(value);
  return Object.entries(speed).map(([key, raw]) => {
    const amount = typeof raw === "object" ? obj(raw).number : raw;
    return `${key === "walk" ? "" : `${key} `}${text(amount)} ft.`.trim();
  }).filter((entry) => !entry.includes("undefined")).join(", ");
}

function readType(value: unknown): string {
  if (typeof value === "string") return value;
  const type = obj(value);
  return [text(type.type), array(type.tags).map((tag) => typeof tag === "string" ? tag : text(obj(tag).tag)).filter(Boolean).join(", ")].filter(Boolean).join(" (") + (array(type.tags).length ? ")" : "");
}

function imageUrl(monster: Obj): string | undefined {
  const token = obj(monster.tokenUrl ?? monster.token);
  const direct = text(monster.tokenUrl || monster.image);
  return direct || text(token.url) || undefined;
}

export function import5eToolsMonsters(source: unknown): MonsterSheet[] {
  const root = obj(source);
  const monsters = array(root.monster);
  if (!monsters.length) throw new Error("Il JSON 5e.tools non contiene un array monster");
  return monsters.map((raw): MonsterSheet => {
    const monster = obj(raw); const hp = obj(monster.hp);
    const abilities = Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map((key) => [key, number(monster[key])]));
    return {
      schemaVersion: 1, id: uid(), ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version },
      name: text(monster.name) || "Mostro senza nome", source: text(monster.source), size: array(monster.size).map(text).join("/") || text(monster.size),
      creatureType: readType(monster.type), alignment: array(monster.alignment).map(text).join(" "), challengeRating: text(typeof monster.cr === "object" ? obj(monster.cr).cr : monster.cr),
      ac: readAc(monster.ac), hp: { average: number(hp.average), formula: text(hp.formula) }, speed: readSpeed(monster.speed), abilities,
      saves: Object.fromEntries(Object.entries(obj(monster.save)).map(([key, value]) => [key, number(value)])),
      skills: Object.fromEntries(Object.entries(obj(monster.skill)).map(([key, value]) => [key, number(value)])), passivePerception: number(monster.passive),
      traits: importTraits(monster.trait), actions: importEntries(monster.action, "action"), reactions: importEntries(monster.reaction, "reaction"),
      legendaryActions: importEntries(monster.legendary, "legendary"), image: imageUrl(monster), importWarnings: [],
    };
  });
}

function collectImages(value: unknown): Array<{ title: string; url: string; kind: "map" | "mapPlayer" | "image" }> {
  const found: Array<{ title: string; url: string; kind: "map" | "mapPlayer" | "image" }> = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const entry = obj(node); if (!Object.keys(entry).length) return;
    if (entry.type === "image") {
      const href = obj(entry.href); const rawUrl = text(href.url || href.path);
      const url = href.type === "internal" || (!/^https?:/i.test(rawUrl) && rawUrl) ? `https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/${rawUrl.replace(/^img\//, "")}` : rawUrl;
      const imageType = text(entry.imageType); const kind = imageType === "map" || imageType === "mapPlayer" ? imageType : "image";
      if (url) found.push({ title: text(entry.title || entry.name) || (kind === "image" ? "Immagine" : "Mappa"), url, kind });
    }
    Object.values(entry).forEach(visit);
  };
  visit(value); return found;
}

function toChapter(raw: unknown, index: number): CampaignChapter {
  const entry = obj(raw);
  const nested = array(entry.entries).filter((child) => ["section", "entries", "chapter"].includes(text(obj(child).type)) && text(obj(child).name));
  return { id: uid(), title: stripTags(text(entry.name)) || `Capitolo ${index + 1}`, body: renderEntries(entry.entries), children: nested.map(toChapter), images: collectImages(entry) };
}

export function import5eToolsCampaign(source: unknown): CampaignDocument {
  const root = obj(source);
  const data = array(root.data);
  if (!data.length) throw new Error("Il JSON 5e.tools non contiene dati di avventura (`data`)");
  const metadata = obj(array(root.adventure)[0] ?? array(root.book)[0]);
  return { schemaVersion: 1, id: uid(), title: text(metadata.name) || text(root.name) || "Avventura importata", source: text(metadata.source), ruleset: { id: DEFAULT_RULESET.id, version: DEFAULT_RULESET.version }, chapters: data.map(toChapter), importedAt: Date.now() };
}
