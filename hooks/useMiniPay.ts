import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

export function useMiniPay() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    const provider = (window as any).ethereum;
    if (provider?.isMiniPay) setIsMiniPay(true);
  }, []);

  useEffect(() => {
    if (isMiniPay && !authenticated) login();
  }, [isMiniPay, authenticated, login]);

  // Find the wallet Privy picked up from MiniPay's injected provider
  const miniPayWallet = wallets.find(
    (w) =>
      w.walletClientType !== "privy" &&
      (window as any).ethereum?.isMiniPay
  );

  const address = miniPayWallet?.address ?? null;
  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  return {
    isMiniPay,
    address,
    shortAddress,
    wallet: miniPayWallet ?? null,
  };
}