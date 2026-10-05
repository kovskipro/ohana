import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "@/app/globals.css";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "Ohana | Kooperatywa Edukacyjna",
  description: "Ohana - Kooperatywa Edukacyjna. Wspieramy rozwój dzieci i rodzin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${GeistSans.variable} dark`}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <Navbar />
        <main className="container mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
