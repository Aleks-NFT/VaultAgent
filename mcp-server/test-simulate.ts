import { simulateStableRoute } from "./tools/simulate_stable_route.js";

simulateStableRoute({
  vault_id: "vMILADY",
  direction: "mint",
  amount_usdt: 1000,
}).then((r: unknown) => console.log(JSON.stringify(r, null, 2)));
