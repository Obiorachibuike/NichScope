/* Applies Drizzle migrations to the configured database. */
import { migrateDatabase, closeDatabase } from "../src/lib/db/client";

async function main() {
  console.log("[migrate] applying migrations…");
  await migrateDatabase();
  console.log("[migrate] done");
  await closeDatabase();
}

main().catch((error) => {
  console.error("[migrate] failed", error);
  process.exit(1);
});
