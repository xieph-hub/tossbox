// lib/solana.js
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

// Server RPC (prefer SOLANA_RPC_URL). Falls back safely.
const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export const connection = new Connection(RPC_URL, "confirmed");

export const getPayoutWallet = () => {
  try {
    const raw = process.env.PAYOUT_WALLET_SECRET_KEY;
    if (!raw) throw new Error("Missing PAYOUT_WALLET_SECRET_KEY");
    const secretKey = bs58.decode(raw);
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error("Failed to load payout wallet:", error);
    throw error;
  }
};

export const getTreasuryWallet = () => {
  const v = process.env.NEXT_PUBLIC_TREASURY_WALLET;
  if (!v) throw new Error("Missing NEXT_PUBLIC_TREASURY_WALLET");
  return new PublicKey(v);
};

function toLamports(amountSOL) {
  const n = typeof amountSOL === "string" ? Number(amountSOL) : amountSOL;
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return Math.floor(n * LAMPORTS_PER_SOL);
}

/**
 * sendPayout(recipientAddress, amountSOL)
 * Server-only SOL transfer from payout wallet to user.
 */
export const sendPayout = async (recipientAddress, amountSOL) => {
  if (!recipientAddress) throw new Error("recipientAddress required");
  const lamports = toLamports(amountSOL);
  if (!Number.isFinite(lamports) || lamports <= 0)
    throw new Error("amountSOL must be > 0");

  try {
    const payoutWallet = getPayoutWallet();
    const recipient = new PublicKey(recipientAddress);

    // Optional sanity check if PAYOUT_WALLET_PUBLIC_KEY is set
    const payoutPub = process.env.PAYOUT_WALLET_PUBLIC_KEY;
    if (payoutPub) {
      const expected = new PublicKey(payoutPub);
      if (!expected.equals(payoutWallet.publicKey)) {
        throw new Error(
          "PAYOUT_WALLET_SECRET_KEY does not match PAYOUT_WALLET_PUBLIC_KEY"
        );
      }
    }

    const balance = await connection.getBalance(payoutWallet.publicKey, "confirmed");
    if (balance < lamports) {
      throw new Error(
        `Insufficient payout wallet balance: have ${balance} lamports, need ${lamports}`
      );
    }

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction({
      feePayer: payoutWallet.publicKey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: payoutWallet.publicKey,
        toPubkey: recipient,
        lamports,
      })
    );

    const signature = await connection.sendTransaction(transaction, [payoutWallet], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });

    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    if (confirmation?.value?.err) {
      throw new Error(`Payout failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
  } catch (error) {
    console.error("Payout error:", error);
    throw error;
  }
};

/**
 * verifyTransaction(signature, expectedAmountSOL, expectedRecipient, expectedSender?)
 *
 * HARDENED:
 * - tx must exist and be successful (meta.err null)
 * - must contain a SystemProgram.transfer instruction
 * - transfer must go to expectedRecipient (defaults to treasury if not provided)
 * - transfer must be >= expectedAmountSOL (tiny tolerance)
 * - if expectedSender provided, transfer must be FROM that sender
 *
 * NOTE:
 * - This only validates plain SOL transfers (SystemProgram.transfer).
 * - If you later accept SPL token / WSOL deposits, you must add token parsing.
 */
export const verifyTransaction = async (
  signature,
  expectedAmountSOL,
  expectedRecipient,
  expectedSender
) => {
  try {
    if (!signature) return false;

    const expectedLamports = toLamports(expectedAmountSOL);
    if (!Number.isFinite(expectedLamports) || expectedLamports <= 0) return false;

    const recipientPk = expectedRecipient
      ? new PublicKey(expectedRecipient)
      : getTreasuryWallet();

    const senderPk = expectedSender ? new PublicKey(expectedSender) : null;

    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return false;
    if (tx.meta?.err) return false; // must be successful

    // Tolerance for rounding differences (NOT fees; fees are separate)
    const toleranceLamports = 5000; // ~0.000005 SOL

    const instructions = tx.transaction.message.instructions;

    for (const ix of instructions) {
      // Only SystemProgram instructions
      if (!ix.programId?.equals?.(SystemProgram.programId)) continue;

      // Only transfer instructions (ignore createAccount, allocate, etc.)
      let decoded;
      try {
        decoded = SystemInstruction.decodeTransfer(ix);
      } catch {
        decoded = null;
      }
      if (!decoded) continue;

      const { fromPubkey, toPubkey, lamports } = decoded;

      const recipientOk = toPubkey.equals(recipientPk);
      const amountOk = lamports >= Math.max(0, expectedLamports - toleranceLamports);
      const senderOk = senderPk ? fromPubkey.equals(senderPk) : true;

      if (recipientOk && amountOk && senderOk) {
        return true;
      }
    }

    // If we got here, no matching SOL transfer was found.
    // If your deposits are SPL token / WSOL transfers, this will return false.
    return false;
  } catch (error) {
    console.error("Verification error:", error);
    return false;
  }
};
