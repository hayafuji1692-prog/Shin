import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "家計簿",
  description: "SMBC Vpass連携の家計簿アプリ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="header">
          <span className="header-title">家計簿</span>
          <nav className="nav">
            <Link href="/">ダッシュボード</Link>
            <Link href="/transactions">取引一覧</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
