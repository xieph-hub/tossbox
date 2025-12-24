// In the section where you create a new round, replace with:
if (!activeRound) {
  // Fetch current price from Binance
  const binanceSymbol = `${crypto}USDT`;
  const priceRes = await fetch(
    `https://api.binance.com/api/3/ticker/price?symbol=${binanceSymbol}`,
    { cache: 'no-store' }
  );
  
  if (!priceRes.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch current price' },
      { status: 500 }
    );
  }
  
  const priceData = await priceRes.json();
  const currentPrice = parseFloat(priceData.price);

  const { data: newRound } = await supabase
    .from('rounds')
    .insert({
      crypto,
      start_price: currentPrice,
      start_time: new Date().toISOString(),
      status: 'active'
    })
    .select()
    .single();
  
  activeRound = newRound;
}
