// Replace the price fetching section with:
const binanceSymbol = `${round.crypto}USDT`;
const priceRes = await fetch(
  `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`,
  { cache: 'no-store' }
);

if (!priceRes.ok) {
  console.error(`Failed to fetch price for ${round.crypto}`);
  continue;
}

const priceData = await priceRes.json();
const endPrice = parseFloat(priceData.price);
