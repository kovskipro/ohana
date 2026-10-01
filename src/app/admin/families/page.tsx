"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Child = Database["public"]["Tables"]["children"]["Row"];
type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];

interface FamilyRow {
  id: string;
  profile_name: string;
  city: string;
  voivodeship: string;
  contact_email: string | null;
  contact_phone: string | null;
  map_visible: boolean;
  created_at: string;
  children: Child[];
  enrollments: Enrollment[];
}

export default function FamiliesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("*, children(*), enrollments(*)")
        .order("profile_name", { ascending: true });
      if (signal?.aborted) return;

      if (error) {
        setError("Nie udało się wczytać rodzin.");
        return;
      }
      setFamilies((data ?? []) as unknown as FamilyRow[]);
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      await load(controller.signal);
    }

    void run();
    return () => controller.abort();
  }, [load]);

  return (
    <main>
      <h1>
        Rodziny
      </h1>
      <p>
        Konta rodzin i użytkowników kooperatywy
      </p>

      {error && (
        <div>
          {error}
        </div>
      )}

      {loading ? (
        <p>Wczytywanie rodzin...</p>
      ) : families.length === 0 ? (
        <p>
          Brak zarejestrowanych rodzin.
        </p>
      ) : (
        <div>
          {families.map((family) => {
            const latest = family.enrollments[0]?.status;
            return (
              <Card
                key={family.id}
              >
                <div>
                  <div>
                    <div>
                      <h2>
                        {family.profile_name || "Rodzina"}
                      </h2>
                      {latest && (
                        <Badge
                          variant={
                            latest === "accepted"
                              ? "default"
                              : latest === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {latest}
                        </Badge>
                      )}
                    </div>
                    <p>
                      {family.city || "—"} · {family.voivodeship || "—"}
                    </p>
                  </div>

                  <Link href={`/admin/families/${family.id}`}>
                    <span>
                      Profil →
                    </span>
                  </Link>
                </div>

                <div>
                  <p>
                    <span>Email:</span>{" "}
                    {family.contact_email || "—"}
                  </p>
                  <p>
                    <span>Telefon:</span>{" "}
                    {family.contact_phone || "—"}
                  </p>
                  <p>
                    <span>Dzieci:</span>{" "}
                    {family.children.length}
                  </p>
                  <p>
                    <span>Zapisy:</span>{" "}
                    {family.enrollments.length}
                  </p>
                  <p>
                    <span>
                      Widoczna na mapie:
                    </span>{" "}
                    {family.map_visible ? "Tak" : "Nie"}
                  </p>
                  <p>
                    Dołączyła:{" "}
                    {new Date(family.created_at).toLocaleDateString("pl-PL")}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}