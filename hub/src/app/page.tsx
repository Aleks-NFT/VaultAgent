import VaultScanner from '@/components/VaultScanner';
import PremiumScanModal from '@/components/PremiumScanModal';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-6xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent drop-shadow-2xl mb-6">
            AgentVault Scanner
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Live NFTX vault arbitrage signals — BUY/NEUTRAL/EXPENSIVE
          </p>
        </header>
        
        <VaultScanner />
        <PremiumScanModal onData={console.log} />
      </div>
    </main>
  );
}
