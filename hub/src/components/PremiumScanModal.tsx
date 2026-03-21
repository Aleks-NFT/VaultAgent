'use client'
import { useState } from 'react';

const PROD_URL = 'https://agentvault-mcp-production.up.railway.app';

export default function PremiumScanModal({ onData }: { onData: (data: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const scanPremium = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${PROD_URL}/scan/premium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_premium_pct: 1.0 }),
      });
      
      if (res.status === 402) {
        alert('💳 Payment required: $0.001 USDC\n\nTODO: wallet integration');
        return;
      }
      
      const result = await res.json();
      setData(result);
      onData(result);
    } catch (e) {
      alert('Error: ' + e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button 
        onClick={scanPremium}
        disabled={loading}
        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
      >
        {loading ? 'Scanning...' : '💎 Premium Scan $0.001'}
      </button>
      
      {data && (
        <div className="mt-2 bg-green-500 text-white px-4 py-2 rounded-lg text-sm">
          {data.summary}
        </div>
      )}
    </div>
  );
}
