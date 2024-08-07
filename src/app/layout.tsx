import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const baseOG = {
  description: "A Twitter for My manager transfer",
  title: "Manager Transfer",
  images: "https://github.com/Portkey-Wallet/portkey-web/blob/master/logo.png?raw=true",
};

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
  openGraph: baseOG,
  twitter: {
    ...baseOG,
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
