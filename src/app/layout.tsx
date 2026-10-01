import type { Metadata } from "next";

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
    <html lang="pl">
      <body
      >
        <div>
          {children}
        </div>
      </body>
    </html>
  );
}
