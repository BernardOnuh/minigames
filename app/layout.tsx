import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "MINIGAMES - Play games. Earn rewards.",
  description: "Play mini games and earn crypto rewards on Celo.",
  other: {
    "talentapp:project_verification": "1e99f5463ca9a74e8f4f74dbabf065fa38277a447104048c68fb329132bb83a11c8c38d146ccc776847008dddd49c54633cc07ad11fe6c393641794a2e9d35e0",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}