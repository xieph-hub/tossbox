"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import WalletButton from "../walletButton";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

function safeParseJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function fetchJsonSafe(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  const data = safeParseJson(text);

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      (text && text.slice(0, 180)) ||
      `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function tierAccent(tierId) {
  if (tierId === "starter") return "brand";
  if (tierId === "alpha") return "green";
  return "warn";
}

export default function PlayPage() {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();

  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const walletBase58 = useMemo(
    () => (publicKey ? publicKey.toBase58() : ""),
    [publicKey]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setPageError("");
      try {
        const data = await fetchJsonSafe("/api/config", { method: "GET" });
        if (!cancelled) setTiers(Array.isArray(data.tiers) ? data.tiers : []);
      } catch (e) {
        if (!cancelled) setPageError(e?.message || "Failed to load boxes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="nav">
        <div className="brand">
          <span className="logoDot" />
          <div>
            <Link href="/">tossbox.fun</Link>
            <div className="subbrand">Lootboxes for degens • Mainnet</div>
          </div>
        </div>
        <WalletButton />
      </div>

      <div className="hero">
        <div className="heroTop">
          <div>
            <div className="hTag">⚡ One-click open • Wallet signs • Instant reveal</div>
            <div className="big">Pick a box. Approve. Reveal.</div>
            <div className="muted">
              No manual transfers. Your wallet signs a payment transaction, we confirm it on-chain,
              then reveal your outcome.
            </div>
          </div>

          <div className="cardGlass" style={{ minWidth: 280 }}>
            <div className="kpiTop">
              <div className="kpiLabel">Status</div>
              <span className={`badge ${connected ? "green" : "danger"}`}>
                {connected ? "Wallet Connected" : "Connect Wallet"}
              </span>
            </div>
            <div className="hr" />
            <div className="mutedSmall">
              You’ll always see a wallet approval popup before any payment is sent.
            </div>
          </div>
        </div>

        <div className="kpiRow">
          <div className="kpi">
            <div className="kpiLabel">Flow</div>
            <div className="kpiValue">Open → Pay → Confirm → Reveal</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Network</div>
            <div className="kpiValue">Solana Mainnet</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Fairness</div>
            <div className="kpiValue">On-chain payment verified</div>
          </div>
        </div>

        {pageError ? <div className="toast">{pageError}</div> : null}
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Choose a box</div>
            <div className="mutedSmall">Click “Open” and approve in Phantom/Solflare.</div>
          </div>
          <Link className="btn ghost" href="/">
            ← Home
          </Link>
        </div>

        <div className="hr" />

        {loading ? (
          <div className="muted" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="spin" /> Loading boxes…
          </div>
        ) : (
          <div className="grid">
            {tiers.map((t) => (
              <TierCard
                key={t.id}
                t={t}
                disabled={!connected || !t.active}
                wallet={walletBase58}
                connection={connection}
                sendTransaction={sendTransaction}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function TierCard({ t, disabled, wallet, connection, sendTransaction }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function oneClickOpen() {
    setErr("");
    setOk("");
    setBusy(true);

    try {
      if (!wallet) throw new Error("Connect your wallet first.");

      // 1) Create an "open" server-side (locks price/tier + returns treasury)
      const created = await fetchJsonSafe("/api/open/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: t.id, wallet }),
      });

      const openId = created.openId;
      const treasury = new PublicKey(created.treasury);
      const amountLamports = Number(created.amountLamports);

      if (!openId) throw new Error("Missing openId.");
      if (!created.treasury) throw new Error("Missing treasury.");
      if (!Number.isFinite(amountLamports) || amountLamports <= 0) throw new Error("Invalid price.");

      // 2) Build transaction: transfer SOL from user -> treasury
      const fromPubkey = new PublicKey(wallet);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: treasury,
          lamports: amountLamports,
        })
      );

      // 3) Send transaction via wallet (this triggers Phantom approval)
      setOk("Approve the transaction in your wallet…");
      const signature = await sendTransaction(tx, connection);

      setOk("Confirming on-chain…");
      // Optional: wait for local confirmation
      await connection.confirmTransaction(signature, "confirmed");

      // 4) Confirm with server (server verifies payment + assigns reward + auto payouts if reward is SOL)
      const confirmed = await fetchJsonSafe("/api/open/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openId, txSignature: signature }),
      });

      // 5) Redirect to reveal page (shows result + payoutTx if any)
      window.location.href = `/reveal/${encodeURIComponent(openId)}`;
    } catch (e) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tier">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div className="tierName">{t.name}</div>
        <span className={`badge ${tierAccent(t.id)}`}>Tier</span>
      </div>

      <div className="tierMeta">
        <span className="badge">
          💰 {(Number(t.price_sol) || 0).toFixed(3)} SOL
        </span>
        <span className="badge">⚡ Instant reveal</span>
        <span className={`badge ${t.active ? "green" : "danger"}`}>
          {t.active ? "Live" : "Paused"}
        </span>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn primary" disabled={disabled || busy} onClick={oneClickOpen}>
          {busy ? (
            <>
              <span className="spin" /> Opening…
            </>
          ) : (
            <>Open</>
          )}
        </button>
      </div>

      {ok ? <div className="toast ok">{ok}</div> : null}
      {err ? <div className="toast">{err}</div> : null}
    </div>
  );
}
