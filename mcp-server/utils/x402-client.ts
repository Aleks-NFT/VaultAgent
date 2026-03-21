const PRODURL =
  process.env.AGENTVAULT_API_URL ??
  'https://agentvault-mcp-production.up.railway.app'

export interface ScanInput {
  maxpremiumpct?: number
  minarbusdt?: number
}

export interface X402Accept {
  scheme: string
  network: string
  price?: string
  amount?: string
  payTo: string
  asset?: string
}

export interface X402Challenge {
  accepts: X402Accept[]
  resource?: string
}

export type X402Result<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: 402; challenge: X402Challenge }
  | { ok: false; status: number; error: string }

async function postJson<T>(endpoint: string, body: unknown): Promise<X402Result<T>> {
  const res = await fetch(`${PRODURL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })

  if (res.ok) {
    return { ok: true, status: res.status, data: await res.json() as T }
  }

  if (res.status === 402) {
    const header =
      res.headers.get('payment-required') ??
      res.headers.get('PAYMENT-REQUIRED')

    if (header) {
      const decoded = JSON.parse(
        Buffer.from(header, 'base64').toString('utf-8')
      ) as X402Challenge

      return { ok: false, status: 402, challenge: decoded }
    }

    try {
      return { ok: false, status: 402, challenge: await res.json() as X402Challenge }
    } catch {
      return { ok: false, status: 402, challenge: { accepts: [] } }
    }
  }

  return {
    ok: false,
    status: res.status,
    error: await res.text(),
  }
}

export async function scanFree(input: ScanInput = {}) {
  return postJson('/scan/free', input)
}

export async function scanPremiumFree(input: ScanInput = {}) {
  return postJson('/scan/premium/free', input)
}

export async function scanPremium(input: ScanInput = {}) {
  return postJson('/scan/premium', input)
}

export async function quote(input: Record<string, unknown> = {}) {
  return postJson('/quote', input)
}
