import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div>
      <main>
        <h1>
          Polityka Prywatności
        </h1>
        <p>
          Wersja 1.0 · Data wejścia w życie: {new Date().toLocaleDateString("pl-PL")}
        </p>

        <div>
          <h2>
            1. Administrator danych
          </h2>
          <p>
            Administratorem danych osobowych przetwarzanych w serwisie Ohana jest{" "}
            <strong>Mia Kossakowska</strong>, osoba fizyczna
            prowadząca Kooperatywę Edukacyjną Ohana.
          </p>
          <p>
            Kontakt w sprawach danych osobowych:
          </p>
          <ul>
            <li>e-mail: kooperatywa@ohana.edu.pl</li>
            <li>telefon: +48 509 080 993</li>
          </ul>
          <p>
            Ohana jest serwisem tworzonym i prowadzonym nieodpłatnie przez społeczność rodzin
            edukacji domowej. Nie pobieramy opłat za korzystanie z serwisu i nie prowadzimy w jego
            ramach działalności zarobkowej.
          </p>

          <h2>
            2. Zakres, cele i podstawy prawne przetwarzania
          </h2>
          <p>
            Przetwarzamy wyłącznie dane niezbędne do realizacji celów opisanych poniżej. Poniżej
            wskazujemy cel, zakres danych oraz podstawę prawną.
          </p>

          <h3>
            2.1 Utworzenie i prowadzenie konta użytkownika
          </h3>
          <p>
            (rejestracja, logowanie, sesja, obsługa konta)
          </p>
          <ul>
            <li>
              <strong>Dane:</strong> nazwa profilu, liczba dzieci,
              wiek dzieci, zainteresowania, miasto, kod pocztowy, województwo, dane kontaktowe
              (telefon, e-mail, profil Facebook, Instagram) oraz adres e-mail. Uwierzytelnianie
              obsługuje <strong>Supabase Auth</strong>; Ohana nie
              przechowuje haseł użytkowników.
            </li>
            <li>
              <strong>Podstawa:</strong> art. 6 ust. 1 lit. b RODO
              — przetwarzanie niezbędne do zawarcia i wykonania umowy o prowadzenie konta.
            </li>
          </ul>

          <h3>
            2.2 Prowadzenie profilu rodziny w serwisie
          </h3>
          <ul>
            <li>
              <strong>Dane:</strong> dane profilu wskazane w pkt
              2.1.
            </li>
            <li>
              <strong>Podstawa:</strong> art. 6 ust. 1 lit. b RODO
              — wykonanie umowy o prowadzenie profilu.
            </li>
          </ul>

          <h3>
            2.3 Prezentacja rodziny na mapie edukacji domowej
          </h3>
          <ul>
            <li>
              <strong>Dane publikowane na mapie:</strong> nazwa
              profilu, lokalizacja (miasto, kod pocztowy, województwo), zainteresowania, liczba i
              wiek dzieci oraz wszystkie podane przez użytkownika dane kontaktowe (telefon, e-mail,
              profil Facebook, Instagram).
            </li>
            <li>
              <strong>Podstawa:</strong> art. 6 ust. 1 lit. a RODO
              — zgoda. Publikacja nie następuje domyślnie: aby dane pojawiły się na mapie,
              użytkownik musi świadomie włączyć odpowiednią opcję. Zgodę można wycofać w dowolnym
              momencie (np. wyłączając opcję lub usuwając konto), co nie wpływa na zgodność z prawem
              przetwarzania dokonanego przed jej wycofaniem.
            </li>
          </ul>

          <h3>
            2.4 Zgłoszenie dziecka do enrollmentu (zapisu do szkoły) i obsługa zgłoszenia
          </h3>
          <ul>
            <li>
              <strong>Dane:</strong> dane rodziców/opiekunów (imię
              i nazwisko, telefon, e-mail, profil Facebook) oraz dane dziecka (imię i nazwisko, data
              i miejsce urodzenia, PESEL, adres zamieszkania, klasa).
            </li>
            <li>
              <strong>Podstawa — dane rodzica/opiekuna:</strong>{" "}
              art. 6 ust. 1 lit. b RODO — dane są niezbędne do podjęcia działań na żądanie rodzica i
              realizacji procesu zapisu.
            </li>
            <li>
              <strong>Podstawa — dane dziecka:</strong> art. 6 ust.
              1 lit. f RODO — prawnie uzasadniony interes Administratora polegający na
              przeprowadzeniu, na żądanie rodzica, procesu zgłoszenia i zapisu dziecka do szkoły.
              Przetwarzamy wyłącznie dane niezbędne do tego celu i uwzględniamy szczególną ochronę
              danych dzieci. Ocena równowagi interesów dla tej podstawy została przeprowadzona i jest
              przechowywana w dokumentacji Administratora (nie jest częścią niniejszej polityki).
            </li>
          </ul>

          <h3>
            2.5 Przygotowanie i obsługa zgłoszeń w związku z planowaną współpracą z West River
            Academy
          </h3>
          <ul>
            <li>
              <strong>Dane:</strong> dane rodziców i dzieci wskazane
              w pkt 2.4, w zakresie niezbędnym do obsługi zgłoszenia.
            </li>
            <li>
              <strong>Cel:</strong> dane są zbierane i przechowywane
              w celu obsługi zgłoszenia w systemie Ohana. West River Academy jest planowanym odbiorcą
              danych enrollmentu. Faktyczne przekazanie danych do WRA nastąpi dopiero po zapewnieniu
              mechanizmu transferu danych zgodnego z rozdziałem V RODO.{" "}
              <strong>
                Do czasu zapewnienia odpowiedniego mechanizmu transferu danych zgodnego z rozdziałem
                V RODO Administrator nie przekazuje danych osobowych użytkowników ani dzieci do West
                River Academy w Stanach Zjednoczonych.
              </strong>
            </li>
            <li>
              <strong>Podstawa:</strong> jak w pkt 2.4 — art. 6 ust.
              1 lit. b RODO (dane rodzica/opiekuna) oraz art. 6 ust. 1 lit. f RODO (dane dziecka).
            </li>
          </ul>

          <h3>
            2.6 Zapewnienie bezpieczeństwa, utrzymanie i rozwój serwisu
          </h3>
          <ul>
            <li>
              <strong>Dane:</strong> dane techniczne, adresy IP,
              dane o aktywności, logi systemowe i serwerowe, dane niezbędne do monitorowania i
              ochrony serwisu.
            </li>
            <li>
              <strong>Podstawa:</strong> art. 6 ust. 1 lit. f RODO —
              prawnie uzasadniony interes Administratora w zapewnieniu bezpieczeństwa, stabilności i
              funkcjonalności serwisu.
            </li>
          </ul>

          <h3>
            2.7 Realizacja praw osób, których dane dotyczą, oraz obsługa zgłoszeń
          </h3>
          <ul>
            <li>
              <strong>Dane:</strong> dane kontaktowe oraz treść
              zgłoszeń.
            </li>
            <li>
              <strong>Podstawa:</strong> art. 6 ust. 1 lit. c RODO
              (obowiązki wynikające z RODO) oraz art. 6 ust. 1 lit. f RODO.
            </li>
          </ul>

          <h3>2.8 Płatności</h3>
          <p>
            Serwis Ohana nie obsługuje płatności elektronicznych, nie korzysta z bramek płatniczych i
            nie przechowuje danych kart płatniczych ani danych rachunków bankowych użytkowników.
            Opłaty związane z enrollmentem do West River Academy są realizowane poza serwisem, w
            formie przelewu na rachunek Fundacji Młodzi dla Młodych. Fundacja otrzymuje dane widoczne
            w związku z realizacją przelewu bankowego, w szczególności imię i nazwisko
            rodzica/opiekuna, w zakresie niezbędnym do identyfikacji płatności. Środki są przeznaczone
            na pokrycie opłat związanych z
            enrollmentem do West River Academy. Administrator Ohana nie otrzymuje wynagrodzenia z
            tytułu tych płatności.
          </p>

          <h2>
            3. Dobrowolność podania danych
          </h2>
          <p>
            Dane podawane są przez użytkowników w trakcie rejestracji oraz składania zgłoszeń.
            Podanie danych niezbędnych do utworzenia konta, prowadzenia profilu i obsługi zgłoszeń
            jest dobrowolne, ale konieczne do korzystania z tych funkcji. PESEL przetwarzany jest
            wyłącznie w związku z zapisem dziecka do szkoły.
          </p>

          <h2>
            4. Podmioty przetwarzające i odbiorcy danych
          </h2>
          <p>
            Dane przekazywane są wyłącznie w zakresie niezbędnym do realizacji celów opisanych w pkt
            2.
          </p>
          <p>
            <strong>
              Podmioty przetwarzające (procesorzy) — umowy powierzenia zgodnie z art. 28 RODO:
            </strong>
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — infrastruktura bazy danych
              i uwierzytelniania; dane przechowywane są w regionie UE (West EU, Paryż — infrastruktura
              AWS). Dostęp do danych ograniczony jest zgodnie z modelem uprawnień.
            </li>
            <li>
              <strong>Vercel</strong> — hosting i infrastruktura
              aplikacji; statystyki odwiedzin (Vercel Web Analytics) przetwarzane są w sposób
              nieidentyfikujący użytkowników.
            </li>
            <li>
              <strong>Sentry</strong> — diagnostyka błędów aplikacji;
              przetwarzanie odbywa się w regionie UE (Frankfurt) i jest skonfigurowane tak, aby nie
              obejmowało danych identyfikujących użytkowników ani treści formularzy.
            </li>
          </ul>
          <p>
            <strong>Odbiorcy:</strong>
          </p>
          <ul>
            <li>
              <strong>West River Academy (USA)</strong> — planowany
              odbiorca danych enrollmentu. Na dzień publikacji niniejszej polityki WRA nie otrzymuje
              danych z serwisu Ohana. WRA jest odrębnym podmiotem (odrębnym administratorem danych), a
              nie podmiotem przetwarzającym w rozumieniu art. 28 RODO. Przekazanie danych nastąpi
              wyłącznie po zapewnieniu mechanizmu transferu zgodnego z rozdziałem V RODO.
            </li>
            <li>
              <strong>Fundacja Młodzi dla Młodych</strong> — odbiorca
              danych wyłącznie w zakresie imienia i nazwiska rodzica/opiekuna, niezbędnego do
              identyfikacji płatności związanych z enrollmentem do West River Academy. Fundacja nie
              jest podmiotem przetwarzającym w rozumieniu art. 28 RODO w stosunku do Ohany.
            </li>
          </ul>

          <h2>
            5. Przekazywanie danych poza EOG
          </h2>
          <p>
            Dane enrollmentów są przechowywane przede wszystkim w Supabase w wybranym regionie UE
            (West EU, Paryż). Administrator korzysta również z dostawców infrastruktury wskazanych w
            pkt 4, którzy mogą przetwarzać dane w innych państwach zgodnie z obowiązującymi ich
            mechanizmami transferowymi i umowami dotyczącymi ochrony danych. Administrator stosuje
            wymagania rozdziału V RODO w zakresie, w jakim dochodzi do przekazania danych poza EOG.
          </p>
          <p>
            <strong>
              Na dzień wejścia w życie niniejszej polityki Administrator nie przekazuje danych
              enrollmentów do West River Academy w Stanach Zjednoczonych. Przekazanie takich danych
              nastąpi dopiero po zapewnieniu właściwego mechanizmu transferowego zgodnego z rozdziałem
              V RODO.
            </strong>
          </p>
          <p>
            <strong>PESEL</strong> jest szczególnie chroniony:
            przetwarzany wyłącznie w celu obsługi zapisu, przechowywany w infrastrukturze Ohany
            (Supabase, West EU — Paryż). Nie jest publikowany na mapie ani przekazywany do narzędzi
            analitycznych, monitorujących lub statystycznych.
          </p>

          <h2>
            6. Okresy przechowywania danych
          </h2>
          <ul>
            <li>
              <strong>Konto i profil:</strong> przez okres
              korzystania z serwisu; po usunięciu konta dane są usuwane, chyba że dalsze
              przechowywanie wynika z przepisów prawa.
            </li>
            <li>
              <strong>Mapa:</strong> dane publikowane są do czasu
              wyłączenia opcji lub usunięcia konta.
            </li>
            <li>
              <strong>Zgłoszenia odrzucone:</strong> dane odrzuconego
              zgłoszenia przechowywane są 30 dni od daty odrzucenia, a następnie usuwane, chyba że
              istnieje konkretna podstawa wymagająca dalszego przechowywania. Usunięcie odrzuconego
              zgłoszenia nie oznacza automatycznego usunięcia współdzielonego rekordu dziecka, jeżeli
              jest on nadal potrzebny w innym zgłoszeniu lub historii.
            </li>
            <li>
              <strong>Zgłoszenia nierozstrzygnięte:</strong> termin
              30 dni jest docelowym terminem na rozpatrzenie zgłoszenia przez Administratora, nie
              stanowi automatycznego terminu usunięcia danych.
            </li>
            <li>
              <strong>
                Zaakceptowane enrollmenty i dokumentacja ucznia:
              </strong>{" "}
              przez okres nauki. Po zakończeniu nauki dane przechowywane są wyłącznie przez okres
              rzeczywiście potrzebny do obsługi lub przekazania dokumentacji albo wynikający z
              obowiązków prawnych.
            </li>
            <li>
              <strong>Dane techniczne i logi:</strong> przez okres
              niezbędny do celów bezpieczeństwa i utrzymania serwisu.
            </li>
          </ul>

          <h2>
            7. Bezpieczeństwo danych
          </h2>
          <p>
            Administrator stosuje{" "}
            <strong>
              odpowiednie i proporcjonalne środki techniczne i organizacyjne
            </strong>{" "}
            w celu ochrony danych, w tym szyfrowanie transmisji (TLS), bezpieczne uwierzytelnianie
            (Supabase Auth), ograniczenie dostępu zgodnie z modelem uprawnień oraz kontrolę dostępu do
            infrastruktury. Jednocześnie nie składamy gwarancji absolutnego bezpieczeństwa systemów
            informatycznych — bezpieczeństwo zależy również od czynników pozostających poza naszą
            kontrolą.
          </p>
          <p>
            Prywatne dane enrollmentów, dzieci i PESEL{" "}
            <strong>nie są publiczne</strong>. Dostęp w aplikacji
            jest ograniczony zgodnie z modelem uprawnień.
          </p>
          <p>
            Ohana korzysta z zewnętrznych dostawców infrastruktury — Supabase, Vercel i Sentry.{" "}
            <strong>
              Administrator odpowiada za swoje obowiązki w zakresie określonym prawem; dostawcy
              odpowiadają za swoje obowiązki w zakresie określonym prawem oraz właściwymi umowami.
            </strong>{" "}
            Niniejsza polityka nie rozszerza ani nie ogranicza ustawowej odpowiedzialności
            którejkolwiek ze stron. Administrator nie ponosi automatycznej odpowiedzialności za
            incydenty lub wycieki występujące po stronie Supabase, Vercel, Sentry czy innego
            dostawcy.
          </p>

          <h2>
            8. Naruszenia ochrony danych
          </h2>
          <p>
            W przypadku naruszenia ochrony danych osobowych Administrator podejmuje działania
            wymagane przez obowiązujące przepisy, odpowiednio do charakteru incydentu, w tym: ocenę
            ryzyka dla praw i wolności osób, których dane dotyczą, współpracę z właściwym dostawcą
            oraz — jeżeli wystąpi taki obowiązek — zgłoszenie naruszenia właściwemu organowi
            nadzorczemu lub poinformowanie osób, których dane dotyczą.
          </p>

          <h2>
            9. Prawa osób, których dane dotyczą
          </h2>
          <p>
            Osobom, których dane dotyczą, przysługują — w zakresie i na zasadach wynikających z RODO,
            zależnie od podstawy prawnej i okoliczności konkretnego przetwarzania — prawa, w tym:
          </p>
          <ul>
            <li>prawo dostępu do danych (art. 15),</li>
            <li>prawo do sprostowania danych (art. 16),</li>
            <li>prawo do usunięcia danych (art. 17),</li>
            <li>prawo do ograniczenia przetwarzania (art. 18),</li>
            <li>prawo do przenoszenia danych (art. 20),</li>
            <li>prawo sprzeciwu wobec przetwarzania (art. 21),</li>
            <li>
              prawo do wycofania zgody w dowolnym momencie (art. 7 ust. 3) — bez wpływu na zgodność z
              prawem przetwarzania dokonanego przed jej wycofaniem,
            </li>
            <li>prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych.</li>
          </ul>
          <p>
            Wnioski w powyższych sprawach można składać pod adresem kooperatywa@ohana.edu.pl.
            Odpowiadamy na wnioski bez zbędnej zwłoki, w terminie określonym przepisami.
          </p>

          <h2>
            10. Cookies i sesja
          </h2>
          <p>
            Serwis korzysta wyłącznie z niezbędnych mechanizmów sesyjnych (w tym cookies niezbędnych
            do utrzymania sesji logowania).{" "}
            <strong>
              Nie stosujemy cookies śledzących ani marketingowych.
            </strong>{" "}
            Statystyki odwiedzin realizowane są przez Vercel Web Analytics w sposób nieidentyfikujący
            użytkowników (bez cookies, dane anonimizowane, w tym adresy IP przechowywane wyłącznie w
            formie nieumożliwiającej identyfikacji).
          </p>

          <h2>
            11. Profilowanie i automatyczne podejmowanie decyzji
          </h2>
          <p>
            Nie stosujemy profilowania ani automatycznego podejmowania decyzji, w tym nie dokonujemy
            automatycznej oceny zgłoszeń, punktacji ani scoringu.
          </p>

          <h2>
            12. Postanowienia końcowe
          </h2>
          <p>
            Niniejsza Polityka wchodzi w życie z dniem jej faktycznej publikacji. Polityka może być
            aktualizowana; o istotnych zmianach poinformujemy użytkowników w sposób dostępny w
            serwisie.
          </p>

          <p>
            Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")}
          </p>
        </div>

        <Link
          href="/"
        >
          ← Powrót do strony głównej
        </Link>
      </main>
    </div>
  );
}
