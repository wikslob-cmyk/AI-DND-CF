import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://dashboard:dashboard@localhost:5432/dashboard";

export const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export async function checkConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function closeConnection(): Promise<void> {
  await sql.end();
}
