import { Connection, PublicKey } from "@solana/web3.js";

export function getConnection() {
  const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(rpc, "confirmed");
}

export function getTreasuryPubkey() {
  const addr = process.env.NEXT_PUBLIC_TREASURY_WALLET;
  if (!addr) throw new Error("Missing NEXT_PUBLIC_TREASURY_WALLET");
  return new PublicKey(addr);
}
