// lib/solana.ts
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  SystemInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";

const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export const connection = new Connection(RPC_URL, "confirmed");

/**
 * PAYOUT WALLET
 * Expectation: PAYOUT_WALLET_SECRET_KEY is base58-encoded 64-byte secret key.
 */
export function getPayoutWallet(): Keypair {
  try {
    const raw = process.env.PAYOUT_WALLET_SECRET_KEY;
    if (!raw) throw new Error("Missing PAYOUT_WALLET_SECRET_KEY");
    const secretKey = bs58.decode(raw);
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error("Failed to load payout wallet:", error);
    throw error;
  }
}

export function getTreasuryWallet(): PublicKey {
  const v = process.env.NEXT_PUBLIC_TREASURY_WALLET;
  if (!v) throw new Error("Missing NEXT_PUBLIC_TREASURY_WALLET");
  return new PublicKey(v);
}

/**
 * Sends payout from payout wallet → recipient (SOL).
 * NOTE: Do not call this from the client. Server only.
 */
export async function sendPayout(recipientAddress: string, amountSOL: number) {
  if (!recipientAddress) throw new Error("recipientAddress required");
  if (!Number.isFinite(amountSOL) || amountSOL <= 0)
    throw new Error("amountSOL must be > 0");

  const payoutWallet = getPayoutWallet();
  const recipient = new PublicKey(recipientAddress);

  const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);
  if (lamports <= 0) throw new Error("lamports computed as 0");

  // Optional sanity check: ensure payout wallet matches env public key (if provided)
  const payoutPub = process.env.PAYOUT_WALLET_PUBLIC_KEY;
  if (payoutPub) {
    const expected = new PublicKey(payoutPub);
    if (!expected.equals(payoutWallet.publicKey)) {
      throw new Error("PAYOUT_WALLET_SECRET_KEY does not match PAYOUT_WALLET_PUBLIC_KEY");
    }
  }

  // Check balance before trying to pay
  const bal = await connection.getBalance(payoutWallet.publicKey, "confirmed");
  if (bal < lamports) {
    throw new Error(
      `Insufficient payout wallet balance: have ${bal} lamports, need ${lamports}`
    );
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
    "confirmed"
  );

  const tx = new Transaction({
    feePayer: payoutWallet.publicKey,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: payoutWallet.publicKey,
      toPubkey: recipient,
      lamports,
    })
  );

  const signature = await connection.sendTransaction(tx, [payoutWallet], {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    throw new Error(`Payout transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return signature;
}

/**
 * Verifies that `signature` contains a SOL transfer:
 * - from `expectedSenderWallet` (bettor wallet)
 * - to your treasury wallet (or provided expectedRecipient)
 * - for at least `expectedAmountSOL` (with tiny tolerance)
 *
 * Returns true/false.
 */
export async function verifyTransaction(
  signature: string,
  expectedAmountSOL: number,
  expectedSenderWallet: string,
  expectedRecipientOverride?: string
) {
  try {
    if (!signature) return false;

    if (!Number.isFinite(expectedAmountSOL) || expectedAmountSOL <= 0) return false;
    if (!expectedSenderWallet) return false;

    const expectedSender = new PublicKey(expectedSenderWallet);
    const expectedRecipient = expectedRecipientOverride
      ? new PublicKey(expectedRecipientOverride)
      : getTreasuryWallet();

    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return false;
    if (tx.meta?.err) return false; // transaction must have succeeded

    // Convert expected SOL to lamports (tolerance handles rounding)
    const expectedLamports = Math.floor(expectedAmountSOL * LAMPORTS_PER_SOL);
    const toleranceLamports = 5000; // ~0.000005 SOL tolerance for rounding/fees differences

    // We look for *any* SystemProgram transfer instruction that matches:
    // from=expectedSender, to=expectedRecipient, lamports>=expectedLamports-tolerance
    const instructions = tx.transaction.message.instructions;

    for (const ix of instructions as any[]) {
      // Must be a SystemProgram instruction
      const programId = (ix.programId as PublicKey) || null;
      if (!programId || !programId.equals(SystemProgram.programId)) continue;

      // Decode transfer (this handles proper parsing vs manual account indexing)
      let decoded: { fromPubkey: PublicKey; toPubkey: PublicKey; lamports: number } | null =
        null;

      try {
        decoded = SystemInstruction.decodeTransfer(ix);
      } catch {
        // Not a transfer (could be createAccount, etc.)
        decoded = null;
      }

      if (!decoded) continue;

      const { fromPubkey, toPubkey, lamports } = decoded;

      const senderOk = fromPubkey.equals(expectedSender);
      const recipientOk = toPubkey.equals(expectedRecipient);
      const amountOk = lamports >= Math.max(0, expectedLamports - toleranceLamports);

      if (senderOk && recipientOk && amountOk) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Verification error:", error);
    return false;
  }
}
