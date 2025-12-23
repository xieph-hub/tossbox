"use client";

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

function tierAccent(tierId) {
  if (tierId === "starter") return "brand";
  if (tierId === "alpha") return "green";
  return "warn";
}

function formatSol(sol) {
  const n = Number(sol) || 0;
  return n.toFixed(3);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Small SFX helper
 * - Works best on user gesture (click) — which we have.
 * - Stores mute preference in localStorage.
 */
function useSfx() {
  const [muted, setMuted] = useState(false);
  const aud = useRef({
    click: null,
    open: null,
    reveal: null,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tossbox_muted");
      if (saved === "1") setMuted(true);
    } catch {}
  }, []);

  useEffect(() => {
    // lazy init audio objects (client-only)
    aud.current.click = new Audio("/sfx/click.mp3");
    aud.current.open = new Audio("/sfx/open.mp3");
    aud.current.reveal = new Audio("/sfx/reveal.mp3");

    // keep volumes tasteful
    aud.current.click.volume = 0.35;
    aud.current.open.volume = 0.45;
    aud.current.reveal.volume = 0.6;
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
      // mobile can block audio sometimes; ignore silently
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
            <div className="subbrand">Lootboxes for degens • Mainnet</div>
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
            <div className="big">Pick a box. Approve. Reveal.</div>
            <div className="muted">
              You click Open → Phantom asks for approval → we confirm on-chain → you get the reveal.
              No manual transfers.
            </div>
          </div>

          <div className="cardGlass" style={{ minWidth: 300 }}>
            <div className="kpiTop">
              <div className="kpiLabel">Status</div>
              <span className={`badge ${connected ? "green" : "danger"}`}>
                {connected ? "Wallet Connected" : "Connect Wallet"}
              </span>
            </div>
            <div className="hr" />
            <div className="mutedSmall">
              You will always see a wallet approval popup before any payment is sent.
            </div>
            <div style={{ marginTop: 10 }}>
              <span className="badge brand">Memo enabled</span>{" "}
              <span className="mutedSmall">(helps Phantom show context)</span>
            </div>
          </div>
        </div>

        <div className="kpiRow">
          <div className="kpi">
            <div className="kpiLabel">Flow</div>
            <div className="kpiValue">Open → Approve → Confirm → Reveal</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Network</div>
            <div className="kpiValue">Solana Mainnet</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Experience</div>
            <div className="kpiValue">One click</div>
          </div>
        </div>

        {pageError ? <div className="toast">{pageError}</div> : null}
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Choose a box</div>
            <div className="mutedSmall">Tap Open and approve in Phantom/Solflare.</div>
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
                play={play}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function TierCard({ t, disabled, wallet, connection, sendTransaction, play }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [anim, setAnim] = useState(""); // "shake" | "glow"

  async function oneClickOpen() {
    setErr("");
    setOk("");
    setBusy(true);

    try {
      if (!wallet) throw new Error("Connect your wallet first.");

      await play("click");
      setAnim("glow");
      await sleep(120);

      // 1) Create open server-side (locks tier + returns treasury + amount)
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

      // 2) Build tx: SOL transfer + MEMO (Phantom context)
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: treasury,
          lamports: amountLamports,
        })
      );

      // Memo Program (standard)
      const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      const memoText = `TossBox: open ${t.name} (${t.id}) | openId:${openId}`;
      const memoData = new TextEncoder().encode(memoText);

      tx.add({
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: memoData,
      });

      // OPTIONAL: set latest blockhash for smoother wallet UX
      try {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;
      } catch {
        // wallet adapter can handle this; ignore if RPC hiccups
      }

      // 3) UX: show "Preparing..." briefly BEFORE wallet popup
      setOk("Preparing transaction…");
      setAnim("shake");
      await play("open");
      await sleep(350);

      // 4) Ask wallet to sign/send (Phantom approval)
      setOk("Approve in your wallet…");
      const signature = await sendTransaction(tx, connection);

      setOk("Confirming on-chain…");
      await connection.confirmTransaction(signature, "confirmed");

      // 5) Confirm server-side (verifies payment + assigns reward + triggers payout if SOL)
      setOk("Finalizing reveal…");
      await fetchJsonSafe("/api/open/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openId, txSignature: signature }),
      });

      await play("reveal");

      // 6) Go to reveal page
      window.location.href = `/reveal/${encodeURIComponent(openId)}`;
    } catch (e) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
      setTimeout(() => setAnim(""), 420);
    }
  }

  const priceSol = formatSol(t.price_sol);

  return (
    <div
      className="tier"
      style={{
        transform:
          anim === "shake"
            ? "translateY(-2px) rotate(-0.3deg)"
            : undefined,
        boxShadow:
          anim === "glow"
            ? "0 18px 70px rgba(124,92,255,.28)"
            : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div className="tierName">{t.name}</div>
        <span className={`badge ${tierAccent(t.id)}`}>Tier</span>
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

        <button
          className="btn"
          disabled={busy}
          onClick={() => window.location.href = "/"}
          title="Back"
        >
          Home
        </button>
      </div>

      {ok ? <div className="toast ok">{ok}</div> : null}
      {err ? <div className="toast">{err}</div> : null}
    </div>
  );
}
