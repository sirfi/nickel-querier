// ============================================================
// Nickel Querier — Connection passwords in the OS keychain
// ============================================================
import { SavedConnection } from "./types";
import { setConnectionSecret } from "./commands";

export interface SecureResult {
  connection: SavedConnection;
  /** Set when the keychain could not be used and the password stays in local storage. */
  warning?: string;
}

/**
 * Move a connection's password into the OS keychain. On success the stored
 * connection keeps `password: ""` and `keychain: true`. If the keychain is
 * unavailable the connection is returned unchanged (password stays local).
 */
export async function secureConnection(conn: SavedConnection): Promise<SecureResult> {
  if (!conn.password) return { connection: conn };
  try {
    await setConnectionSecret(conn.id, conn.password);
    return { connection: { ...conn, password: "", keychain: true } };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return {
      connection: { ...conn, keychain: false },
      warning: `Password saved locally (not encrypted): ${reason}`,
    };
  }
}

/** Move any plain-text passwords from older versions into the keychain. */
export async function migrateConnectionSecrets(
  connections: SavedConnection[]
): Promise<{ connections: SavedConnection[]; changed: boolean }> {
  let changed = false;
  const out: SavedConnection[] = [];
  for (const c of connections) {
    if (c.password && !c.keychain) {
      const { connection, warning } = await secureConnection(c);
      if (!warning) changed = true;
      out.push(warning ? c : connection);
    } else {
      out.push(c);
    }
  }
  return { connections: out, changed };
}
