"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
      (text && text.slice(0, 220)) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function rarityTone(r) {
  const v = (r || "").toLowerCase();
  if (v === "legendary") return "warn";
  if (v === "rare") return "brand";
  return "green";
}

function prettyRewardTitle(reward) {
  if (!reward) return "—";
  if (reward.type === "TOKEN" && reward.symbol === "SOL") {
    return reward.amount ? `${reward.amount} SOL` : "SOL";
  }
  if (reward.type === "TICKET") return "Free Box Ticket";
  if (reward.type === "CREDIT") return "Credits";
  return reward.type || "Reward";
}

/**
 * SFX helper (same as play page)
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
    if (aud.current.reveal) aud.current.reveal.volume = 0.65;
    if (aud.current.win) aud.current.win.volume = 0.85;
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
    } catch {}
  }

  return { muted, toggle, play };
}

export default function RevealPage({ params }) {
  const openId = params?.openId;

  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [reward, setReward] = useState(null);
  const [err, setErr] = useState("");

  const [fx, setFx] = useState("loading"); // loading | revealed
  const [pulse, setPulse] = useState(false);

  const { muted, toggle, play } = useSfx();

  const rewardTitle = useMemo(() => prettyRewardTitle(reward), [reward]);
  const rarity = reward?.rarity || "";
  const isLegendary = (rarity || "").toLowerCase() === "legendary";

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function loadOnce() {
      try {
        setErr("");

        const data = await fetchJsonSafe(`/api/reveal/${encodeURIComponent(openId)}`, {
          method: "GET",
        });

        if (cancelled) return;

        setOpen(data.open || null);
        setReward(data.reward || null);

        const isRevealed = data.open?.status === "REVEALED" && !!data.reward;

        if (isRevealed) {
          setLoading(false);
          setFx("revealed");
          setPulse(true);

          // tiny beat for drama
          await sleep(180);
          await play("reveal");

          if ((data.reward?.rarity || "").toLowerCase() === "legendary") {
            await sleep(180);
            await play("win");
          }

          setTimeout(() => setPulse(false), 800);
          return;
        }

        setLoading(true);
        setFx("loading");
        timer = setTimeout(loadOnce, 1200);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load reveal.");
        setLoading(false);
      }
    }

    loadOnce();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [openId, play]);

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

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn" onClick={toggle} title="Toggle sound">
            {muted ? "🔇 Sound Off" : "🔊 Sound On"}
          </button>
          <WalletButton />
        </div>
      </div>

      <div className="hero">
        <div className="hTag">🎁 Opening result</div>

        <div className="big" style={{ fontSize: 34 }}>
          {loading ? "Revealing…" : "You pulled something."}
        </div>

        <div className="muted">
          {loading
            ? "We’re verifying on-chain and finalizing your reward. This usually takes a second."
            : "Keep it moving. Open another, or screenshot the pull."}
        </div>

        {err ? <div className="toast">{err}</div> : null}
      </div>

      <div style={{ height: 14 }} />

      {/* Reveal card */}
      <div
        className="card"
        style={{
          position: "relative",
          overflow: "hidden",
          border:
            fx === "revealed" && isLegendary
              ? "1px solid rgba(251,191,36,.28)"
              : undefined,
          boxShadow:
            fx === "revealed" && isLegendary
              ? "0 22px 80px rgba(251,191,36,.10)"
              : undefined,
        }}
      >
        {/* legendary aura */}
        {fx === "revealed" && isLegendary ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -80,
              background:
                "radial-gradient(closest-side at 50% 40%, rgba(251,191,36,.20), transparent 60%)",
              pointerEvents: "none",
            }}
          />
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Your pull</div>
            <div className="mutedSmall" style={{ marginTop: 6 }}>
              Open ID: <span style={{ fontWeight: 900 }}>{openId}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" href="/play">
              Open another
            </Link>
            <Link className="btn ghost" href="/">
              Home
            </Link>
          </div>
        </div>

        <div className="hr" />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          <div className="cardGlass">
            <div className="mutedSmall">Status</div>
            <div style={{ marginTop: 10 }}>
              <span className={`badge ${open?.status === "REVEALED" ? "green" : "warn"}`}>
                {open?.status || "UNKNOWN"}
              </span>
            </div>
            <div className="mutedSmall" style={{ marginTop: 10 }}>
              {loading ? "Confirming payment…" : "Finalized."}
            </div>
          </div>

          <div
            className="cardGlass"
            style={{
              transform: pulse ? "scale(1.02)" : "scale(1)",
              transition: "transform 240ms ease",
            }}
          >
            <div className="mutedSmall">Reward</div>
            <div
              style={{
                fontWeight: 950,
                fontSize: 22,
                marginTop: 10,
                letterSpacing: "-.2px",
              }}
            >
              {loading ? "—" : rewardTitle}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span className={`badge ${rarityTone(reward?.rarity)}`}>
                Rarity: {reward?.rarity || "—"}
              </span>
              {reward?.type ? <span className="badge">Type: {reward.type}</span> : null}
            </div>

            {reward?.aiLine ? (
              <div className="mutedSmall" style={{ marginTop: 12 }}>
                “{reward.aiLine}”
              </div>
            ) : null}
          </div>

          <div className="cardGlass">
            <div className="mutedSmall">Next</div>
            <div className="muted" style={{ marginTop: 10 }}>
              {isLegendary
                ? "Legendary pull. Screenshot it."
                : "Feeling lucky? Run it back."}
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn primary" href="/play">
                Open again
              </Link>
              <button
                className="btn"
                onClick={() => {
                  try {
                    const text = `I just opened a TossBox and pulled ${rewardTitle} (${reward?.rarity}). tossbox.fun`;
                    navigator.clipboard.writeText(text);
                  } catch {}
                }}
                disabled={loading || !reward}
                title="Copy share text"
              >
                Copy share
              </button>
            </div>

            {loading ? (
              <div className="muted" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
                <span className="spin" /> Waiting…
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
