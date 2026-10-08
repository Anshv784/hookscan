"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

// The browser never talks to the RPC directly for state we care about; the server builds,
// simulates and relays. This endpoint is only what the wallet adapter needs to exist.
const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider endpoint={PUBLIC_RPC}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
