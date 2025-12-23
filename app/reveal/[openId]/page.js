"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import WalletButton from "../../walletButton";

export default function RevealPage({ params }) {
  const { openId } = params;
  const sp = useSearchParams();
  const amountLamports = sp.get("amount");
  const treasury = sp.get("to");

  const [sig, setSig] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  async function confirm() {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/open/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openId, txSignature: sig })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Confirm failed");
      setResult(data);
      // tiny sound
      try { new Audio("/reveal.mp3").play(); } catch {}
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="nav">
        <Link className="brand" href="/">tossbox.fun</Link>
        <WalletButton />
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Reveal</h2>

        {!result ? (
          <>
            <p className="muted">
              Step 1: Send <b>{amountLamports}</b> lamports to treasury:
            </p>
            <div className="card" style={{ wordBreak: "break-all" }}>
              {treasury}
            </div>

            <p className="muted">
              Step 2: After you send, paste the transaction signature below and confirm.
            </p>

            <input
              value={sig}
              onChange={(e) => setSig(e.target.value)}
              placeholder="Paste Solana tx signature..."
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.06)",
                color: "white"
              }}
            />

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn primary" disabled={busy || !sig} onClick={confirm}>
                {busy ? "Confirming..." : "Confirm & Reveal"}
              </button>
              <Link className="btn" href="/play">Back</Link>
            </div>

            {err ? <p className="muted" style={{ color: "#ffb3b3" }}>{err}</p> : null}
          </>
        ) : (
          <>
            <div className="pill">RARITY: {result.rarity}</div>
            <div className="big" style={{ fontSize: 28, marginTop: 10 }}>
              {result.title}
            </div>
            <p className="muted">{result.aiLine}</p>

            <div className="card">
              <b>Reward:</b> {result.rewardType}
              {result.symbol ? ` • ${result.symbol}` : ""}
              {result.amount ? ` • ${result.amount}` : ""}
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn primary" href="/play">Open another</Link>
              <a className="btn" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(result.shareText)}`} target="_blank">
                Share on X
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
}
