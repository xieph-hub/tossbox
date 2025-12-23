"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import WalletButton from "../walletButton";
import { useWallet } from "@solana/wallet-adapter-react";

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

export default function PlayPage() {
  const { publicKey, connected } = useWallet();
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
        if (!cancelled) setPageError(e?.message || "Failed to load tiers.");
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
        <Link className="brand" href="/">
          tossbox.fun
        </Link>
        <WalletButton />
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Choose a box</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          Connect wallet, pick a tier, pay, reveal.
        </p>

        {!connected && (
          <p className="muted">Connect your wallet to open boxes.</p>
        )}

        {pageError ? (
          <p className="muted" style={{ color: "#ffb3b3" }}>
            {pageError}
          </p>
        ) : null}

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

                {!t.active ? (
                  <p className="muted" style={{ marginTop: 10 }}>
                    This box is temporarily unavailable.
                  </p>
                ) : null}

                <div style={{ marginTop: 12 }}>
                  <OpenButton
                    tierId={t.id}
                    disabled={!connected || !t.active}
                    wallet={walletBase58}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function OpenButton({ tierId, disabled, wallet }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function startOpen() {
    setErr("");
    setBusy(true);

    try {
      if (!wallet) throw new Error("Connect your wallet first.");

      const data = await fetchJsonSafe("/api/open/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId, wallet }),
      });

      // Expect: { openId, amountLamports, treasury }
      if (!data?.openId) throw new Error("Missing openId from server.");
      if (!data?.amountLamports) throw new Error("Missing amountLamports from server.");
      if (!data?.treasury) throw new Error("Missing treasury from server.");

      window.location.href = `/reveal/${data.openId}?amount=${encodeURIComponent(
        data.amountLamports
      )}&to=${encodeURIComponent(data.treasury)}`;
    } catch (e) {
      setErr(e?.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="btn primary"
        disabled={disabled || busy}
        onClick={startOpen}
      >
        {busy ? "Preparing..." : "Open"}
      </button>

      {err ? (
        <p className="muted" style={{ color: "#ffb3b3", marginTop: 10 }}>
          {err}
        </p>
      ) : null}
    </>
  );
}
