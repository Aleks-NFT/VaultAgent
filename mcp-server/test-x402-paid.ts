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

const text1 = await res1.text()
console.log('FIRST_BODY:', text1)

if (res1.status !== 402) {
  throw new Error(`Expected 402, got ${res1.status}`)
}
