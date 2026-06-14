"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email", "google", "twitter", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#a78bfa",
          logo: "",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          // If you need Solana support, add:
          // solana: {
          //   createOnLogin: "users-without-wallets",
          // },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}