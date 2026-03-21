const PROD_URL = 'https://agentvault-mcp-production.up.railway.app';

interface ScanInput {
  max_premium_pct?: number;
  min_arb_usdt?: number;
}

async function scanFree(input: ScanInput = {}) {
  const res = await fetch(`${PROD_URL}/scan/free`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.json();
}

// Тест
(async () => {
  try {
    const scan = await scanFree();
    console.log('✅ 6 vaults OK:', scan.vaults.length);
    console.log('Signals:', scan.vaults.map((v: any) => `${v.vault_id}: ${v.signal}`));
    console.log('Best:', scan.summary);
  } catch (e) {
    console.error('❌ Error:', e);
  }
})();
