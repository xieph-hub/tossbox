export const dynamic = "force-dynamic";

import Link from "next/link";
import WalletButton from "./walletButton";

export default function HomePage() {
  return (
    <>
      <div className="bgfx" />
      <div className="container">
        <div className="nav">
          <div className="brand">
            <span className="logoDot" />
            <div>
              <div style={{ fontWeight: 950, letterSpacing: "-.4px" }}>tossbox.fun</div>
              <div className="subbrand">Solana loot • One-click open • Instant reveal</div>
            </div>
          </div>
          <WalletButton />
        </div>

        <div className="hero">
          <span className="pill">⚡ Fair flow • You sign every payment • No hidden transfers</span>

          <div className="big">Toss. Reveal. Flex.</div>

          <div className="muted" style={{ maxWidth: 760 }}>
            Pick a box, approve in your wallet, and get an instant reveal. Built for speed, clarity,
            and clean UX — not sketchy prompts.
          </div>

          <div className="row">
            <Link className="btn primary" href="/play">Open a Box</Link>
            <Link className="btn" href="/play">See Boxes</Link>
            <Link className="btn ghost" href="/play">How it works</Link>
          </div>

          <div className="hr" />

          <div className="grid">
            <div className="card">
              <div style={{ fontWeight: 950 }}>🔎 Transparent</div>
              <div className="mutedSmall" style={{ marginTop: 6 }}>
                Your wallet shows amount + recipient before you sign. We verify payment on-chain before reveal.
              </div>
            </div>
            <div className="card">
              <div style={{ fontWeight: 950 }}>🎛 Safety switches</div>
              <div className="mutedSmall" style={{ marginTop: 6 }}>
                Daily payout caps, kill switch, low-funded hot wallet, and rarity controls.
              </div>
            </div>
            <div className="card">
              <div style={{ fontWeight: 950 }}>🎵 Optional SFX</div>
              <div className="mutedSmall" style={{ marginTop: 6 }}>
                Sound + animation that’s clean (not tacky). Users can mute anytime.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }} className="mutedSmall">
            Entertainment only. No guarantees. Always verify transactions in your wallet before approving.
          </div>
        </div>
      </div>
    </>
  );
}
