"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WalletButton from "../walletButton";
import { useWallet } from "@solana/wallet-adapter-react";

export default function PlayPage() {
  const { publicKey } = useWallet();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/config");
      const data = await res.json();
      setTiers(data.tiers || []);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <div className="nav">
        <Link className="brand" href="/">tossbox.fun</Link>
        <WalletButton />
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Choose a box</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          Connect wallet, pick a tier, pay, reveal.
        </p>

        {!publicKey && (
          <p className="muted">
            Connect your wallet to open boxes.
          </p>
        )}

        {loading ? (
          <p className="muted">Loading tiers...</p>
        ) : (
          <div className="grid">
            {tiers.map((t) => (
              <div className="card" key={t.id}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{t.name}</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Price: {(Number(t.price_sol) || 0).toFixed(3)} SOL
                </div>
                <div style={{ marginTop: 12 }}>
                  <OpenButton tierId={t.id} disabled={!publicKey || !t.active} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function OpenButton({ tierId, disabled }) {
  const { publicKey } = useWallet();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function startOpen() {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/open/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId, wallet: publicKey.toBase58() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create open");
      // send user to reveal page (it will guide payment & confirmation)
      window.location.href = `/reveal/${data.openId}?amount=${data.amountLamports}&to=${data.treasury}`;
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn primary" disabled={disabled || busy} onClick={startOpen}>
        {busy ? "Preparing..." : "Open"}
      </button>
      {err ? <p className="muted" style={{ color: "#ffb3b3" }}>{err}</p> : null}
    </>
  );
}
