const PRODURL =
  process.env.AGENTVAULT_API_URL ??
  'https://agentvault-mcp-production.up.railway.app'

const body = {
  maxpremiumpct: 1.0,
  minarbusdt: 30,
}

const res = await fetch(`${PRODURL}/scan/premium`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

console.log('FIRST_STATUS:', res.status)
console.log(
  'PAYMENT_REQUIRED:',
  res.headers.get('payment-required') ??
    res.headers.get('PAYMENT-REQUIRED') ??
    'missing'
)
console.log(
  'ALL_HEADERS:',
  JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2)
)

const text = await res.text()
console.log('FIRST_BODY:', text)
