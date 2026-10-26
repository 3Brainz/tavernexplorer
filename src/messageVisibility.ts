import type { ChatMessage } from "./types";

export function canViewMessage(message: ChatMessage, playerId: string, role: "GM" | "PLAYER"): boolean {
  if (message.visibility === "everyone") return true;
  if (message.visibility === "gm" && role === "GM") return true;
  if (message.visibility === "self" && !message.authorId) return true;
  return message.authorId === playerId;
}
