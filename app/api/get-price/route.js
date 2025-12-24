import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const crypto = searchParams.get('crypto') || 'BTC';
  
  try {
    // Using Binance API for real-time price
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${crypto}USDT`
    );
    const data = await response.json();
    
    return NextResponse.json({
      crypto,
      price: parseFloat(data.price),
      timestamp: Date.now()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch price' },
      { status: 500 }
    );
  }
}
