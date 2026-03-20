import { quoteInUsdt } from "./tools/quote_in_usdt";
quoteInUsdt({ vault_id: "vMILADY", direction: "mint", amount_usdt: 1000 }).then(console.log);
