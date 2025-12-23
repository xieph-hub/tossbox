import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "tossbox.fun — Toss. Reveal. Flex.",
  description: "Lootboxes for degens on Solana. One-click open. Instant reveal.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
