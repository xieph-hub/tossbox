import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { getConnection } from "@/lib/solana";

function parseSecret(secret) {
  // Supports:
  // 1) JSON array string: "[1,2,3,...]"
  // 2) base58 secret key string
  const s = (secret || "").trim();
  if (!s) throw new Error("Missing PAYOUT_WALLET_SECRET_KEY");

  if (s.startsWith("[")) {
    const arr = JSON.parse(s);
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }

  // base58
  const decoded = bs58.decode(s);
  return Keypair.fromSecretKey(decoded);
}

export function getPayoutKeypair() {
  return parseSecret(process.env.PAYOUT_WALLET_SECRET_KEY);
}

export async function sendSolPayout({ toWallet, solAmount }) {
  const conn = getConnection();
  const kp = getPayoutKeypair();

  const to = new PublicKey(toWallet);
  const lamports = Math.round(Number(solAmount) * 1_000_000_000);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: kp.publicKey,
      toPubkey: to,
      lamports,
    })
  );

  const sig = await conn.sendTransaction(tx, [kp], { skipPreflight: false });
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}
