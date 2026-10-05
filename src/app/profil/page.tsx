"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  AVATAR_MAX_INPUT_BYTES,
  avatarPathToUrl,
  isAvatarPath,
} from "@/lib/avatars";
import type { Database } from "@/lib/supabase/types";
import {
  validateEmail,
  validatePhoneNumber,
  validatePostalCode,
  VOIVODESHIPS,
} from "@/lib/validation";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface ProfileForm {
  profileName: string;
  numChildren: number;
  childrenAges: number[];
  interests: string[];
  contactPhone: string;
  contactPhoneCountry: string;
  contactEmail: string;
  contactFb: string;
  contactInstagram: string;
  city: string;
  postalCode: string;
  voivodeship: string;
}

const AVATAR_INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function ProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingMap, setTogglingMap] = useState(false);
  const [mapVisibilityModalOpen, setMapVisibilityModalOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [interestInput, setInterestInput] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarOperation, setAvatarOperation] = useState<
    "upload" | "delete" | null
  >(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarMutationInFlight = useRef(false);
  const mapVisibilityMutationInFlight = useRef(false);

  const getEmailMessage = (value: string) => {
    if (!value.trim()) return "";
    if (!value.includes("@")) return "Brakuje @ w adresie e-mail.";
    const [local, domain] = value.split("@");
    if (!local || !domain || !domain.includes(".")) {
      return "Adres e-mail powinien zawierać domenę, np. imie@domena.pl";
    }
    return "";
  };

  const getPhoneMessage = (value: string) => {
    if (!value.trim()) return "";
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length !== 9) {
      return "Numer telefonu powinien mieć 9 cyfr.";
    }
    return "";
  };

  const load = useCallback(
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

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (signal?.aborted) return;

      if (!profileData) {
        router.push("/register");
        return;
      }

      setProfile(profileData);
      setAvatarPath(profileData.avatar_path);
      setForm({
        profileName: profileData.profile_name,
        numChildren: profileData.num_children,
        childrenAges: profileData.children_ages ?? [],
        interests: profileData.interests ?? [],
        contactPhone: profileData.contact_phone ?? "",
        contactPhoneCountry: profileData.contact_phone_country,
        contactEmail: profileData.contact_email ?? "",
        contactFb: profileData.contact_fb ?? "",
        contactInstagram: profileData.contact_instagram ?? "",
        city: profileData.city,
        postalCode: profileData.postal_code,
        voivodeship: profileData.voivodeship,
      });
      setLoading(false);
    },
    [router, supabase],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      await load(controller.signal);
    }

    void run();
    return () => controller.abort();
  }, [load]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const f = form!;

    if (!f.profileName.trim()) newErrors.profileName = "Nazwa profilu jest wymagana";
    if (f.numChildren < 1) newErrors.numChildren = "Musisz mieć co najmniej jedno dziecko";

    const hasAnyContact =
      f.contactPhone || f.contactEmail || f.contactFb || f.contactInstagram;
    if (!hasAnyContact) {
      newErrors.contact = "Proszę podać co najmniej jeden kontakt";
    }
    if (f.contactEmail && !validateEmail(f.contactEmail)) {
      newErrors.contactEmail = "Email nie jest poprawny";
    }
    if (f.contactPhone && !validatePhoneNumber(f.contactPhone, "+48")) {
      newErrors.contactPhone = "Numer telefonu nie jest poprawny";
    }
    if (!f.city.trim()) newErrors.city = "Miejscowość jest wymagana";
    if (!f.postalCode.trim()) {
      newErrors.postalCode = "Kod pocztowy jest wymagany";
    } else if (!validatePostalCode(f.postalCode)) {
      newErrors.postalCode = "Kod pocztowy musi być w formacie XX-XXX";
    }
    if (!f.voivodeship) newErrors.voivodeship = "Województwo jest wymagane";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const finishAvatarOperation = () => {
    avatarMutationInFlight.current = false;
    setAvatarOperation(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file || avatarMutationInFlight.current) return;

    setAvatarError(null);
    setAvatarStatus(null);

    if (file.size === 0) {
      setAvatarError("Wybrany plik jest pusty.");
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      setAvatarError("Plik może mieć maksymalnie 5 MiB.");
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    if (!AVATAR_INPUT_TYPES.has(file.type)) {
      setAvatarError("Dozwolone formaty to JPEG, PNG i WebP.");
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }

    void handleAvatarUpload(file);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!profile || avatarMutationInFlight.current) return;

    avatarMutationInFlight.current = true;
    setAvatarOperation("upload");
    setAvatarError(null);
    setAvatarStatus(null);

    try {
      const body = new FormData();
      body.set("avatar", file);
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body,
      });
      const payload = (await response.json().catch(() => null)) as {
        avatarPath?: unknown;
        error?: unknown;
      } | null;

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Nie udało się przesłać zdjęcia.",
        );
      }
      if (
        typeof payload?.avatarPath !== "string" ||
        !isAvatarPath(payload.avatarPath, profile.id)
      ) {
        throw new Error("Serwer zwrócił nieprawidłową ścieżkę zdjęcia.");
      }

      setAvatarPath(payload.avatarPath);
      setProfile((current) =>
        current ? { ...current, avatar_path: payload.avatarPath as string } : current,
      );
      setAvatarStatus("Zdjęcie profilowe zostało zapisane.");
      router.refresh();
    } catch (error) {
      setAvatarStatus(null);
      const uploadError =
        error instanceof Error
          ? error
          : new Error("Nie udało się przesłać zdjęcia.");
      setAvatarError(uploadError.message);
      throw uploadError;
    } finally {
      finishAvatarOperation();
    }
  };

  const handleDeleteAvatar = async () => {
    if (!profile || !avatarPath || avatarMutationInFlight.current) return;

    avatarMutationInFlight.current = true;
    setAvatarOperation("delete");
    setAvatarError(null);
    setAvatarStatus("Usuwanie zdjęcia…");

    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Nie udało się usunąć zdjęcia.",
        );
      }

      setAvatarPath(null);
      setProfile((current) =>
        current ? { ...current, avatar_path: null } : current,
      );
      setAvatarStatus("Zdjęcie profilowe zostało usunięte.");
      router.refresh();
    } catch (error) {
      setAvatarStatus(null);
      setAvatarError(
        error instanceof Error
          ? error.message
          : "Nie udało się usunąć zdjęcia.",
      );
    } finally {
      finishAvatarOperation();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !profile) return;
    if (!validate()) return;

    setSaving(true);
    setSuccess(null);
    setErrors({});

    const { error } = await supabase
      .from("profiles")
      .update({
        profile_name: form.profileName,
        num_children: form.numChildren,
        children_ages: form.childrenAges,
        interests: form.interests,
        contact_phone: form.contactPhone || null,
        contact_phone_country: form.contactPhoneCountry,
        contact_email: form.contactEmail || null,
        contact_fb: form.contactFb || null,
        contact_instagram: form.contactInstagram || null,
        city: form.city,
        postal_code: form.postalCode,
        voivodeship: form.voivodeship,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      setErrors({ submit: error.message });
      return;
    }

    setSuccess("Zapisano zmiany.");
    router.refresh();

    // Geokodowanie nowej/zmienionej lokalizacji — tylko przy zapisie,
    // user-triggered, nigdy przy renderowaniu /mapa.
    if (profile.map_visible && form.city && form.postalCode && form.voivodeship) {
      try {
        await fetch("/api/map-locations", { method: "POST" });
      } catch {
        // Brak współrzędnych jest nieszkodliwy — backfill spróbuje później.
      }
    }

    await load();
  };

  const setMapVisibility = async (nextVisible: boolean) => {
    if (!profile || mapVisibilityMutationInFlight.current) return;

    mapVisibilityMutationInFlight.current = true;
    setTogglingMap(true);
    setSuccess(null);
    setErrors({});

    // Optimistic update — przełącznik reaguje natychmiast, zanim RPC wróci.
    setProfile({ ...profile, map_visible: nextVisible });

    const { error } = await supabase.rpc("set_map_visibility", {
      visible: nextVisible,
    });

    if (error) {
      // Wycofanie na wypadek błędu.
      setProfile({ ...profile, map_visible: profile.map_visible });
      setErrors({ submit: error.message });
      setTogglingMap(false);
      mapVisibilityMutationInFlight.current = false;
      return;
    }

    // Geokodowanie nowej lokalizacji tylko przy włączeniu (user-triggered),
    // nigdy przy renderowaniu /mapa. Wynik i tak wróci z cache map_locations.
    if (nextVisible) {
      try {
        await fetch("/api/map-locations", { method: "POST" });
      } catch {
        // Brak współrzędnych jest nieszkodliwy — rodzina zostanie na liście
        // z adnotacją, backfill spróbuje później.
      }
    }

    await load();
    setTogglingMap(false);
    mapVisibilityMutationInFlight.current = false;
    setSuccess(
      nextVisible
        ? "Twoja rodzina jest teraz widoczna na mapie rodzin."
        : "Twoja rodzina nie jest już widoczna na mapie.",
    );
  };

  const handleToggleMap = (nextVisible: boolean) => {
    if (togglingMap || mapVisibilityMutationInFlight.current) return;

    if (nextVisible) {
      setMapVisibilityModalOpen(true);
      return;
    }

    void setMapVisibility(false);
  };

  const handleConfirmMapVisibility = () => {
    if (togglingMap || mapVisibilityMutationInFlight.current) return;

    setMapVisibilityModalOpen(false);
    void setMapVisibility(true);
  };

  if (loading || !form || !profile) {
    return (
      <main className="py-8">
        <p className="text-muted-foreground">Wczytywanie...</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto py-8 space-y-6">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold">Profil rodziny</h1>
        <p className="text-sm text-muted-foreground">
          Dane profilu, kontakty i widoczność na mapie.
        </p>
      </div>

      {errors.submit && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.submit}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <form
        noValidate
        onSubmit={handleSave}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle id="avatar-heading">Zdjęcie profilowe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <Avatar
                src={avatarPathToUrl(avatarPath)}
                name={form.profileName}
                alt="Zdjęcie profilowe rodziny"
                size={96}
              />
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={avatarOperation !== null || saving}
                    onChange={(event) =>
                      void handleAvatarFile(event.currentTarget.files?.[0])
                    }
                    className="text-sm file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={avatarOperation !== null || saving}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {avatarOperation === "upload"
                      ? "Przesyłanie…"
                      : avatarPath
                        ? "Zmień zdjęcie"
                        : "Dodaj zdjęcie"}
                  </Button>
                  {avatarPath ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={avatarOperation !== null || saving}
                      onClick={() => void handleDeleteAvatar()}
                    >
                      {avatarOperation === "delete" ? "Usuwanie…" : "Usuń"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              JPEG, PNG lub WebP, maks. 5 MiB. Gdy widoczność na mapie jest
              włączona, zdjęcie jest widoczne publicznie przy karcie rodziny.
            </p>
            {avatarStatus ? (
              <p role="status" className="text-sm text-emerald-700">
                {avatarStatus}
              </p>
            ) : null}
            {avatarError ? (
              <p role="alert" className="text-sm text-destructive">
                {avatarError}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dane podstawowe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Nazwa profilu (np. Kossakowscy)"
              placeholder="Nazwa rodziny"
              value={form.profileName}
              onChange={(e) => setForm({ ...form, profileName: e.target.value })}
              error={errors.profileName}
            />

            <Input
              label="Liczba dzieci"
              type="number"
              min={0}
              max={20}
              value={form.numChildren}
              onChange={(e) => {
                const num = Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0));
                const newAges = [...form.childrenAges];
                if (num > form.childrenAges.length) {
                  newAges.push(...Array(num - form.childrenAges.length).fill(0));
                } else if (num < form.childrenAges.length) {
                  newAges.splice(num);
                }
                setForm({ ...form, numChildren: num, childrenAges: newAges.length > 0 ? newAges : [0] });
              }}
              error={errors.numChildren}
            />

            {form.numChildren > 0 && (
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: form.numChildren }).map((_, i) => (
                  <div key={i} className="flex items-end gap-1.5">
                    <Input
                      label={`Wiek dziecka ${i + 1}`}
                      type="number"
                      min={0}
                      max={99}
                      value={form.childrenAges[i] ?? ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        const newAges = [...form.childrenAges];
                        newAges[i] = isNaN(val) ? 0 : Math.max(0, Math.min(99, val));
                        setForm({ ...form, childrenAges: newAges });
                      }}
                      className="w-20"
                    />
                    {form.numChildren > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          const newAges = [...form.childrenAges];
                          newAges.splice(i, 1);
                          setForm({
                            ...form,
                            numChildren: form.numChildren - 1,
                            childrenAges: newAges.length > 0 ? newAges : [0],
                          });
                        }}
                        aria-label={`Usuń dziecko ${i + 1}`}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {form.numChildren > 0 && form.numChildren < 20 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm({
                    ...form,
                    numChildren: form.numChildren + 1,
                    childrenAges: [...form.childrenAges, 0],
                  });
                }}
              >
                <Plus className="size-4" />
                Dodaj dziecko
              </Button>
            )}

            <Input
              label="Zainteresowania"
              placeholder="Napisz i naciśnij Enter…"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const trimmed = interestInput.trim();
                  if (trimmed && !form.interests.includes(trimmed)) {
                    setForm({ ...form, interests: [...form.interests, trimmed] });
                  }
                  setInterestInput("");
                } else if (e.key === "Backspace" && !interestInput && form.interests.length > 0) {
                  setForm({ ...form, interests: form.interests.slice(0, -1) });
                }
              }}
            />
            {form.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.interests.map((interest: string) => (
                  <Badge key={interest} variant="secondary" className="text-xs">
                    {interest}
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          interests: form.interests.filter((i: string) => i !== interest),
                        })
                      }
                      className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      aria-label={`Usuń ${interest}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kontakt do rodziny (minimum jeden)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Numer telefonu"
              type="tel"
              placeholder="+48 123 456 789"
              value={form.contactPhone}
              onChange={(e) =>
                setForm({ ...form, contactPhone: e.target.value })
              }
              error={
                form.contactPhone
                  ? getPhoneMessage(form.contactPhone) || errors.contactPhone
                  : errors.contactPhone
              }
              autoComplete="tel"
            />

            <Input
              label="Email"
              type="email"
              placeholder="rodzina@email.com"
              value={form.contactEmail}
              onChange={(e) =>
                setForm({ ...form, contactEmail: e.target.value })
              }
              error={
                form.contactEmail
                  ? getEmailMessage(form.contactEmail) || errors.contactEmail
                  : errors.contactEmail
              }
            />

            <Input
              label="Profil Facebook (link)"
              placeholder="https://facebook.com/..."
              value={form.contactFb}
              onChange={(e) => setForm({ ...form, contactFb: e.target.value })}
            />

            <Input
              label="Profil Instagram"
              placeholder="@username"
              value={form.contactInstagram}
              onChange={(e) =>
                setForm({ ...form, contactInstagram: e.target.value })
              }
            />

            {errors.contact && (
              <p className="text-xs text-destructive">{errors.contact}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Miejscowość"
              placeholder="Warszawa"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              error={errors.city}
            />

            <Input
              label="Kod pocztowy"
              placeholder="XX-XXX"
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              error={errors.postalCode}
            />

            <Select
              label="Województwo"
              options={VOIVODESHIPS.map((v) => ({ value: v, label: v }))}
              value={form.voivodeship}
              onChange={(value) => setForm({ ...form, voivodeship: value })}
              error={errors.voivodeship}
            />
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={saving || avatarOperation !== null}
          className="w-full"
        >
          {saving ? "Zapisywanie..." : "Zapisz profil"}
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Widoczność na mapie</CardTitle>
        </CardHeader>
        <CardContent>
          <Switch
            checked={profile.map_visible}
            onCheckedChange={handleToggleMap}
            disabled={togglingMap}
            aria-label="Widoczność na mapie rodzin"
            label="Widoczność na mapie rodzin"
            description={
              <>
                Gdy włączone, Twoja rodzina pojawi się na publicznej{" "}
                <Link
                  href="/mapa"
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  mapie rodzin
                </Link>
                . Pokazuje dane profilu, podane kontakty i przybliżoną
                lokalizację.
              </>
            }
          />
          {errors.submit && (
            <p className="text-xs text-destructive">{errors.submit}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={mapVisibilityModalOpen} onOpenChange={(open) => setMapVisibilityModalOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Włączyć widoczność na mapie?</DialogTitle>
            <DialogDescription>
              Profil Twojej rodziny stanie się publiczny na mapie rodzin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              Publiczna mapa pokaże nazwę profilu, miejscowość, województwo, kod
              pocztowy, liczbę i wiek dzieci, zainteresowania oraz podane dane
              kontaktowe oraz opcjonalne zdjęcie profilowe, jeśli zostało dodane.
            </p>
            <p className="text-sm">
              Pinezka pokazuje lokalizację przybliżoną, nie adres domu. Widoczność
              możesz później wyłączyć.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMapVisibilityModalOpen(false)}
            >
              Anuluj
            </Button>
            <Button type="button" onClick={handleConfirmMapVisibility}>
              Włącz widoczność
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
