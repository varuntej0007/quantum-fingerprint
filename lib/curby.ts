/**
 * CURBy entropy client -- TypeScript port of the Python version, same
 * verified logic: fetch the "randomness" stage of CURBy's Twine chain,
 * mix with fresh local randomness for per-session uniqueness, and
 * disclose the real source honestly (quantum / classical / fallback).
 *
 * Pure Node.js standard library + Web Crypto (no native/compiled deps),
 * so this runs identically on Windows, macOS, Linux, and ARM (Pi).
 */
import { randomBytes, createHash } from "crypto";

const CURBY_URL = "https://random.colorado.edu/api/curbyq/round/latest";

export interface SessionEntropy {
  seedBytes: Buffer;
  source: "curby-quantum" | "curby-classical" | "local-fallback";
  curbyRound: number | null;
  curbyTimestamp: string | null;
  beaconReachable: boolean;
  note: string;
  healthCheck: EntropyHealth;
}

export interface EntropyHealth {
  nBytes: number;
  bitBalance: number;
  bitBalanceVerdict: string;
  shannonEntropy: number;
  entropyVerdict: string;
  serialCorrelation: number;
  sampleSizeNote: string;
}

function analyzeEntropy(bytes: Buffer): EntropyHealth {
  const n = bytes.length;
  if (n === 0) {
    return {
      nBytes: 0, bitBalance: 0, bitBalanceVerdict: "n/a",
      shannonEntropy: 0, entropyVerdict: "n/a", serialCorrelation: 0,
      sampleSizeNote: "no data",
    };
  }

  let ones = 0;
  for (const b of bytes) {
    ones += b.toString(2).split("1").length - 1;
  }
  const bitBalance = ones / (n * 8);

  const counts = new Map<number, number>();
  for (const b of bytes) counts.set(b, (counts.get(b) || 0) + 1);
  let shannon = 0;
  for (const c of counts.values()) {
    const p = c / n;
    shannon -= p * Math.log2(p);
  }

  let serialCorrelation = 0;
  if (n > 1) {
    const mean = bytes.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n - 1; i++) num += (bytes[i] - mean) * (bytes[i + 1] - mean);
    for (const b of bytes) den += (b - mean) ** 2;
    serialCorrelation = den ? num / den : 0;
  }

  const maxPossibleEntropy = Math.min(8.0, Math.log2(n));

  return {
    nBytes: n,
    bitBalance: Math.round(bitBalance * 10000) / 10000,
    bitBalanceVerdict: bitBalance >= 0.45 && bitBalance <= 0.55 ? "within range" : "flagged -- small sample",
    shannonEntropy: Math.round(shannon * 10000) / 10000,
    entropyVerdict: shannon >= maxPossibleEntropy * 0.9 ? "within range (near sample-size ceiling)" : "flagged -- small sample",
    serialCorrelation: Math.round(serialCorrelation * 10000) / 10000,
    sampleSizeNote: `n=${n} bytes -- indicative only, not a certified NIST SP 800-22/90B run`,
  };
}

async function fetchCurbyPulse(): Promise<{
  roundNum: number; timestamp: string; rawBytes: Buffer; isQuantum: boolean | null;
}> {
  const res = await fetch(CURBY_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`CURBy HTTP ${res.status}`);
  const data = await res.json();

  let randomnessPayload: any = null;
  let isQuantum: boolean | null = null;

  for (const item of data) {
    const payload = item?.data?.content?.payload;
    if (!payload) continue;
    if (payload.stage === "randomness") randomnessPayload = payload;
    if (payload.stage === "request") isQuantum = payload.parameters?.isQuantum ?? null;
  }

  if (!randomnessPayload) throw new Error("no 'randomness' stage entry found in CURBy response");

  const b64 = randomnessPayload.randomness["/"]["bytes"];
  const rawBytes = Buffer.from(b64, "base64");

  return {
    roundNum: randomnessPayload.round,
    timestamp: randomnessPayload.timestamp,
    rawBytes,
    isQuantum,
  };
}

export async function getSessionEntropy(): Promise<SessionEntropy> {
  const localNonce = randomBytes(32);
  const sessionTime = new Date().toISOString();

  try {
    const pulse = await fetchCurbyPulse();
    const combined = createHash("sha3-256")
      .update(Buffer.concat([pulse.rawBytes, localNonce, Buffer.from(sessionTime)]))
      .digest();

    return {
      seedBytes: combined,
      source: pulse.isQuantum ? "curby-quantum" : "curby-classical",
      curbyRound: pulse.roundNum,
      curbyTimestamp: pulse.timestamp,
      beaconReachable: true,
      note: "CURBy pulse mixed with local session nonce + timestamp for per-session uniqueness",
      healthCheck: analyzeEntropy(pulse.rawBytes),
    };
  } catch (e: any) {
    const combined = createHash("sha3-256")
      .update(Buffer.concat([localNonce, Buffer.from(sessionTime)]))
      .digest();

    return {
      seedBytes: combined,
      source: "local-fallback",
      curbyRound: null,
      curbyTimestamp: null,
      beaconReachable: false,
      note: `CURBy unreachable (${e.message}); using local CSPRNG only`,
      healthCheck: analyzeEntropy(localNonce),
    };
  }
}
