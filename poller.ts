import { main } from "./poller/index.ts";

if (import.meta.main) {
  await main();
}
