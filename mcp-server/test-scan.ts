import { scanPremiumInUsd } from "./tools/scan_premium_in_usd.js";

scanPremiumInUsd({ max_premium_pct: 2.0, min_arb_usdt: 50 })
  .then((r: unknown) => console.log(JSON.stringify(r, null, 2)));
