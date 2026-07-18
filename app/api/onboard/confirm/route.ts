import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://celo.drpc.org";
const WAITLIST_CONTRACT_ADDRESS = process.env.WAITLIST_CONTRACT_ADDRESS;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!WAITLIST_CONTRACT_ADDRESS || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[onboard/confirm] Missing required env vars");
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// ─── POST handler ────────────────────────────────────────────────────────────
// The client signs joinWaitlist with the player's own wallet, then reports
// the resulting tx hash here. We independently verify on-chain that the tx
// succeeded, targeted the right contract, and was actually sent by the
// claimed wallet — never trust the client's word alone — before marking
// the user onboarded.

export async function POST(req: NextRequest) {
  try {
    if (!WAITLIST_CONTRACT_ADDRESS || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server config error." }, { status: 500 });
    }

    let body: any;
    try { body = await req.json(); } catch { body = {}; }

    const wallet: string | undefined = body.wallet;
    const txHash: string | undefined = body.txHash;

    if (!wallet || !ethers.isAddress(wallet)) {
      return NextResponse.json({ error: "Missing or invalid wallet address." }, { status: 400 });
    }
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "Missing or invalid transaction hash." }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();
    const provider = new ethers.JsonRpcProvider(CELO_RPC_URL);

    console.log(`[onboard/confirm] Verifying tx ${txHash.slice(0, 10)}... for ${normalizedWallet}`);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return NextResponse.json({ error: "Transaction not found or not yet mined." }, { status: 404 });
    }
    if (receipt.status !== 1) {
      return NextResponse.json({ error: "Transaction reverted on-chain." }, { status: 400 });
    }
    if (receipt.to?.toLowerCase() !== WAITLIST_CONTRACT_ADDRESS.toLowerCase()) {
      return NextResponse.json({ error: "Transaction does not match the waitlist contract address." }, { status: 400 });
    }
    if (receipt.from.toLowerCase() !== normalizedWallet) {
      return NextResponse.json({ error: "Transaction was not sent by the claimed wallet." }, { status: 400 });
    }

    const { error: dbError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          wallet: normalizedWallet,
          waitlist_tx: receipt.hash,
          onboarded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "wallet" },
      );

    if (dbError) {
      console.warn("[onboard/confirm] Supabase upsert warning:", dbError.message);
    }

    console.log("[onboard/confirm] ✅ Registration confirmed and recorded");
    return NextResponse.json({ success: true, wallet: normalizedWallet, waitlistTx: receipt.hash });

  } catch (err: any) {
    console.error("[onboard/confirm] ❌ Fatal error:", err?.message);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}