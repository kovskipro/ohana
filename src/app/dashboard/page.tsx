"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  completeRegistration,
  getStagedRegistration,
  clearStagedRegistration,
} from "@/lib/registration";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];

const STATUS_LABELS: Record<string, string> = {
  pending: "Oczekuje na decyzję",
  accepted: "Zaakceptowany",
  rejected: "Odrzucony",
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (signal?.aborted) return;
      if (!user) {
        router.push("/login");
        return;
      }

      const pending = getStagedRegistration();
      if (pending) {
        try {
          await completeRegistration(supabase, pending);
          clearStagedRegistration();
          router.refresh();
        } catch {
          setError("Nie udało się dokończyć rejestracji. Spróbuj ponownie.");
        }
      }

      const [profileRes, enrollRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("enrollments")
          .select("*")
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (signal?.aborted) return;

      setProfile(profileRes.data);
      setEnrollments(enrollRes.data ?? []);
      setLoading(false);
    },
    [router, supabase],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      await loadData(controller.signal);
    }

    void run();
    return () => controller.abort();
  }, [loadData]);

  if (loading) {
    return (
      <main className="py-8">
        <p className="text-muted-foreground">Wczytywanie...</p>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold">Panel rodziny</h1>
        <p className="text-sm text-muted-foreground">
          Twój profil kooperatywy i zgłoszenia
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 mb-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Profil rodziny</CardTitle>
              <Link
                href="/profil"
                className="text-sm text-foreground underline underline-offset-4 hover:text-primary"
              >
                Edytuj
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">Nazwa:</span>{" "}
                {profile?.profile_name || "—"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Miejscowość:</span>{" "}
                {profile?.city || "—"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Województwo:</span>{" "}
                {profile?.voivodeship || "—"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Liczba dzieci:</span>{" "}
                {profile?.num_children ?? "—"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Zainteresowania:</span>{" "}
                {(profile?.interests ?? []).join(", ") || "—"}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Widoczność na mapie:</span>{" "}
                {profile?.map_visible ? "Tak" : "Nie"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Zapisy (enrollments)</CardTitle>
              <Link
                href="/enroll"
                className="text-sm text-foreground underline underline-offset-4 hover:text-primary"
              >
                Nowy zapis
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Brak zapisów. Kliknij „Nowy zapis”, aby zgłosić dziecko na rok
                szkolny.
              </p>
            ) : (
              <div className="space-y-3">
                {enrollments.map((enrollment) => (
                  <Card key={enrollment.id} className="bg-secondary/30">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm">
                            Rok szkolny {enrollment.school_year}
                          </p>
                          <p className="text-sm">
                            {enrollment.parent_first_name} {enrollment.parent_last_name} ·{" "}
                            {enrollment.parent_email}
                          </p>
                        </div>
                        <Badge
                          variant={
                            enrollment.status === "accepted"
                              ? "default"
                              : enrollment.status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {STATUS_LABELS[enrollment.status] ?? enrollment.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
