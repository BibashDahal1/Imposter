import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "imposter.seen.v1";
/** Remembers at most this many ids, dropping the oldest first. */
const MAX_IDS = 3000;

/** Ids of words already played on this device. Only ids are stored, never the words. */
export async function loadSeen(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(list)
        ? list.filter((x): x is string => typeof x === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export async function saveSeen(seen: Set<string>): Promise<void> {
  const list = [...seen];
  const trimmed =
    list.length > MAX_IDS ? list.slice(list.length - MAX_IDS) : list;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full or blocked: the game still works, words may just repeat sooner */
  }
}

export async function clearSeen(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
