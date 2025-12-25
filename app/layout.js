import { Inter } from "next/font/google";
import "./globals.css";
import WalletContextProvider from "@/components/WalletProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "TossBox - Crypto Price Prediction Game",
  description: "Predict. Win. Repeat.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
