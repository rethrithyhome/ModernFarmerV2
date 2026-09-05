import { useSyncExternalStore } from "react";
import { getDb, subscribe } from "./store";
import type { DbShape } from "./types";

export function useDb(): DbShape {
  return useSyncExternalStore(
    (fn) => subscribe(fn),
    () => getDb(),
    () => getDb(),
  );
}
