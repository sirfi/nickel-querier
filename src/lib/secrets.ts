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

// Keychain writes run one at a time in call order, so a password saved by the
// user can never be overwritten by a slower, earlier write (e.g. migration).
let queue: Promise<unknown> = Promise.resolve();
function serialised<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Move a connection's password into the OS keychain. On success the stored
 * connection keeps `password: ""` and `keychain: true`. If the keychain is
 * unavailable the connection is returned unchanged (password stays local).
 */
export async function secureConnection(conn: SavedConnection): Promise<SecureResult> {
  if (!conn.password) return { connection: conn };
  try {
    await serialised(() => setConnectionSecret(conn.id, conn.password));
    return { connection: { ...conn, password: "", keychain: true } };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return {
      connection: { ...conn, keychain: false },
      warning: `Password saved locally (not encrypted): ${reason}`,
    };
  }
}

/**
 * Move plain-text passwords from older versions into the keychain.
 * `migrated` maps connection id → the password that was moved, so the caller
 * can apply the result to the *current* list (see `applyMigratedSecrets`).
 */
export async function migrateConnectionSecrets(
  connections: SavedConnection[]
): Promise<{ migrated: Record<string, string>; warnings: string[] }> {
  const migrated: Record<string, string> = {};
  const warnings: string[] = [];
  for (const c of connections) {
    if (!c.password || c.keychain) continue;
    const { warning } = await secureConnection(c);
    if (warning) warnings.push(`${c.name}: ${warning}`);
    else migrated[c.id] = c.password;
  }
  return { migrated, warnings };
}

/**
 * Mark migrated connections as keychain-backed in `current`, but only those
 * whose password is still the one that was migrated — connections added,
 * edited or deleted while migration ran are left exactly as they are.
 */
export function applyMigratedSecrets(
  current: SavedConnection[],
  migrated: Record<string, string>
): SavedConnection[] {
  return current.map((c) =>
    c.id in migrated && !c.keychain && c.password === migrated[c.id]
      ? { ...c, password: "", keychain: true }
      : c
  );
}
