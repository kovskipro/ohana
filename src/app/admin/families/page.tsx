"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <main className="py-8">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold">Rodziny</h1>
        <p className="text-sm text-muted-foreground">
          Konta rodzin i użytkowników kooperatywy
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 mb-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Wczytywanie rodzin...</p>
      ) : families.length === 0 ? (
        <p className="text-muted-foreground">Brak zarejestrowanych rodzin.</p>
      ) : (
        <div className="space-y-4">
          {families.map((family) => {
            const latest = family.enrollments[0]?.status;
            return (
              <Card key={family.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold">
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
                      <p className="text-sm text-muted-foreground">
                        {family.city || "—"} · {family.voivodeship || "—"}
                      </p>
                    </div>
                    <Link href={`/admin/families/${family.id}`}>
                      <span className="text-sm text-foreground underline underline-offset-4 hover:text-primary">
                        Profil →
                      </span>
                    </Link>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p>
                        <span className="text-muted-foreground">Email:</span>{" "}
                        {family.contact_email || "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Telefon:</span>{" "}
                        {family.contact_phone || "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p>
                        <span className="text-muted-foreground">Dzieci:</span>{" "}
                        {family.children.length}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Zapisy:</span>{" "}
                        {family.enrollments.length}
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Widoczna na mapie:
                        </span>{" "}
                        {family.map_visible ? "Tak" : "Nie"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Dołączyła:</span>{" "}
                        {new Date(family.created_at).toLocaleDateString("pl-PL")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}