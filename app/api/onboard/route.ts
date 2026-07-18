import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

const requiredEnvVars = {
  CELO_RPC_URL: process.env.CELO_RPC_URL,
  FAUCET_PRIVATE_KEY: process.env.FAUCET_PRIVATE_KEY,
  DRIP_AMOUNT_CELO: process.env.DRIP_AMOUNT_CELO || "0.01",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, val]) => !val)
  .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error("[onboard] Missing env vars:", missingVars);
  }

const RPC_URL = requiredEnvVars.CELO_RPC_URL || "https://celo.drpc.org";
const FAUCET_PRIVATE_KEY = requiredEnvVars.FAUCET_PRIVATE_KEY!;
const DRIP_AMOUNT = ethers.parseEther(requiredEnvVars.DRIP_AMOUNT_CELO);

const supabase = createClient(
  requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL!,
  requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY!,
);

function generateGuestEmail(wallet: string): string {
  return `player_${wallet.slice(2, 10).toLowerCase()}@minigame.app`;
}

// ─── POST handler ────────────────────────────────────────────────────────────
// This route ONLY drips gas. Waitlist registration is intentionally NOT done
// here — the contract's joinWaitlist(string,string) has no address parameter,
// meaning it almost certainly registers msg.sender. If this route called it,
// it would register the FAUCET's address, not the player's. Registration is
// done client-side by the player's own wallet (see lib/waitlistContract.ts)
// and confirmed via /api/onboard/confirm.

export async function POST(req: NextRequest) {
  try {
    if (missingVars.length > 0) {
      return NextResponse.json(
        { error: `Server configuration is incomplete.` },
        { status: 500 },
      );
    }

    let body: any;
    try { body = await req.json(); } catch { body = {}; }

    const wallet: string | undefined = body.wallet;
    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet address." }, { status: 400 });
    }
    if (!ethers.isAddress(wallet)) {
      return NextResponse.json({ error: `Invalid wallet address: ${wallet}` }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();
    const email: string = body.email || generateGuestEmail(normalizedWallet);

    console.log(`[onboard] Processing drip for: ${normalizedWallet}`);

    // Idempotency: never drip the same wallet twice, even across retries.
    const { data: existing, error: queryError } = await supabase
      .from("user_profiles")
      .select("drip_tx, waitlist_tx, onboarded_at")
      .eq("wallet", normalizedWallet)
      .maybeSingle();

    if (queryError) throw new Error(`Database error: ${queryError.message}`);

    if (existing?.drip_tx) {
      console.log(`[onboard] Wallet already dripped (${existing.drip_tx}), skipping`);
      return NextResponse.json({
        success: true,
        wallet: normalizedWallet,
        dripTx: existing.drip_tx,
        dripAmount: "0",
        alreadyDripped: true,
        registered: !!existing.waitlist_tx,
      });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const faucet = new ethers.Wallet(FAUCET_PRIVATE_KEY, provider);

    const faucetBalance = await provider.getBalance(faucet.address);
    const dripAmountFormatted = ethers.formatEther(DRIP_AMOUNT);

    if (faucetBalance < DRIP_AMOUNT) {
      return NextResponse.json(
        { error: `Faucet insufficient funds (${ethers.formatEther(faucetBalance)} CELO)` },
        { status: 503 },
      );
    }

    console.log(`[onboard] Sending ${dripAmountFormatted} CELO to ${wallet}...`);
    const dripTx = await faucet.sendTransaction({
      to: wallet,
      value: DRIP_AMOUNT,
      gasLimit: 21_000,
    });
    const dripReceipt = await dripTx.wait();
    if (!dripReceipt) throw new Error("Drip transaction failed");
    console.log(`[onboard] Drip confirmed at block ${dripReceipt.blockNumber}`);

    const { error: dbError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          wallet: normalizedWallet,
          email,
          drip_tx: dripReceipt.hash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "wallet" },
      );

    if (dbError) {
      console.warn("[onboard] Supabase upsert warning:", dbError.message);
    }

    return NextResponse.json({
      success: true,
      wallet: normalizedWallet,
      dripTx: dripReceipt.hash,
      dripAmount: dripAmountFormatted,
      alreadyDripped: false,
      registered: false,
    });

  } catch (err: any) {
    console.error("[onboard] Fatal error:", err?.message);
    return NextResponse.json(
      {
        success: false,
        error: err?.message ?? "Internal server error",
        details: process.env.NODE_ENV === "development" ? err?.stack : undefined,
      },
      { status: 500 },
    );
  }
}