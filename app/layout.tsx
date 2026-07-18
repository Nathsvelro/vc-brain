import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The VC Brain",
  description: "AI-native venture fund OS — sourcing to decision in 24 hours",
};

const nav = [
  { href: "/", label: "Pipeline" },
  { href: "/sourcing", label: "Sourcing" },
  { href: "/founders", label: "Founders" },
  { href: "/thesis", label: "Thesis" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <aside className="fixed inset-y-0 left-0 z-20 flex w-52 flex-col border-r border-border bg-card px-4 py-6">
            <Link href="/" className="mb-8 block">
              <div className="text-lg font-bold tracking-tight">
                The VC <span className="text-accent">Brain</span>
              </div>
              <div className="mt-0.5 text-[11px] leading-tight text-muted">$100K checks in 24 hours</div>
            </Link>
            <nav className="flex flex-col gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-background hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto">
              <Link
                href="/apply"
                className="block rounded-lg bg-accent px-3 py-2 text-center text-sm font-semibold text-white hover:opacity-90"
              >
                Apply for $100K
              </Link>
              <p className="mt-3 text-[11px] leading-snug text-muted">
                Deck + company name is all it takes. Decision within 24 hours.
              </p>
            </div>
          </aside>
          <main className="ml-52 flex-1 px-8 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
