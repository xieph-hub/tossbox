import Link from "next/link";
import WalletButton from "./walletButton";

export default function HomePage() {
  return (
    <>
      <div className="nav">
        <div className="brand">tossbox.fun</div>
        <WalletButton />
      </div>

      <div className="card">
        <span className="pill">Solana • Loot</span>
        <div className="big">Toss. Reveal. Flex.</div>
        <p className="muted">
          Open boxes for fun. Sometimes you pull real tokens. Always you get a story.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn primary" href="/play">Open a Box</Link>
          <a className="btn" href="/play">See Boxes</a>
        </div>

        <hr />
        <p className="muted" style={{ fontSize: 13 }}>
          No guarantees. Entertainment only.
        </p>
      </div>
    </>
  );
}
