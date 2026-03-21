import { scanFree, scanPremium } from './utils/x402-client.js'

const free = await scanFree({ maxpremiumpct: 1.5 })
console.log('FREE:', JSON.stringify(free, null, 2))

const paid = await scanPremium({ maxpremiumpct: 1.0, minarbusdt: 30 })
console.log('PAID:', JSON.stringify(paid, null, 2))
