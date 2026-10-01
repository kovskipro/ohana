import { cleanupE2EData } from "./cleanup";
import { assertE2EMutationsAllowed, loadEnv } from "./env";
import { adminClient } from "./helpers";

export default async function globalTeardown(): Promise<void> {
  const env = loadEnv();
  assertE2EMutationsAllowed(env);
  await cleanupE2EData(adminClient());
}
