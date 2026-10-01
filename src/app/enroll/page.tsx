"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  validateEmail,
  validatePhoneNumber,
  validatePostalCode,
  validatePESEL,
  VOIVODESHIPS,
  SCHOOL_CLASSES,
} from "@/lib/validation";

const SCHOOL_YEARS = ["2026/2027", "2027/2028", "2028/2029", "2029/2030"];

// Karta = jedno dziecko w bieżącym zapisie. Dziecko istniejące w profilu ma
// childId (tożsamość readonly — model i RPC kopiują ją z tabeli children).
// „nowe dziecko" ma childId = null; tworzone w bazie (add_child) dopiero przy
// wysyłce zapisu, gdy karta ma wybraną klasę.
interface ChildCard {
  key: string;
  childId: string | null;
  isNew: boolean;
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace: string;
  pesel: string;
  street: string;
  houseNumber: string;
  city: string;
  postalCode: string;
  voivodeship: string;
  schoolClass: string;
}

interface AvailableChild {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  birth_place: string;
  pesel: string;
}

interface ChildPrefill {
  street: string;
  house_number: string;
  city: string;
  postal_code: string;
  voivodeship: string;
  school_class: string;
}

const newCard = (key?: string): ChildCard => ({
  key: key ?? crypto.randomUUID(),
  childId: null,
  isNew: true,
  firstName: "",
  lastName: "",
  birthDate: "",
  birthPlace: "",
  pesel: "",
  street: "",
  houseNumber: "",
  city: "",
  postalCode: "",
  voivodeship: "",
  schoolClass: "",
});

const existingCard = (
  child: AvailableChild,
  prefill?: ChildPrefill,
  key?: string,
): ChildCard => ({
  key: key ?? crypto.randomUUID(),
  childId: child.id,
  isNew: false,
  firstName: child.first_name,
  lastName: child.last_name,
  birthDate: child.birth_date ?? "",
  birthPlace: child.birth_place ?? "",
  pesel: child.pesel ?? "",
  street: prefill?.street ?? "",
  houseNumber: prefill?.house_number ?? "",
  city: prefill?.city ?? "",
  postalCode: prefill?.postal_code ?? "",
  voivodeship: prefill?.voivodeship ?? "",
  schoolClass: prefill?.school_class ?? "",
});

export default function EnrollPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [schoolYear, setSchoolYear] = useState(SCHOOL_YEARS[0]);
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentFbLink, setParentFbLink] = useState("");
  const [cards, setCards] = useState<ChildCard[]>([]);
  const [availableChildren, setAvailableChildren] = useState<AvailableChild[]>([]);
  const prefillRef = useRef<Map<string, ChildPrefill>>(new Map());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [prefillSource, setPrefillSource] = useState<string | null>(null);

  const nextSchoolYear = (year: string): string | null => {
    const idx = SCHOOL_YEARS.indexOf(year);
    if (idx === -1 || idx + 1 >= SCHOOL_YEARS.length) return null;
    return SCHOOL_YEARS[idx + 1];
  };

  const loadPrefill = useCallback(async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      router.push("/login");
      return;
    }

    const { data: enrollments } = await supabase
      .from("enrollments")
      .select(
        "id, school_year, parent_first_name, parent_last_name, parent_phone, parent_email, parent_fb_link, enrollment_children(child_id, street, house_number, city, postal_code, voivodeship, school_class)",
      )
      .eq("profile_id", user.user.id)
      .order("created_at", { ascending: false });

    const rows = (enrollments ?? []) as unknown as Array<{
      id: string;
      school_year: string;
      parent_first_name: string;
      parent_last_name: string;
      parent_phone: string;
      parent_email: string;
      parent_fb_link: string | null;
      enrollment_children: Array<{
        child_id: string;
        street: string;
        house_number: string;
        city: string;
        postal_code: string;
        voivodeship: string;
        school_class: string;
      }>;
    }>;

    const previous = rows[0];
    if (previous) {
      setPrefillSource(previous.id);
      setParentFirstName(previous.parent_first_name);
      setParentLastName(previous.parent_last_name);
      setParentPhone(previous.parent_phone);
      setParentEmail(previous.parent_email);
      setParentFbLink(previous.parent_fb_link ?? "");

      // Kolejny rok szkolny po ostatnim zgłoszeniu (jeśli na liście).
      const nextYear = nextSchoolYear(previous.school_year);
      if (nextYear) setSchoolYear(nextYear);

      prefillRef.current = new Map(
        previous.enrollment_children.map((c) => [c.child_id, c]),
      );
    } else {
      prefillRef.current = new Map();
    }

    const { data: children } = await supabase
      .from("children")
      .select("id, first_name, last_name, birth_date, birth_place, pesel");
    const avail = (children ?? []) as AvailableChild[];
    setAvailableChildren(avail);

    // Karta startowa: pierwsze istniejące dziecko z prefillem, albo — gdy
    // profil nie ma dzieci — pusta karta „nowe dziecko".
    setCards(
      avail.length > 0
        ? [existingCard(avail[0], prefillRef.current.get(avail[0].id))]
        : [newCard()],
    );
  }, [router, supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      loadPrefill();
    });
  }, [router, supabase, loadPrefill]);

  const updateCard = (key: string, field: keyof ChildCard, value: string) => {
    setCards((prev) =>
      prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)),
    );
  };

  // Wybór dziecka w karcie: "" = nowe dziecko (czysta karta), istniejące
  // dziecko = tożsamość readonly + prefill klasy/adresu z poprzedniego zapisu.
  const selectChildForCard = (key: string, childId: string) => {
    setCards((prev) =>
      prev.map((card) => {
        if (card.key !== key) return card;
        if (!childId) return newCard(key);
        const child = availableChildren.find((c) => c.id === childId);
        if (!child) return card;
        return existingCard(child, prefillRef.current.get(childId), key);
      }),
    );
  };

  const childOptionsFor = (key: string) => {
    const used = new Set(
      cards
        .filter((c) => c.key !== key && c.childId)
        .map((c) => c.childId),
    );
    return [
      { value: "", label: "— nowe dziecko —" },
      ...availableChildren
        .filter((c) => !used.has(c.id))
        .map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` })),
    ];
  };

  const addCard = () => setCards((prev) => [...prev, newCard()]);

  const removeCard = (key: string) =>
    setCards((prev) => prev.filter((c) => c.key !== key));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const newErrors: Record<string, string> = {};

    if (!parentFirstName.trim()) newErrors.parentFirstName = "Imię jest wymagane";
    if (!parentLastName.trim()) newErrors.parentLastName = "Nazwisko jest wymagane";
    if (!validateEmail(parentEmail)) newErrors.parentEmail = "Email nie jest poprawny";
    if (!validatePhoneNumber(parentPhone, "+48")) {
      newErrors.parentPhone = "Numer telefonu nie jest poprawny";
    }

    // Walidacja dotyczy tylko kart zgłaszanych (z wybraną klasą). Karta bez
    // klasy = „Nie zgłaszam" — nie uczestniczy w zapisie ani nie tworzy dziecka.
    const enrolled = cards.filter((c) => c.schoolClass);
    if (enrolled.length === 0) {
      newErrors.children = "Wybierz klasę dla co najmniej jednego dziecka";
    }
    cards.forEach((card, idx) => {
      if (!card.schoolClass) return;
      if (!card.street.trim()) newErrors[`c${idx}street`] = "Ulica jest wymagana";
      if (!card.houseNumber.trim()) newErrors[`c${idx}houseNumber`] = "Numer domu jest wymagany";
      if (!card.city.trim()) newErrors[`c${idx}city`] = "Miejscowość jest wymagana";
      if (!validatePostalCode(card.postalCode)) newErrors[`c${idx}postalCode`] = "Kod pocztowy XX-XXX";
      if (!card.voivodeship) newErrors[`c${idx}voivodeship`] = "Województwo jest wymagane";
      if (!card.childId) {
        if (!card.firstName.trim()) newErrors[`c${idx}firstName`] = "Imię jest wymagane";
        if (!card.lastName.trim()) newErrors[`c${idx}lastName`] = "Nazwisko jest wymagane";
        if (!card.birthDate) newErrors[`c${idx}birthDate`] = "Data urodzenia jest wymagana";
        if (!card.birthPlace.trim()) newErrors[`c${idx}birthPlace`] = "Miejsce urodzenia jest wymagane";
        if (!card.pesel.trim() || !validatePESEL(card.pesel)) {
          newErrors[`c${idx}pesel`] = "PESEL musi zawierać 11 cyfr";
        }
      }
    });

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    setErrors({});

    try {
      // Rozwiąż child_id dla nowych dzieci (add_child deduplikuje po PESEL),
      // potem utwórz zapis przez create_enrollment (bez zmian w RPC).
      const resolved: Array<{
        child_id: string;
        street: string;
        house_number: string;
        city: string;
        postal_code: string;
        voivodeship: string;
        school_class: string;
      }> = [];
      for (const card of enrolled) {
        let childId = card.childId;
        if (!childId) {
          const { data, error } = await supabase.rpc("add_child", {
            payload: {
              first_name: card.firstName.trim(),
              last_name: card.lastName.trim(),
              birth_date: card.birthDate,
              birth_place: card.birthPlace.trim(),
              pesel: card.pesel,
            },
          });
          if (error) {
            setErrors({ submit: `Nie udało się dodać dziecka: ${error.message}` });
            return;
          }
          childId = data as string;
        }
        resolved.push({
          child_id: childId,
          street: card.street,
          house_number: card.houseNumber,
          city: card.city,
          postal_code: card.postalCode,
          voivodeship: card.voivodeship,
          school_class: card.schoolClass,
        });
      }

      const { error } = await supabase.rpc("create_enrollment", {
        payload: {
          school_year: schoolYear,
          parent_first_name: parentFirstName,
          parent_last_name: parentLastName,
          parent_phone: parentPhone,
          parent_phone_country: "+48",
          parent_email: parentEmail,
          parent_fb_link: parentFbLink || null,
          children: resolved,
        },
      });
      if (error) {
        setErrors({ submit: `Nie udało się utworzyć zapisu: ${error.message}` });
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setErrors({
        submit: `Nie udało się utworzyć zapisu: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div>
      <main>
        <h1>
          Nowy zapis
        </h1>
        <p>
          Zgłoś dziecko na kolejny rok szkolny. Poprzednie zapisy pozostają
          bez zmian — dane poniżej są kopią Twojego ostatniego zgłoszenia i
          obowiązują wyłącznie dla nowego roku.
        </p>

        {prefillSource && (
          <p>
            Formularz został wypełniony danymi z Twojego poprzedniego zapisu.
          </p>
        )}

        <form onSubmit={handleSubmit}>
            <Card><CardContent>
            <p>
              Dane wspólne dla całego zapisu
            </p>

            <Select
              label="Rok szkolny"
              options={SCHOOL_YEARS.map((y) => ({ value: y, label: y }))}
              value={schoolYear}
              onChange={setSchoolYear}
            />

            <div>
              <Input
                label="Imię rodzica"
                placeholder="Jan"
                value={parentFirstName}
                onChange={(e) => setParentFirstName(e.target.value)}
                error={errors.parentFirstName}
              />
              <Input
                label="Nazwisko rodzica"
                placeholder="Kowalski"
                value={parentLastName}
                onChange={(e) => setParentLastName(e.target.value)}
                error={errors.parentLastName}
              />
            </div>

            <PhoneInput
              label="Numer telefonu"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              error={errors.parentPhone}
            />

            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              error={errors.parentEmail}
            />

            <Input
              label="Link do profilu Facebook (opcjonalnie)"
              placeholder="https://facebook.com/..."
              value={parentFbLink}
              onChange={(e) => setParentFbLink(e.target.value)}
            />
            </CardContent></Card>

            <Card><CardContent>
            <p>
              Dzieci — każda karta to jedno dziecko w zapisie
            </p>

            {cards.length === 0 && (
              <p>
                Brak dzieci w formularzu. Dodaj dziecko poniżej.
              </p>
            )}

            {cards.map((card, idx) => (
              <Card
                key={card.key}
              >
                <div>
                  <p>
                    Dziecko {idx + 1}
                    {card.isNew && (
                    <Badge variant="default">nowe</Badge>
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeCard(card.key)}
                  >
                    Usuń
                  </Button>
                </div>

                <Select
                  label="Dziecko"
                  options={childOptionsFor(card.key)}
                  value={card.childId ?? ""}
                  onChange={(v) => selectChildForCard(card.key, v)}
                  placeholder="— nowe dziecko —"
                />

                {card.childId ? (
                  <div>
                    <p>
                      {card.firstName} {card.lastName}
                    </p>
                    <p>
                      PESEL {card.pesel} · ur. {card.birthDate} ·{" "}
                      {card.birthPlace}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div>
                      <Input
                        label="Imię"
                        placeholder="Jan"
                        value={card.firstName}
                        onChange={(e) =>
                          updateCard(card.key, "firstName", e.target.value)
                        }
                        error={errors[`c${idx}firstName`]}
                      />
                      <Input
                        label="Nazwisko"
                        placeholder="Kowalski"
                        value={card.lastName}
                        onChange={(e) =>
                          updateCard(card.key, "lastName", e.target.value)
                        }
                        error={errors[`c${idx}lastName`]}
                      />
                    </div>
                    <div>
                      <Input
                        label="Data urodzenia"
                        type="date"
                        value={card.birthDate}
                        onChange={(e) =>
                          updateCard(card.key, "birthDate", e.target.value)
                        }
                        error={errors[`c${idx}birthDate`]}
                      />
                      <Input
                        label="Miejsce urodzenia"
                        placeholder="Warszawa"
                        value={card.birthPlace}
                        onChange={(e) =>
                          updateCard(card.key, "birthPlace", e.target.value)
                        }
                        error={errors[`c${idx}birthPlace`]}
                      />
                    </div>
                    <Input
                      label="PESEL"
                      placeholder="11111111111"
                      value={card.pesel}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                        updateCard(card.key, "pesel", val);
                      }}
                      error={errors[`c${idx}pesel`]}
                    />
                  </div>
                )}

                <Select
                  label="Klasa"
                  options={SCHOOL_CLASSES.map((c) => ({
                    value: c,
                    label: c,
                  }))}
                  value={card.schoolClass}
                  onChange={(value) =>
                    updateCard(card.key, "schoolClass", value)
                  }
                  placeholder="Nie zgłaszam"
                />

                <div>
                  <div>
                    <Input
                      label="Ulica"
                      placeholder="ul. Główna"
                      value={card.street}
                      onChange={(e) =>
                        updateCard(card.key, "street", e.target.value)
                      }
                      error={errors[`c${idx}street`]}
                    />
                    <Input
                      label="Numer domu"
                      placeholder="10"
                      value={card.houseNumber}
                      onChange={(e) =>
                        updateCard(card.key, "houseNumber", e.target.value)
                      }
                      error={errors[`c${idx}houseNumber`]}
                    />
                  </div>

                  <Input
                    label="Miejscowość"
                    placeholder="Warszawa"
                    value={card.city}
                    onChange={(e) =>
                      updateCard(card.key, "city", e.target.value)
                    }
                    error={errors[`c${idx}city`]}
                  />

                  <div>
                    <Input
                      label="Kod pocztowy"
                      placeholder="XX-XXX"
                      value={card.postalCode}
                      onChange={(e) =>
                        updateCard(card.key, "postalCode", e.target.value)
                      }
                      error={errors[`c${idx}postalCode`]}
                    />
                    <Select
                      label="Województwo"
                      options={VOIVODESHIPS.map((v) => ({
                        value: v,
                        label: v,
                      }))}
                      value={card.voivodeship}
                      onChange={(value) =>
                        updateCard(card.key, "voivodeship", value)
                      }
                      error={errors[`c${idx}voivodeship`]}
                    />
                  </div>
                </div>
              </Card>
            ))}

            {errors.children && (
              <p>{errors.children}</p>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={addCard}
            >
              + Dodaj kolejne dziecko
            </Button>
            </CardContent></Card>

          {errors.submit && (
            <div>
              {errors.submit}
            </div>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Zapisywanie..." : "Wyślij zapis"}
          </Button>
        </form>
      </main>
    </div>
  );
}
