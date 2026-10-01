"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Child = Database["public"]["Tables"]["children"]["Row"];
type EnrollmentChild =
  Database["public"]["Tables"]["enrollment_children"]["Row"];

interface EnrollmentDetail {
  id: string;
  school_year: string;
  status: Enrollment["status"];
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_phone: string;
  parent_phone_country: string;
  parent_fb_link: string | null;
  created_at: string;
  decided_at: string | null;
  profiles: Profile & { children: Child[] } | null;
  enrollment_children: EnrollmentChild[];
}

export default function EnrollmentDetailPage() {
  const params = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [enrollment, setEnrollment] = useState<EnrollmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return;
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, profiles(*, children(*)), enrollment_children(*)")
        .eq("id", params.id)
        .single();
      if (signal?.aborted) return;

      if (error) {
        setError("Nie udało się wczytać zgłoszenia.");
        return;
      }
      setEnrollment(data as unknown as EnrollmentDetail);
      setLoading(false);
    },
    [supabase, params.id],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      await load(controller.signal);
    }

    void run();
    return () => controller.abort();
  }, [load]);

  const setStatus = async (status: string) => {
    if (!enrollment) return;
    setBusy(true);
    setActionError(null);
    const { error } = await supabase.rpc("admin_set_enrollment_status", {
      target_enrollment: enrollment.id,
      new_status: status,
    });
    setBusy(false);
    if (error) {
      setActionError(`Nie udało się zaktualizować statusu: ${error.message}`);
      return;
    }
    load();
  };

  if (loading) {
    return (
      <main>
        <p>Wczytywanie zgłoszenia...</p>
      </main>
    );
  }

  if (error || !enrollment) {
    return (
      <main>
        <p>
          {error ?? "Nie znaleziono zgłoszenia."}
        </p>
        <Link
          href="/admin"
        >
          ← Wróć do zgłoszeń
        </Link>
      </main>
    );
  }

  return (
    <main>
      <Link
        href="/admin"
      >
        ← Wróć do zgłoszeń
      </Link>

      <div>
        <div>
          <h1>
            Zgłoszenie — {enrollment.profiles?.profile_name || "Rodzina"}
          </h1>
          <p>
            Rok szkolny {enrollment.school_year}
          </p>
        </div>

        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || enrollment.status === "accepted"}
            onClick={() => setStatus("accepted")}
          >
            Zaakceptuj
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy || enrollment.status === "rejected"}
            onClick={() => setStatus("rejected")}
          >
            Odrzuć
          </Button>
        </div>
      </div>

      <div>
        <Badge
          variant={
            enrollment.status === "accepted"
              ? "default"
              : enrollment.status === "rejected"
                ? "destructive"
                : "secondary"
          }
        >
          {enrollment.status}
        </Badge>
        <span>
          Utworzono: {new Date(enrollment.created_at).toLocaleString("pl-PL")}
        </span>
        {enrollment.decided_at && (
          <span>
            · Decyzja:{" "}
            {new Date(enrollment.decided_at).toLocaleString("pl-PL")}
          </span>
        )}
      </div>

      {actionError && (
        <div>
          {actionError}
        </div>
      )}

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Rodzic / opiekun</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p>
                {enrollment.parent_first_name} {enrollment.parent_last_name}
              </p>
              <p>
                Email:{" "}
                <a
                  href={`mailto:${enrollment.parent_email}`}
                >
                  {enrollment.parent_email}
                </a>
              </p>
              <p>
                Telefon: {enrollment.parent_phone_country}{" "}
                {enrollment.parent_phone}
              </p>
              {enrollment.parent_fb_link && <p>FB: {enrollment.parent_fb_link}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rodzina</CardTitle>
          </CardHeader>
          <CardContent>
            {enrollment.profiles ? (
              <div>
                <p>
                  {enrollment.profiles.city}, {enrollment.profiles.postal_code},{" "}
                  {enrollment.profiles.voivodeship}
                </p>
                <p>Liczba dzieci: {enrollment.profiles.num_children}</p>
                {enrollment.profiles.interests.length > 0 && (
                  <p>Zainteresowania: {enrollment.profiles.interests.join(", ")}</p>
                )}
                <Link
                  href={`/admin/families/${enrollment.profiles.id}`}
                >
                  Profil rodziny →
                </Link>
              </div>
            ) : (
              <p>Brak danych profilu.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Dzieci w zgłoszeniu ({enrollment.enrollment_children.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            {enrollment.enrollment_children.map((child) => (
              <Card key={child.id}>
                <div>
                  <p>
                    {child.first_name} {child.last_name}
                  </p>
                  <p>
                    {child.birth_date} · {child.birth_place}
                  </p>
                </div>
                <div>
                  <p>Klasa: {child.school_class}</p>
                  <p>
                    Adres: {child.street} {child.house_number}, {child.city}
                  </p>
                  <p>
                    Kod pocztowy: {child.postal_code} · {child.voivodeship}
                  </p>
                  <p>PESEL: {child.pesel}</p>
                </div>
              </Card>
            ))}
            {enrollment.enrollment_children.length === 0 && (
              <p>Brak dzieci w zgłoszeniu.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}