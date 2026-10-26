import type { NoteWritePermission, SharedNote } from "./types";

export function canWriteNote(note: SharedNote, playerId: string, role: "GM" | "PLAYER"): boolean {
  return note.ownerId === playerId || note.writePermission === "party" || note.writePermission === "owner-gm" && role === "GM";
}

export function canManageNote(note: SharedNote, playerId: string): boolean {
  return note.ownerId === playerId;
}

export function isWritePermission(value: unknown): value is NoteWritePermission {
  return value === "owner" || value === "owner-gm" || value === "party";
}

export function readSharedNotes(value: unknown): SharedNote[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SharedNote => !!item && typeof item === "object" &&
    typeof item.id === "string" && typeof item.title === "string" && typeof item.body === "string" &&
    typeof item.ownerId === "string" && typeof item.ownerName === "string" &&
    typeof item.updatedAt === "number" && isWritePermission(item.writePermission));
}
