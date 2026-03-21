import { scanPremium } from './utils/x402-client.js'

const res = await scanPremium({ maxpremiumpct: 1.0, minarbusdt: 30 })

if (res.ok) {
  console.log('UNEXPECTED_OK:', JSON.stringify(res, null, 2))
  process.exit(0)
}

if (res.status !== 402) {
  console.log('UNEXPECTED_STATUS:', JSON.stringify(res, null, 2))
  process.exit(1)
}

const offer = res.challenge.accepts?.[0]

console.log(
  'OFFER:',
  JSON.stringify(
    {
      scheme: offer?.scheme,
      network: offer?.network,
      amount: offer?.amount,
      asset: offer?.asset,
      payTo: offer?.payTo,
      resource: res.challenge.resource,
    },
    null,
    2
  )
)
