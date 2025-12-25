"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

import "@solana/wallet-adapter-react-ui/styles.css";

type Props = { children: React.ReactNode };

export default function WalletContextProvider({ children }: Props) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

  // Fail-fast in production so you don't accidentally use public RPC
  if (!endpoint) {
    throw new Error("Missing env: NEXT_PUBLIC_SOLANA_RPC_URL (do NOT fallback to public RPC)");
  }

  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
