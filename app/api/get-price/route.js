import { NextResponse } from 'next/server';

const COINGECKO_IDS = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'MATIC': 'matic-network',
  'DOT': 'polkadot',
  'AVAX': 'avalanche-2',
  'SHIB': 'shiba-inu',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'LTC': 'litecoin',
  'TRX': 'tron',
  'ATOM': 'cosmos',
  'XLM': 'stellar',
  'ETC': 'ethereum-classic',
  'FIL': 'filecoin',
  'HBAR': 'hedera-hashgraph',
  'APT': 'aptos',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'NEAR': 'near',
  'AAVE': 'aave',
  'STX': 'blockstack',
  'INJ': 'injective-protocol',
  'SUI': 'sui',
  'IMX': 'immutable-x',
  'RENDER': 'render-token',
  'FET': 'fetch-ai',
  'PEPE': 'pepe'
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const crypto = searchParams.get('crypto') || 'BTC';
  
  try {
    const coinId = COINGECKO_IDS[crypto];
    
    if (!coinId) {
      return NextResponse.json(
        { error: `Unknown crypto symbol: ${crypto}` },
        { status: 400 }
      );
    }
    
    console.log(`Fetching price for ${crypto} (${coinId})...`);
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { cache: 'no-store' }
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`);
    }
    
    const data = await response.json();
    const price = data[coinId]?.usd;
    
    if (!price || isNaN(price)) {
      throw new Error('Invalid price data from CoinGecko');
    }
    
    console.log(`✅ ${crypto}: $${price}`);
    
    return NextResponse.json({
      crypto,
      price,
      timestamp: Date.now(),
      source: 'coingecko'
    });
    
  } catch (error) {
    console.error(`❌ Price API error for ${crypto}:`, error.message);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch price',
        crypto,
        message: error.message,
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}
