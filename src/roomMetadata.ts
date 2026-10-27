import OBR from "@owlbear-rodeo/sdk";

// OBR.room metadata is documented as under 16 kB total:
// https://docs.owlbear.rodeo/extensions/apis/room/#setmetadata
// 14,000 bytes is this app's safety margin, not the account's 200 MB cloud quota.
export const ROOM_METADATA_BUDGET = 14_000;

export function roomMetadataBytes(value: Record<string, unknown>): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function assertRoomMetadataFits(current: Record<string, unknown>, update: Record<string, unknown>): void {
  const nextSize = roomMetadataBytes({ ...current, ...update });
  if (nextSize > ROOM_METADATA_BUDGET && nextSize >= roomMetadataBytes(current)) {
    throw new Error(`La stanza Owlbear ha esaurito lo spazio condiviso (${nextSize} byte). Esporta un TavernPack e riduci schede, note o inventario condivisi.`);
  }
}

export async function writeRoomMetadata(update: Record<string, unknown>): Promise<void> {
  const current = await OBR.room.getMetadata();
  assertRoomMetadataFits(current, update);
  await OBR.room.setMetadata(update);
}
