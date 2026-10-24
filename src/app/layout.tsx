import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Celisafe — Find your next safe table",
  description: "Discover and share celiac-aware restaurant finds with your travel circle.",
  applicationName: "Celisafe",
  manifest: "/manifest.json",
};

export const viewport: Viewport = { themeColor: "#f7edf7" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <header className="sticky top-0 z-20 border-b border-white/70 bg-white/75 backdrop-blur-xl">
          <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8" aria-label="Main navigation">
            <Link href="/" className="flex items-center gap-3" aria-label="Celisafe home">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-pink-200 via-purple-200 to-sky-200 text-lg font-black text-violet-900 shadow-sm">C</span>
              <span className="text-xl font-black tracking-tight text-slate-800">celisafe<span className="text-violet-600">.</span></span>
            </Link>
            <span className="hidden rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-800 sm:inline-flex">A little more confidence, wherever you eat</span>
            <a href="#add-restaurant" className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700">Add a find <span aria-hidden="true">＋</span></a>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl px-5 py-7 sm:px-8 sm:py-10">{children}</main>
        <footer className="mx-auto max-w-7xl px-5 pb-8 text-xs leading-5 text-slate-500 sm:px-8">Celisafe helps organize community knowledge; it can’t guarantee a meal is safe for celiac disease. Always confirm ingredients and cross-contact controls directly with restaurant staff.</footer>
      </body>
    </html>
  );
}
