export const metadata = {
  metadataBase: new URL("https://tossbox.fun"),
  title: "TossBox — Solana Loot Boxes",
  description:
    "Open loot boxes on Solana. Wallet-signed payment, on-chain confirmation, instant reveal.",
  applicationName: "TossBox",
  alternates: { canonical: "https://tossbox.fun" },
  openGraph: {
    title: "TossBox — Solana Loot Boxes",
    description:
      "Open loot boxes on Solana. Wallet-signed payment, on-chain confirmation, instant reveal.",
    url: "https://tossbox.fun",
    siteName: "TossBox",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "TossBox",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TossBox",
    description:
      "Solana loot boxes with wallet-signed payment + instant reveal.",
    images: ["/og.png"],
  },
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

export const viewport = {
  themeColor: "#0b0b1a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
