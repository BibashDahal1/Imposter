import { PACK_LOADERS } from "./manifest";
import type { PackFile } from "./types";

const cache = new Map<string, Promise<PackFile>>();

/** Opens one pack. Each pack is read once and then kept in memory. */
export function loadPack(id: string): Promise<PackFile> {
  const hit = cache.get(id);
  if (hit) return hit;

  const loader = PACK_LOADERS[id];
  if (!loader) return Promise.reject(new Error(`Unknown word pack: ${id}`));

  const promise = loader().catch((error: unknown) => {
    cache.delete(id); // let the next call try again
    throw error;
  });
  cache.set(id, promise);
  return promise;
}
