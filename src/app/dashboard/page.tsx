"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
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
      <div>
        <p>Wczytywanie...</p>
      </div>
    );
  }

  return (
    <div>
      <main>
        <h1>
          Panel rodziny
        </h1>

        {error && (
          <div>
            {error}
          </div>
        )}

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Profil rodziny</CardTitle>
              <Link
                href="/profil"
              >
                Edytuj
              </Link>
            </CardHeader>
            <CardContent>
            <div>
              <p>
                <span>Nazwa:</span>{" "}
                {profile?.profile_name || "—"}
              </p>
              <p>
                <span>Miejscowość:</span>{" "}
                {profile?.city || "—"}
              </p>
              <p>
                <span>Województwo:</span>{" "}
                {profile?.voivodeship || "—"}
              </p>
              <p>
                <span>Liczba dzieci:</span>{" "}
                {profile?.num_children ?? "—"}
              </p>
              <p>
                <span>Zainteresowania:</span>{" "}
                {(profile?.interests ?? []).join(", ") || "—"}
              </p>
              <p>
                <span>Widoczność na mapie:</span>{" "}
                {profile?.map_visible ? "Tak" : "Nie"}
              </p>
            </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zapisy (enrollments)</CardTitle>
              <Link
                href="/enroll"
              >
                Nowy zapis
              </Link>
            </CardHeader>
            <CardContent>
            {enrollments.length === 0 ? (
              <p>
                Brak zapisów. Kliknij „Nowy zapis”, aby zgłosić dziecko na rok
                szkolny.
              </p>
            ) : (
              <div>
                {enrollments.map((enrollment) => (
                  <Card key={enrollment.id}>
                    <div>
                      <p>
                        Rok szkolny {enrollment.school_year}
                      </p>
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
                    <p>
                      {enrollment.parent_first_name} {enrollment.parent_last_name} ·{" "}
                      {enrollment.parent_email}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
