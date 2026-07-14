"use client";

import { useCallback, useEffect, useRef } from "react";
import { joinWaitlistOnChain } from "@/lib/waitlistContract";

interface SignableWallet {
  address: string;
  getEthereumProvider: () => Promise<any>;
}

interface OnboardingOptions {
  wallet: SignableWallet | null; // the actual wallet object — needed to sign registration
  authenticated: boolean;
  referralCode?: string;
  email?: string;
  onSuccess?: (result: { dripTx: string | null; waitlistTx: string | null; dripAmount: string }) => void;
  onError?: (error: string, partial?: { dripTx: string | null }) => void;
}

// Bumped to v3 — earlier flags reflected onboarding flows that never
// validated registration succeeded (or registered the faucet, not the
// player). Stale flags must not short-circuit the corrected flow.
const LOCAL_KEY = (address: string) => `mg_onboarded_v4_${address.toLowerCase()}`;

export function useOnboarding({
  wallet,
  authenticated,
  referralCode,
  email,
  onSuccess,
  onError,
}: OnboardingOptions) {
  const inFlight = useRef(false);
  const lastAttemptedAddress = useRef<string | null>(null);

  const run = useCallback(async (targetWallet: SignableWallet) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const address = targetWallet.address;
    lastAttemptedAddress.current = address.toLowerCase();

    let dripTxForError: string | null = null;

    try {
      // 1. Server drips gas — idempotent, skips if this wallet was already dripped.
      const dripRes = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, email }),
      });
      const dripData = await dripRes.json().catch(() => ({}));

      if (!dripRes.ok) {
        onError?.(dripData.error || `HTTP ${dripRes.status}`, { dripTx: null });
        return;
      }

      dripTxForError = dripData.dripTx ?? null;

      // Already fully registered in a prior session — done.
      if (dripData.registered) {
        localStorage.setItem(LOCAL_KEY(address), "1");
        onSuccess?.({ dripTx: dripData.dripTx ?? null, waitlistTx: null, dripAmount: "0" });
        return;
      }

      // 2. Player's own wallet signs the registration — required, since the
      // contract has no address param and registers msg.sender.
      const waitlistTxHash = await joinWaitlistOnChain(targetWallet, email ?? "", referralCode ?? "");

      // 3. Server independently verifies the tx on-chain before recording it.
      const confirmRes = await fetch("/api/onboard/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, txHash: waitlistTxHash }),
      });
      const confirmData = await confirmRes.json().catch(() => ({}));

      if (!confirmRes.ok) {
        onError?.(confirmData.error || `HTTP ${confirmRes.status}`, { dripTx: dripTxForError });
        return;
      }

      localStorage.setItem(LOCAL_KEY(address), "1");
      onSuccess?.({
        dripTx: dripData.dripTx ?? null,
        waitlistTx: confirmData.waitlistTx ?? waitlistTxHash,
        dripAmount: dripData.dripAmount ?? "0",
      });
    } catch (err: any) {
      // Covers wallet signature rejection, gas estimation failure, RPC errors, etc.
      onError?.(err?.message ?? "Unknown error", { dripTx: dripTxForError });
    } finally {
      inFlight.current = false;
    }
  }, [email, referralCode, onSuccess, onError]);

  useEffect(() => {
    if (!wallet || !authenticated) return;
    if (lastAttemptedAddress.current === wallet.address.toLowerCase()) return;

    if (localStorage.getItem(LOCAL_KEY(wallet.address)) === "1") {
      lastAttemptedAddress.current = wallet.address.toLowerCase();
      onSuccess?.({ dripTx: null, waitlistTx: null, dripAmount: "0" });
      return;
    }

    run(wallet);
  }, [wallet, authenticated, run]);

  // Exposed so the UI can offer "Try again" after an error (e.g. the user
  // rejected the signature prompt, or a transient RPC issue) without
  // requiring a page reload or wallet change.
  const retry = useCallback(() => {
    if (!wallet) return;
    lastAttemptedAddress.current = null;
    run(wallet);
  }, [wallet, run]);

  return { retry };
}