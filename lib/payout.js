import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { getConnection } from "@/lib/solana";

function parseSecret(secret) {
  // Supports:
  // 1) JSON array string: "[1,2,3,...]"
  // 2) base58 string
  const s = (secret || "").trim();
  if (!s) throw new Error("Missing PAYOUT_WALLET_SECRET_KEY");

  if (s.startsWith("[")) {
    const arr = JSON.parse(s);
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }

  const decoded = bs58.decode(s);
  return Keypair.fromSecretKey(decoded);
}

export function getPayoutKeypair() {
  return parseSecret(process.env.PAYOUT_WALLET_SECRET_KEY);
}

export function getPayoutPubkey() {
  const pub = process.env.PAYOUT_WALLET_PUBLIC_KEY;
  if (!pub) return null;
  return new PublicKey(pub);
}

export async function sendSolPayout({ toWallet, solAmount }) {
  const conn = getConnection();
  const kp = getPayoutKeypair();

  const expectedPub = getPayoutPubkey();
  if (expectedPub && !kp.publicKey.equals(expectedPub)) {
    throw new Error(
      `Payout signer mismatch. Secret key pubkey=${kp.publicKey.toBase58()} expected=${expectedPub.toBase58()}`
    );
  }

  const to = new PublicKey(toWallet);
  const lamports = Math.round(Number(solAmount) * 1_000_000_000);

  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error("Invalid payout amount");
  }

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
