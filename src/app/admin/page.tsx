"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Child = Database["public"]["Tables"]["children"]["Row"];
type EnrollmentChild =
  Database["public"]["Tables"]["enrollment_children"]["Row"];

interface EnrollmentRow {
  id: string;
  school_year: string;
  status: Enrollment["status"];
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_phone: string;
  created_at: string;
  decided_at: string | null;
  profiles: Profile & { children: Child[] } | null;
  enrollment_children: EnrollmentChild[];
}

const STATUS_OPTIONS = [
  { value: "all", label: "Wszystkie statusy" },
  { value: "pending", label: "Oczekujące" },
  { value: "accepted", label: "Zaakceptowane" },
  { value: "rejected", label: "Odrzucone" },
];

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);

  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return;
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, profiles(*, children(*)), enrollment_children(*)")
        .order("created_at", { ascending: false });
      if (signal?.aborted) return;

      if (error) {
        setActionError("Nie udało się wczytać zgłoszeń.");
        return;
      }
      setEnrollments((data ?? []) as unknown as EnrollmentRow[]);
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

  const years = useMemo(() => {
    const set = new Set(enrollments.map((e) => e.school_year));
    return Array.from(set).sort().reverse();
  }, [enrollments]);

  const filtered = useMemo(
    () =>
      enrollments.filter(
        (e) =>
          (statusFilter === "all" || e.status === statusFilter) &&
          (yearFilter === "all" || e.school_year === yearFilter),
      ),
    [enrollments, statusFilter, yearFilter],
  );

  const counts = useMemo(
    () => ({
      pending: enrollments.filter((e) => e.status === "pending").length,
      accepted: enrollments.filter((e) => e.status === "accepted").length,
      rejected: enrollments.filter((e) => e.status === "rejected").length,
    }),
    [enrollments],
  );

  const setStatus = async (id: string, status: string) => {
    setBusy(true);
    setActionError(null);
    const { error } = await supabase.rpc("admin_set_enrollment_status", {
      target_enrollment: id,
      new_status: status,
    });
    setBusy(false);
    if (error) {
      setActionError(`Nie udało się zaktualizować statusu: ${error.message}`);
      return;
    }
    load();
  };

  return (
    <main>
      <h1>
        Panel administratora
      </h1>
      <p>
        Zarządzanie zgłoszeniami rodzin
      </p>

      <div>
        <Card>
          <CardContent>
            <p>
              Oczekujące
            </p>
            <p>
              {counts.pending}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p>
              Zaakceptowane
            </p>
            <p>
              {counts.accepted}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p>
              Odrzucone
            </p>
            <p>
              {counts.rejected}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div>
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
        <div>
          <Select
            label="Rok szkolny"
            options={[
              { value: "all", label: "Wszystkie lata" },
              ...years.map((y) => ({ value: y, label: y })),
            ]}
            value={yearFilter}
            onChange={setYearFilter}
          />
        </div>
      </div>

      {actionError && (
        <div>
          {actionError}
        </div>
      )}

      {loading ? (
        <p>Wczytywanie zgłoszeń...</p>
      ) : filtered.length === 0 ? (
        <p>
          Brak zgłoszeń spełniających kryteria.
        </p>
      ) : (
        <div>
          {filtered.map((enrollment) => (
            <Card
              key={enrollment.id}
            >
              <div>
                <div>
                  <div>
                    <h2>
                      {enrollment.profiles?.profile_name || "Rodzina"}
                    </h2>
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
                  <p>
                    Rok szkolny {enrollment.school_year}
                  </p>
                </div>

                <div>
                  <Link href={`/admin/enrollments/${enrollment.id}`}>
                    <Button size="sm" variant="outline">
                      Szczegóły
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || enrollment.status === "accepted"}
                    onClick={() => setStatus(enrollment.id, "accepted")}
                  >
                    Zaakceptuj
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy || enrollment.status === "rejected"}
                    onClick={() => setStatus(enrollment.id, "rejected")}
                  >
                    Odrzuć
                  </Button>
                </div>
              </div>

              <div>
                <div>
                  <p>Rodzic</p>
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
                  <p>Telefon: {enrollment.parent_phone}</p>
                  {enrollment.profiles?.contact_fb && (
                    <p>FB: {enrollment.profiles.contact_fb}</p>
                  )}
                  {enrollment.decided_at && (
                    <p>
                      Decyzja:{" "}
                      {new Date(enrollment.decided_at).toLocaleString("pl-PL")}
                    </p>
                  )}
                </div>

                <div>
                  <p>Dzieci w zgłoszeniu</p>
                  {enrollment.enrollment_children.map((child) => (
                    <p key={child.id}>
                      {child.first_name} {child.last_name} — klasa{" "}
                      {child.school_class}
                    </p>
                  ))}
                  {enrollment.enrollment_children.length === 0 && (
                    <p>Brak dzieci w zgłoszeniu</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}