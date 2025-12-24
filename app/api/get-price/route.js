import { NextResponse } from 'next/server';

const CRYPTO_IDS = {
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
  'PEPE': 'pepe'
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const crypto = searchParams.get('crypto') || 'BTC';
  
  try {
    const coinId = CRYPTO_IDS[crypto] || 'bitcoin';
    
    // Try CoinGecko first (more reliable for most coins)
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { 
        cache: 'no-store',
        next: { revalidate: 0 }
      }
    );
    
    if (!response.ok) throw new Error('CoinGecko failed');
    
    const data = await response.json();
    const price = data[coinId]?.usd;
    
    if (!price) throw new Error('Price not found');
    
    return NextResponse.json({
      crypto,
      price,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('CoinGecko error:', error);
    
    // Fallback to Binance
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${crypto}USDT`,
        {
          cache: 'no-store',
          next: { revalidate: 0 }
        }
      );
      
      if (!response.ok) throw new Error('Binance failed');
      
      const data = await response.json();
      const price = parseFloat(data.price);
      
      if (!price || isNaN(price)) throw new Error('Invalid price from Binance');
      
      return NextResponse.json({
        crypto,
        price,
        timestamp: Date.now(),
        source: 'binance'
      });
    } catch (binanceError) {
      console.error('Binance error:', binanceError);
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch price from all sources',
          crypto,
          timestamp: Date.now()
        },
        { status: 500 }
      );
    }
  }
}
