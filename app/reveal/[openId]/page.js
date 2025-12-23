"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WalletButton from "../../walletButton";

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
    throw new Error(msg);
  }

  return data;
}

function rarityBadge(r) {
  const v = (r || "").toLowerCase();
  if (v === "legendary") return "warn";
  if (v === "rare") return "brand";
  return "green";
}

export default function RevealPage({ params }) {
  const { openId } = params;

  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [reward, setReward] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function load() {
      try {
        setErr("");
        const data = await fetchJsonSafe(`/api/reveal/${encodeURIComponent(openId)}`, {
          method: "GET",
        });

        if (cancelled) return;

        setOpen(data.open || null);
        setReward(data.reward || null);

        const isRevealed = data.open?.status === "REVEALED" && data.reward;
        setLoading(!isRevealed);

        if (!isRevealed) {
          timer = setTimeout(load, 1200);
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load reveal.");
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [openId]);

  return (
    <>
      <div className="nav">
        <div className="brand">
          <span className="logoDot" />
          <div>
            <Link href="/">tossbox.fun</Link>
            <div className="subbrand">Reveal</div>
          </div>
        </div>
        <WalletButton />
      </div>

      <div className="hero">
        <div className="hTag">🎁 Opening result</div>
        <div className="big" style={{ fontSize: 34 }}>
          {loading ? "Revealing…" : "You pulled something."}
        </div>
        <div className="muted">
          {loading
            ? "We’re verifying on-chain and finalizing your reward. This usually takes a second."
            : "Screenshot it. Share it. Or open another."}
        </div>

        {loading ? (
          <div style={{ marginTop: 14 }} className="muted">
            <span className="spin" style={{ marginRight: 10, display: "inline-block" }} />
            Processing…
          </div>
        ) : null}

        {err ? <div className="toast">{err}</div> : null}
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Details</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" href="/play">Open another</Link>
            <Link className="btn ghost" href="/">Home</Link>
          </div>
        </div>

        <div className="hr" />

        <div className="grid">
          <div className="cardGlass">
            <div className="mutedSmall">Open ID</div>
            <div style={{ fontWeight: 900, wordBreak: "break-all" }}>{openId}</div>
            <div style={{ marginTop: 10 }}>
              <span className={`badge ${open?.status === "REVEALED" ? "green" : "warn"}`}>
                Status: {open?.status || "UNKNOWN"}
              </span>
            </div>
          </div>

          <div className="cardGlass">
            <div className="mutedSmall">Reward</div>
            {reward ? (
              <>
                <div style={{ fontWeight: 950, fontSize: 18, marginTop: 6 }}>
                  {reward.type === "TOKEN" && reward.symbol === "SOL"
                    ? `SOL`
                    : reward.type}
                </div>
                <div className="mutedSmall" style={{ marginTop: 6 }}>
                  {reward.type === "TOKEN" && reward.amount ? `Amount: ${reward.amount} SOL` : ""}
                </div>
                <div style={{ marginTop: 10 }}>
                  <span className={`badge ${rarityBadge(reward.rarity)}`}>
                    Rarity: {reward.rarity || "unknown"}
                  </span>
                </div>
              </>
            ) : (
              <div className="muted">No reward yet…</div>
            )}
          </div>

          <div className="cardGlass">
            <div className="mutedSmall">Next</div>
            <div className="muted" style={{ marginTop: 6 }}>
              If you won SOL, it will be paid automatically from the payout wallet.
            </div>
            <div style={{ marginTop: 12 }}>
              <Link className="btn primary" href="/play">Open again</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
