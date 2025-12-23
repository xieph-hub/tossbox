import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "TossBox",
  description: "Open chaos. Win culture."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="container">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
