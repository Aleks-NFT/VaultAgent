const PRODURL =
  process.env.AGENTVAULT_API_URL ??
  'https://agentvault-mcp-production.up.railway.app'

const body = {
  maxpremiumpct: 1.0,
  minarbusdt: 30,
}

const res1 = await fetch(`${PRODURL}/scan/premium`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

console.log('FIRST_STATUS:', res1.status)
console.log(
  'FIRST_PAYMENT_REQUIRED:',
  res1.headers.get('payment-required') ? 'present' : 'missing'
)

const res2 = await fetch(`${PRODURL}/scan/premium`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'PAYMENT-SIGNATURE': 'debug-placeholder-signature',
  },
  body: JSON.stringify(body),
})

console.log('SECOND_STATUS:', res2.status)
console.log(
  'SECOND_PAYMENT_RESPONSE:',
  res2.headers.get('payment-response') ??
    res2.headers.get('PAYMENT-RESPONSE') ??
    'missing'
)

const text = await res2.text()
console.log('SECOND_BODY:', text)
