"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
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
      (text && text.slice(0, 220)) ||
      `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatSol(sol) {
  const n = Number(sol) || 0;
  return n.toFixed(3);
}

function tierAccent(tierId) {
  if (tierId === "starter") return "brand";
  if (tierId === "alpha") return "green";
  return "warn";
}

function tierVibe(tierId) {
  if (tierId === "starter") return { emoji: "🟣", label: "Low stakes, fast fun" };
  if (tierId === "alpha") return { emoji: "🟢", label: "Better odds, bigger pulls" };
  return { emoji: "🟡", label: "High risk, high drama" };
}

/**
 * SFX helper (persists mute preference)
 */
function useSfx() {
  const [muted, setMuted] = useState(false);
  const aud = useRef({ click: null, open: null, reveal: null, win: null });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tossbox_muted");
      if (saved === "1") setMuted(true);
    } catch {}
  }, []);

  useEffect(() => {
    aud.current.click = new Audio("/sfx/click.mp3");
    aud.current.open = new Audio("/sfx/open.mp3");
    aud.current.reveal = new Audio("/sfx/reveal.mp3");
    aud.current.win = new Audio("/sfx/win.mp3"); // optional

    if (aud.current.click) aud.current.click.volume = 0.35;
    if (aud.current.open) aud.current.open.volume = 0.45;
    if (aud.current.reveal) aud.current.reveal.volume = 0.6;
    if (aud.current.win) aud.current.win.volume = 0.75;
  }, []);

  function toggle() {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem("tossbox_muted", next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  async function play(name) {
    if (muted) return;
    const a = aud.current?.[name];
    if (!a) return;
    try {
      a.currentTime = 0;
      await a.play();
    } catch {
      // autoplay restrictions can block; ignore
    }
  }

  return { muted, toggle, play };
}

export default function PlayPage() {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();

  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const { muted, toggle, play } = useSfx();

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
            <div className="subbrand">Pick a box. Approve. Reveal.</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn" onClick={toggle} title="Toggle sound">
            {muted ? "🔇 Sound Off" : "🔊 Sound On"}
          </button>
          <WalletButton />
        </div>
      </div>

      <div className="hero">
        <div className="heroTop">
          <div>
            <div className="hTag">⚡ One-click open • Wallet signs • Instant reveal</div>
            <div className="big">Choose your chaos.</div>
            <div className="muted">
              Tap <b>Open</b> → approve in wallet → we confirm on-chain → you get the reveal.
              Clean flow, clear states, no manual transfers.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <Link className="btn ghost" href="/">
                ← Home
              </Link>
              <span className={`badge ${connected ? "green" : "danger"}`}>
                {connected ? "Wallet ready" : "Connect wallet"}
              </span>
              <span className="badge brand">Memo enabled</span>
            </div>
          </div>

          <div className="cardGlass" style={{ minWidth: 320 }}>
            <div className="kpiTop">
              <div className="kpiLabel">How it works</div>
              <span className="badge">3 steps</span>
            </div>
            <div className="hr" />
            <Step n="1" title="Pick a tier" desc="Starter, Alpha, Deity — choose your risk." />
            <Step n="2" title="Approve in wallet" desc="You’ll see the amount before you sign." />
            <Step n="3" title="Instant reveal" desc="We verify payment on-chain, then reveal." />
          </div>
        </div>

        {pageError ? <div className="toast">{pageError}</div> : null}
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Choose a box</div>
            <div className="mutedSmall">Hover cards. Feel the glow. Tap Open when ready.</div>
          </div>
          <Link className="btn primary" href="/">
            Back
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
                play={play}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Step({ n, title, desc }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
      <span className="badge brand" style={{ minWidth: 34, justifyContent: "center" }}>
        {n}
      </span>
      <div>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div className="mutedSmall" style={{ marginTop: 2 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

function TierCard({ t, disabled, wallet, connection, sendTransaction, play }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [stateFx, setStateFx] = useState("idle"); // idle | hover | opening | success
  const vibe = tierVibe(t.id);

  async function oneClickOpen() {
    setErr("");
    setOk("");
    setBusy(true);
    setStateFx("opening");

    try {
      if (!wallet) throw new Error("Connect your wallet first.");

      await play("click");

      setOk("Preparing…");
      const created = await fetchJsonSafe("/api/open/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: t.id, wallet }),
      });

      const openId = created.openId;
      const treasuryStr = created.treasury;
      const amountLamports = Number(created.amountLamports);

      if (!openId) throw new Error("Missing openId.");
      if (!treasuryStr) throw new Error("Missing treasury.");
      if (!Number.isFinite(amountLamports) || amountLamports <= 0) throw new Error("Invalid price.");

      const treasury = new PublicKey(treasuryStr);
      const fromPubkey = new PublicKey(wallet);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: treasury,
          lamports: amountLamports,
        })
      );

      // Memo (nice for Phantom dapp verification context)
      const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      const memoText = `TossBox: open ${t.name} (${t.id}) | openId:${openId}`;
      const memoData = new TextEncoder().encode(memoText);
      tx.add({ programId: MEMO_PROGRAM_ID, keys: [], data: memoData });

      try {
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;
      } catch {}

      await play("open");
      await sleep(250);

      setOk("Approve in wallet…");
      const signature = await sendTransaction(tx, connection);

      setOk("Confirming on-chain…");
      await connection.confirmTransaction(signature, "confirmed");

      setOk("Revealing…");
      await fetchJsonSafe("/api/open/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openId, txSignature: signature }),
      });

      await play("reveal");
      setStateFx("success");

      window.location.href = `/reveal/${encodeURIComponent(openId)}`;
    } catch (e) {
      setErr(e?.message || "Something went wrong.");
      setStateFx("idle");
    } finally {
      setBusy(false);
      setTimeout(() => setOk(""), 1200);
    }
  }

  const priceSol = formatSol(t.price_sol);

  const shimmer =
    t.id === "alpha"
      ? "linear-gradient(90deg, transparent, rgba(34,197,94,.18), transparent)"
      : t.id === "starter"
      ? "linear-gradient(90deg, transparent, rgba(124,92,255,.18), transparent)"
      : "linear-gradient(90deg, transparent, rgba(251,191,36,.18), transparent)";

  const openingStyle =
    stateFx === "opening"
      ? { transform: "translateY(-2px) rotate(-0.4deg)", boxShadow: "0 18px 70px rgba(124,92,255,.22)" }
      : undefined;

  return (
    <div
      className="tier"
      onMouseEnter={() => setStateFx((s) => (s === "opening" ? s : "hover"))}
      onMouseLeave={() => setStateFx((s) => (s === "opening" ? s : "idle"))}
      style={{ ...openingStyle, position: "relative", overflow: "hidden" }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          transform: stateFx === "hover" ? "translateX(0)" : "translateX(-55%)",
          transition: "transform 600ms ease",
          background: shimmer,
          opacity: stateFx === "hover" ? 1 : 0,
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div className="tierName">
          {vibe.emoji} {t.name}
        </div>
        <span className={`badge ${tierAccent(t.id)}`}>Tier</span>
      </div>

      <div className="mutedSmall" style={{ marginTop: 6 }}>
        {vibe.label}
      </div>

      <div className="tierMeta">
        <span className="badge">💰 {priceSol} SOL</span>
        <span className="badge">⚡ Instant reveal</span>
        <span className={`badge ${t.active ? "green" : "danger"}`}>{t.active ? "Live" : "Paused"}</span>
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

        <button className="btn" disabled={busy} onClick={() => (window.location.href = "/")} title="Back">
          Home
        </button>
      </div>

      {ok ? <div className="toast ok">{ok}</div> : null}
      {err ? <div className="toast">{err}</div> : null}
    </div>
  );
}
