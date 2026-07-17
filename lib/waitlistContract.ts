import { ethers } from "ethers";

export const WAITLIST_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_WAITLIST_CONTRACT_ADDRESS!;

export const WAITLIST_ABI = [
  "function joinWaitlist(string email, string referralCode) external",
];

interface SignableWallet {
  address: string;
  getEthereumProvider: () => Promise<any>;
}

// Calls joinWaitlist using the PLAYER's own wallet as signer, so msg.sender
// on-chain is the player — not the faucet. Works for Privy embedded wallets,
// external wallets, and MiniPay's injected wallet, since all three expose
// getEthereumProvider().
export async function joinWaitlistOnChain(
  wallet: SignableWallet,
  email: string,
  referralCode: string,
): Promise<string> {
  if (!WAITLIST_CONTRACT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_WAITLIST_CONTRACT_ADDRESS is not configured.");
  }

  const ethereumProvider = await wallet.getEthereumProvider();
  const browserProvider = new ethers.BrowserProvider(ethereumProvider);
  const signer = await browserProvider.getSigner();
  const contract = new ethers.Contract(WAITLIST_CONTRACT_ADDRESS, WAITLIST_ABI, signer);

  const tx = await contract.joinWaitlist(email, referralCode);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Waitlist registration transaction did not confirm.");
  return receipt.hash;
}