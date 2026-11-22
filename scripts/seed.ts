/* Seeds taxonomy, governance records and (in demo mode) labelled fixtures. */
import { getDb, closeDatabase } from "../src/lib/db/client";
import { seedDatabase } from "../src/lib/db/seed";

async function main() {
  const db = await getDb();
  const summary = await seedDatabase(db);
  console.log("[seed] summary", summary);
  await closeDatabase();
}

main().catch((error) => {
  console.error("[seed] failed", error);
  process.exit(1);
});
