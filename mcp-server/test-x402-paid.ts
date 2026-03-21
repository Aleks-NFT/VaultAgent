const PRODURL =
  process.env.AGENTVAULT_API_URL ??
  'https://agentvault-mcp-production.up.railway.app'

const PRIVATE_KEY = process.env.EVM_PRIVATE_KEY
if (!PRIVATE_KEY) {
  throw new Error('Missing EVM_PRIVATE_KEY')
}

const body = {
  maxpremiumpct: 1.0,
  minarbusdt: 30,
}

const res1 = await fetch(`${PRODURL}/scanpremium`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

console.log('FIRST_STATUS:', res1.status)

const challengeText = await res1.text()
console.log('FIRST_BODY:', challengeText)

if (res1.status !== 402) {
  throw new Error(`Expected 402, got ${res1.status}`)
}

const challenge = JSON.parse(challengeText)
const offer = challenge.accepts?.[0]

console.log(
  'OFFER:',
  JSON.stringify(
    {
      scheme: offer?.scheme,
      network: offer?.network,
      amount: offer?.amount,
      asset: offer?.asset,
      payTo: offer?.payTo,
    },
    null,
    2
  )
)

throw new Error('NEXT: wire real signer/payment SDK here, then retry with signed PAYMENT-SIGNATURE')
