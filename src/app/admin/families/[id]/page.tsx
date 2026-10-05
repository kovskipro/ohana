"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Child = Database["public"]["Tables"]["children"]["Row"];
type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];

interface FamilyDetail {
  id: string;
  profile_name: string;
  city: string;
  postal_code: string;
  voivodeship: string;
  num_children: number;
  children_ages: number[];
  interests: string[];
  contact_email: string | null;
  contact_phone: string | null;
  contact_fb: string | null;
  contact_instagram: string | null;
  map_visible: boolean;
  created_at: string;
  children: Child[];
  enrollments: Enrollment[];
}

export default function FamilyDetailPage() {
  const params = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("*, children(*), enrollments(*)")
        .eq("id", params.id)
        .single();
      if (signal?.aborted) return;

      if (error) {
        setError("Nie udało się wczytać rodziny.");
        return;
      }
      setFamily(data as unknown as FamilyDetail);
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

  if (loading) {
    return (
      <main>
        <p>Wczytywanie rodziny...</p>
      </main>
    );
  }

  if (error || !family) {
    return (
      <main>
        <p>
          {error ?? "Nie znaleziono rodziny."}
        </p>
        <Link
          href="/admin/families"
        >
          ← Wróć do rodzin
        </Link>
      </main>
    );
  }

  return (
    <main className="py-8">
      <Link
        href="/admin/families"
        className="text-sm text-foreground underline underline-offset-4 hover:text-primary"
      >
        ← Wróć do rodzin
      </Link>

      <div className="mt-4">
        <h1 className="font-heading text-2xl font-bold">
          {family.profile_name || "Rodzina"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Konto rodziny — dołączyła{" "}
          {new Date(family.created_at).toLocaleDateString("pl-PL")}
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Adres</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="text-sm">{family.city}, {family.postal_code}</p>
              <p className="text-sm">{family.voivodeship}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kontakt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <p>Email: {family.contact_email || "—"}</p>
              <p>Telefon: {family.contact_phone || "—"}</p>
              <p>FB: {family.contact_fb || "—"}</p>
              <p>Instagram: {family.contact_instagram || "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-6" />

      <Card>
        <CardHeader>
          <CardTitle>O rodzinie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>Liczba dzieci: {family.num_children}</p>
            <p>Wiek dzieci: {family.children_ages.join(", ") || "—"}</p>
            {family.interests.length > 0 && (
              <p>Zainteresowania: {family.interests.join(", ")}</p>
            )}
            <p>Widoczna na mapie: {family.map_visible ? "Tak" : "Nie"}</p>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <Card>
        <CardHeader>
          <CardTitle>Dzieci ({family.children.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {family.children.map((child) => (
              <Card key={child.id}>
                <CardContent className="pt-4">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {child.first_name} {child.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {child.birth_date} · {child.birth_place} · PESEL {child.pesel}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {family.children.length === 0 && (
              <p className="text-sm text-muted-foreground">Brak dzieci.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <Card>
        <CardHeader>
          <CardTitle>Zapisy ({family.enrollments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {family.enrollments.map((enrollment) => (
              <Card key={enrollment.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm">
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
                        {enrollment.status}
                      </Badge>
                    </div>
                    <Link
                      href={`/admin/enrollments/${enrollment.id}`}
                      className="text-sm text-foreground underline underline-offset-4 hover:text-primary"
                    >
                      Szczegóły →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
            {family.enrollments.length === 0 && (
              <p className="text-sm text-muted-foreground">Brak zapisów.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}