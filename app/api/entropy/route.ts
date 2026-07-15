import { NextResponse } from "next/server";
import { getSessionEntropy } from "@/lib/curby";

export async function GET() {
  const entropy = await getSessionEntropy();

  return NextResponse.json({
    seedHex: entropy.seedBytes.toString("hex"),
    source: entropy.source,
    curbyRound: entropy.curbyRound,
    curbyTimestamp: entropy.curbyTimestamp,
    beaconReachable: entropy.beaconReachable,
    note: entropy.note,
    healthCheck: entropy.healthCheck,
  });
}
