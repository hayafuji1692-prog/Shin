import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { RegisterServiceWorker } from "@/components/ui/RegisterServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "家計簿",
  description: "SMBC Vpass連携の家計簿アプリ",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-512.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "家計簿",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f6f4f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <RegisterServiceWorker />
        <header className="header">
          <span className="header-title">家計簿</span>
          <nav className="nav">
            <Link href="/">ダッシュボード</Link>
            <Link href="/transactions">取引一覧</Link>
            <Link href="/rules">ルール管理</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
