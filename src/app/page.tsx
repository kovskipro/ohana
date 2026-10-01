import Link from "next/link";

export default function Home() {
  return (
    <div>
      <main>
        <div>
          <div>
            Ohana Kooperatywa Edukacyjna
          </div>

          <h1>
            Wspieramy rozwój dzieci i rodzin.
          </h1>

          <p>
            Tworzymy bezpieczne, inspirujące i wspólnotowe przestrzenie edukacyjne,
            które pomagają dzieciom, rodzicom i nauczycielom rozwijać się razem.
          </p>

          <div>
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
    </div>
  );
}
