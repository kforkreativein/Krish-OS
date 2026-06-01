// Single-user mode: we hard-code one owner UUID for every row.
// Set OWNER_USER_ID to any UUID you like (e.g. `uuidgen`). Defaults to all-zeros.
export const OWNER_USER_ID =
  process.env.OWNER_USER_ID || "00000000-0000-0000-0000-000000000000";

export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
