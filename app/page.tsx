"use client";

import { useRef, useState, useCallback } from "react";

interface EntropyResponse {
  seedHex: string;
  source: string;
  curbyRound: number | null;
  curbyTimestamp: string | null;
  beaconReachable: boolean;
  note: string;
  healthCheck: {
    nBytes: number;
    bitBalance: number;
    bitBalanceVerdict: string;
    shannonEntropy: number;
    entropyVerdict: string;
    serialCorrelation: number;
    sampleSizeNote: string;
  };
}

// Deterministic PRNG seeded from real entropy bytes (mulberry32) -- used
// only to turn the bytes into visual parameters, NOT for anything
// cryptographic. The randomness itself already happened upstream.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromHex(hex: string): number {
  let seed = 0;
  for (let i = 0; i < 8; i++) {
    seed = (seed << 4) | parseInt(hex[i], 16);
  }
  return seed;
}

function drawFingerprint(canvas: HTMLCanvasElement, seedHex: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const size = canvas.width;
  const rand = mulberry32(seedFromHex(seedHex));

  ctx.fillStyle = "#050810";
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2, cy = size / 2;
  const symmetry = 6 + Math.floor(rand() * 6); // 6-11 fold symmetry
  const rings = 4 + Math.floor(rand() * 5);
  const hueBase = Math.floor(rand() * 360);

  ctx.translate(cx, cy);

  for (let ring = 0; ring < rings; ring++) {
    const radius = ((ring + 1) / rings) * (size * 0.42);
    const pointsInRing = symmetry * (1 + (ring % 2));
    const hue = (hueBase + ring * 37) % 360;
    const alpha = 0.35 + rand() * 0.5;

    for (let p = 0; p < pointsInRing; p++) {
      const angle = (p / pointsInRing) * Math.PI * 2 + rand() * 0.15;
      const jitter = (rand() - 0.5) * radius * 0.15;
      const r = radius + jitter;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      const dotSize = 2 + rand() * (6 - ring * 0.4);

      ctx.beginPath();
      ctx.arc(x, y, Math.max(dotSize, 1), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 85%, 65%, ${alpha})`;
      ctx.shadowBlur = 12;
      ctx.shadowColor = `hsla(${hue}, 85%, 65%, 0.8)`;
      ctx.fill();

      if (ring > 0) {
        const prevRadius = (ring / rings) * (size * 0.42);
        const px = Math.cos(angle) * prevRadius;
        const py = Math.sin(angle) * prevRadius;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(px, py);
        ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${alpha * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [entropy, setEntropy] = useState<EntropyResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/entropy");
      const data: EntropyResponse = await res.json();
      setEntropy(data);
      if (canvasRef.current) {
        drawFingerprint(canvasRef.current, data.seedHex);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const sourceColor =
    entropy?.source === "curby-quantum" ? "text-emerald-400" :
    entropy?.source === "curby-classical" ? "text-amber-400" : "text-red-400";

  return (
    <main className="min-h-screen bg-[#050810] text-slate-200 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-light tracking-widest bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          QUANTUM FINGERPRINT
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          A unique pattern generated from real quantum-beacon entropy -- never the same twice
        </p>
      </div>

      <canvas
        ref={canvasRef}
        width={480}
        height={480}
        className="rounded-xl border border-slate-800 shadow-2xl"
      />

      <button
        onClick={generate}
        disabled={loading}
        className="px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-medium disabled:opacity-40 hover:opacity-90 transition"
      >
        {loading ? "Fetching quantum entropy..." : "Generate My Fingerprint"}
      </button>

      {entropy && (
        <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-lg p-4 text-xs font-mono space-y-1.5">
          <div>
            source: <span className={sourceColor}>{entropy.source}</span>
          </div>
          {entropy.curbyRound && (
            <div>CURBy round: <span className="text-slate-300">{entropy.curbyRound}</span></div>
          )}
          <div>bit balance: <span className="text-slate-300">{entropy.healthCheck.bitBalance}</span> ({entropy.healthCheck.bitBalanceVerdict})</div>
          <div>Shannon entropy: <span className="text-slate-300">{entropy.healthCheck.shannonEntropy} bits/byte</span></div>
          <div className="text-slate-600 text-[10px] pt-1">{entropy.note}</div>
        </div>
      )}
    </main>
  );
}
