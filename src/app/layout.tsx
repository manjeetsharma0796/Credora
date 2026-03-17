import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bitcoin Booster | Amplified sBTC Yield on Stacks",
  description: "One-click leveraged yield vault for sBTC. Deposit Bitcoin, earn amplified USDCx rewards automatically on the Stacks network.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </body>
    </html>
  );
}
