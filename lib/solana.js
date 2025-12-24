import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');

export const getPayoutWallet = () => {
  const secretKey = bs58.decode(process.env.PAYOUT_WALLET_SECRET_KEY);
  return Keypair.fromSecretKey(secretKey);
};

export const getTreasuryWallet = () => {
  return new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET);
};

export const sendPayout = async (recipientAddress, amountSOL) => {
  try {
    const payoutWallet = getPayoutWallet();
    const recipient = new PublicKey(recipientAddress);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payoutWallet.publicKey,
        toPubkey: recipient,
        lamports: amountSOL * LAMPORTS_PER_SOL,
      })
    );

    const signature = await connection.sendTransaction(transaction, [payoutWallet]);
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  } catch (error) {
    console.error('Payout error:', error);
    throw error;
  }
};

export const verifyTransaction = async (signature, expectedAmount, expectedRecipient) => {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
    
    if (!tx) return false;

    const treasuryWallet = getTreasuryWallet();
    const transfer = tx.transaction.message.instructions.find(
      ix => ix.programId.equals(SystemProgram.programId)
    );

    if (!transfer) return false;

    const accountKeys = tx.transaction.message.accountKeys;
    const toKey = accountKeys[transfer.accounts[1]];
    
    return toKey.equals(treasuryWallet);
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
};

export { connection };
