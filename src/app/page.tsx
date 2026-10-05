import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)]">
      <div className="max-w-2xl text-center">
        <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
          Ohana Kooperatywa Edukacyjna
        </h1>

        <p className="mt-4 text-lg text-muted-foreground">
          Wspieramy rozwój dzieci i rodzin.
        </p>

        <p className="mt-6 text-sm text-muted-foreground">
          Tworzymy bezpieczne, inspirujące i wspólnotowe przestrzenie edukacyjne,
          które pomagają dzieciom, rodzicom i nauczycielom rozwijać się razem.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register">
            <Button variant="default" size="md">Zapisz się</Button>
          </Link>
          <Link href="#o-nas">
            <Button variant="outline" size="md">
              Poznaj ofertę
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
