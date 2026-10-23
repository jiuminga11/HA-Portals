import { useSyncExternalStore } from "react";
import { getAuthRecoveryStatus, subscribeAuthRecovery } from "../lib/authSession";

export function useAuthRecovery() {
  const status = useSyncExternalStore(subscribeAuthRecovery, getAuthRecoveryStatus, getAuthRecoveryStatus);
  return { status };
}
