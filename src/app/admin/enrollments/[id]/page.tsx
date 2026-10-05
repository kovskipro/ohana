"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
      <main className="py-8">
        <p className="text-muted-foreground">Wczytywanie zgłoszenia...</p>
      </main>
    );
  }

  if (error || !enrollment) {
    return (
      <main className="py-8">
        <p className="text-muted-foreground">
          {error ?? "Nie znaleziono zgłoszenia."}
        </p>
        <Link
          href="/admin"
          className="text-sm text-foreground underline underline-offset-4 hover:text-primary"
        >
          ← Wróć do zgłoszeń
        </Link>
      </main>
    );
  }

  return (
    <main className="py-8">
      <Link
        href="/admin"
        className="text-sm text-foreground underline underline-offset-4 hover:text-primary"
      >
        ← Wróć do zgłoszeń
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            Zgłoszenie — {enrollment.profiles?.profile_name || "Rodzina"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Rok szkolny {enrollment.school_year}
          </p>
        </div>

        <div className="flex gap-2">
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

      <div className="mt-4 flex items-center gap-3">
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
        <span className="text-sm text-muted-foreground">
          Utworzono: {new Date(enrollment.created_at).toLocaleString("pl-PL")}
        </span>
        {enrollment.decided_at && (
          <span className="text-sm text-muted-foreground">
            · Decyzja:{" "}
            {new Date(enrollment.decided_at).toLocaleString("pl-PL")}
          </span>
        )}
      </div>

      {actionError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 mt-4 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Rodzic / opiekun</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <p>
                {enrollment.parent_first_name} {enrollment.parent_last_name}
              </p>
              <p>
                Email:{" "}
                <a
                  href={`mailto:${enrollment.parent_email}`}
                  className="text-foreground underline"
                >
                  {enrollment.parent_email}
                </a>
              </p>
              <p>
                Telefon: {enrollment.parent_phone_country}{" "}
                {enrollment.parent_phone}
              </p>
              {enrollment.parent_fb_link && (
                <p>FB: {enrollment.parent_fb_link}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rodzina</CardTitle>
          </CardHeader>
          <CardContent>
            {enrollment.profiles ? (
              <div className="space-y-1 text-sm">
                <p>
                  {enrollment.profiles.city}, {enrollment.profiles.postal_code},{" "}
                  {enrollment.profiles.voivodeship}
                </p>
                <p>Liczba dzieci: {enrollment.profiles.num_children}</p>
                {enrollment.profiles.interests.length > 0 && (
                  <p>
                    Zainteresowania: {enrollment.profiles.interests.join(", ")}
                  </p>
                )}
                <Link
                  href={`/admin/families/${enrollment.profiles.id}`}
                  className="text-sm text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Profil rodziny →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Brak danych profilu.</p>
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
          <div className="space-y-3">
            {enrollment.enrollment_children.map((child) => (
              <Card key={child.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {child.first_name} {child.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {child.birth_date} · {child.birth_place}
                      </p>
                    </div>
                    <div className="text-sm space-y-1">
                      <p>Klasa: {child.school_class}</p>
                      <p>
                        Adres: {child.street} {child.house_number}, {child.city}
                      </p>
                      <p>
                        Kod pocztowy: {child.postal_code} · {child.voivodeship}
                      </p>
                      <p>PESEL: {child.pesel}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {enrollment.enrollment_children.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Brak dzieci w zgłoszeniu.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}