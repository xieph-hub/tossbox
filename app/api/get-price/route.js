import { NextResponse } from 'next/server';

const BINANCE_SYMBOLS = {
  'BTC': 'BTCUSDT',
  'ETH': 'ETHUSDT',
  'SOL': 'SOLUSDT',
  'BNB': 'BNBUSDT',
  'XRP': 'XRPUSDT',
  'ADA': 'ADAUSDT',
  'DOGE': 'DOGEUSDT',
  'MATIC': 'MATICUSDT',
  'DOT': 'DOTUSDT',
  'AVAX': 'AVAXUSDT',
  'SHIB': 'SHIBUSDT',
  'LINK': 'LINKUSDT',
  'UNI': 'UNIUSDT',
  'LTC': 'LTCUSDT',
  'TRX': 'TRXUSDT'
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const crypto = searchParams.get('crypto') || 'BTC';
  
  try {
    const binanceSymbol = BINANCE_SYMBOLS[crypto] || 'BTCUSDT';
    
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`,
      { 
        cache: 'no-store',
        next: { revalidate: 0 }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const data = await response.json();
    const price = parseFloat(data.price);
    
    if (!price || isNaN(price)) {
      throw new Error('Invalid price data');
    }
    
    return NextResponse.json({
      crypto,
      price,
      timestamp: Date.now(),
      source: 'binance'
    });
    
  } catch (error) {
    console.error('Binance price API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch price from Binance',
        crypto,
        timestamp: Date.now(),
        message: error.message
      },
      { status: 500 }
    );
  }
}
