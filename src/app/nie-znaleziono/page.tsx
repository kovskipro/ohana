import Link from "next/link";

export const runtime = "nodejs";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 text-center">
      <div className="space-y-4">
        <h1 className="font-heading text-4xl font-bold">Strona nie znaleziona</h1>
        <p className="text-muted-foreground max-w-sm">
          Przepraszamy, strona, której szukasz nie istnieje lub została przeniesiona.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Powrót na stronę główną
        </Link>
      </div>
    </main>
  );
}
