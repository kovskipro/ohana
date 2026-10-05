"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  completeRegistration,
  getStagedRegistration,
  stageRegistration,
  clearStagedRegistration,
  type PendingRegistration,
} from "@/lib/registration";
import {
  validateEmail,
  validatePhoneNumber,
  validatePostalCode,
  VOIVODESHIPS,
} from "@/lib/validation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { Plus, Trash2, X } from "lucide-react";

type RegistrationStep = "part1" | "part2" | "confirm";

interface RegistrationData {
  // Part 1 — profil rodziny (dane profilu i mapy)
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

  // Widoczność na publicznej mapie rodzin
  mapVisible: boolean;

  // Part 2 — konto
  email: string;
  password: string;
  passwordConfirm: string;
  agreePrivacy: boolean;
  agreeDataProcessing: boolean;
}

export default function RegisterPage() {
  const router = useRouter();
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

  const [step, setStep] = useState<RegistrationStep>("part1");
  const [submitting, setSubmitting] = useState(false);
  // Atomowy guard na podwójny submit: ref jest odczytywany natychmiast
  // (przed re-renderem), więc dwa synchroniczne zdarzenia submit w tym samym
  // ticku nie zdążą odpalić drugiego signUp. Stan `submitting` służy tylko UI.
  const submittingRef = useRef(false);
  const [data, setData] = useState<RegistrationData>({
    profileName: "",
    numChildren: 1,
    childrenAges: [5],
    interests: [],
    contactPhone: "",
    contactPhoneCountry: "+48",
    contactEmail: "",
    contactFb: "",
    contactInstagram: "",
    city: "",
    postalCode: "",
    voivodeship: "",
    mapVisible: false,
    email: "",
    password: "",
    passwordConfirm: "",
    agreePrivacy: false,
    agreeDataProcessing: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [interestInput, setInterestInput] = useState("");

  // Krok 3: kod OTP z emaila.
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startResendCooldown = (delaySeconds: number) => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    setResendIn(delaySeconds);
    const id = setInterval(() => {
      setResendIn((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) {
            clearInterval(resendTimerRef.current);
            resendTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    resendTimerRef.current = id;
  };

  useEffect(
    () => () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    },
    [],
  );

  // Finalizacja rejestracji po potwierdzeniu emaila: jeśli konto jest
  // zalogowane i mamy zdeponowane dane formularza, zapisujemy profil przez RPC.
  useEffect(() => {
    const supabase = createClient();
    const pending = getStagedRegistration();
    if (!pending) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      try {
        await completeRegistration(supabase, pending);
        clearStagedRegistration();
        router.push("/dashboard");
        router.refresh();
      } catch {
        setErrors({ submit: "Nie udało się dokończyć rejestracji. Spróbuj ponownie." });
      }
    });
  }, [router]);

  const validatePart1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.profileName.trim()) newErrors.profileName = "Nazwa profilu jest wymagana";
    if (data.numChildren < 1) newErrors.numChildren = "Musisz mieć co najmniej jedno dziecko";
    if (data.interests.length === 0) newErrors.interests = "Proszę dodać co najmniej jedno zainteresowanie";
    if (!data.city.trim()) newErrors.city = "Miejscowość jest wymagana";
    if (!data.postalCode.trim()) {
      newErrors.postalCode = "Kod pocztowy jest wymagany";
    } else if (!validatePostalCode(data.postalCode)) {
      newErrors.postalCode = "Kod pocztowy musi być w formacie XX-XXX";
    }
    if (!data.voivodeship) newErrors.voivodeship = "Województwo jest wymagane";

    // Contact validation - at least one required
    const hasAnyContact = data.contactPhone || data.contactEmail || data.contactFb || data.contactInstagram;
    if (!hasAnyContact) {
      newErrors.contact = "Proszę podać co najmniej jeden kontakt";
    }

    if (data.contactEmail && !validateEmail(data.contactEmail)) {
      newErrors.contactEmail = "Email nie jest poprawny";
    }
    if (data.contactPhone && !validatePhoneNumber(data.contactPhone, "+48")) {
      newErrors.contactPhone = "Numer telefonu nie jest poprawny";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePart2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.email.trim()) newErrors.email = "Email jest wymagany";
    if (data.email && !validateEmail(data.email)) newErrors.email = "Email nie jest poprawny";

    if (!data.password) newErrors.password = "Hasło jest wymagane";
    if (data.password.length < 8) newErrors.password = "Hasło musi mieć co najmniej 8 znaków";
    if (data.password !== data.passwordConfirm) {
      newErrors.passwordConfirm = "Hasła się nie zgadzają";
    }

    if (!data.agreeDataProcessing) newErrors.agreeDataProcessing = "Musisz wyrazić zgodę na przetwarzanie danych";
    if (!data.agreePrivacy) newErrors.agreePrivacy = "Musisz zaakceptować politykę prywatności";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validatePart1()) {
      setStep("part2");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePart2()) return;
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setErrors({});

    const pending: PendingRegistration = {
      profileName: data.profileName,
      numChildren: data.numChildren,
      childrenAges: data.childrenAges,
      interests: data.interests,
      contactPhone: data.contactPhone,
      contactPhoneCountry: data.contactPhoneCountry,
      contactEmail: data.contactEmail,
      contactFb: data.contactFb,
      contactInstagram: data.contactInstagram,
      city: data.city,
      postalCode: data.postalCode,
      voivodeship: data.voivodeship,
      mapVisible: data.mapVisible,
    };

    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        setErrors({ submit: error.message });
        return;
      }

      stageRegistration(pending);
      startResendCooldown(60);
      setStep("confirm");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.trim();
    if (token.length !== 6) {
      setErrors({ otp: "Kod powinien mieć 6 cyfr." });
      return;
    }
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setErrors({});

    const supabase = createClient();
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: data.email,
        token,
        type: "email",
      });

      if (error) {
        setErrors({
          otp: "Nieprawidłowy lub wygasły kod. Sprawdź email albo wyślij kod ponownie.",
        });
        return;
      }

      // verifyOtp zwraca sesję — użytkownik jest od razu zalogowany.
      const pending = getStagedRegistration();
      if (pending) {
        await completeRegistration(supabase, pending);
        clearStagedRegistration();
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrors({ otp: "Nie udało się dokończyć rejestracji. Spróbuj ponownie." });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || submittingRef.current) return;
    submittingRef.current = true;
    setErrors({});

    const supabase = createClient();
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        setErrors({ otp: error.message });
        return;
      }
      startResendCooldown(60);
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <main className="max-w-2xl mx-auto py-8">
      {step === "part1" && (
        <>
          <div className="mb-6">
            <h1 className="font-heading text-3xl font-bold">
              Zarejestruj się
            </h1>
            <p className="text-sm text-muted-foreground">
              Krok 1: Dane rodziny
            </p>
          </div>

          <form noValidate onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="flex flex-col gap-6">
            <Card><CardContent className="pt-6">
              <Input
                label="Nazwa profilu (np. Kossakowscy)"
                placeholder="Nazwa rodziny"
                value={data.profileName}
                onChange={(e) => setData({ ...data, profileName: e.target.value })}
                error={errors.profileName}
                name="profileName"
                autoComplete="organization"
              />

              <Input
                label="Liczba dzieci"
                type="number"
                min={0}
                max={20}
                value={data.numChildren}
                onChange={(e) => {
                  const num = Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0));
                  const newAges = [...data.childrenAges];
                  if (num > data.childrenAges.length) {
                    newAges.push(...Array(num - data.childrenAges.length).fill(0));
                  } else if (num < data.childrenAges.length) {
                    newAges.splice(num);
                  }
                  setData({ ...data, numChildren: num, childrenAges: newAges.length > 0 ? newAges : [0] });
                }}
                error={errors.numChildren}
              />

              {data.numChildren > 0 && (
                <div className="flex flex-wrap gap-3">
                  {Array.from({ length: data.numChildren }).map((_, i) => (
                    <div key={i} className="flex items-end gap-1.5">
                      <Input
                        label={`Wiek dziecia ${i + 1}`}
                        type="number"
                        min={0}
                        max={99}
                        value={data.childrenAges[i] ?? ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          const newAges = [...data.childrenAges];
                          newAges[i] = isNaN(val) ? 0 : Math.max(0, Math.min(99, val));
                          setData({ ...data, childrenAges: newAges });
                        }}
                        className="w-20"
                      />
                      {data.numChildren > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            const newAges = [...data.childrenAges];
                            newAges.splice(i, 1);
                            setData({
                              ...data,
                              numChildren: data.numChildren - 1,
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

              {data.numChildren > 0 && data.numChildren < 20 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setData({
                      ...data,
                      numChildren: data.numChildren + 1,
                      childrenAges: [...data.childrenAges, 0],
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
                    if (trimmed && !data.interests.includes(trimmed)) {
                      setData({ ...data, interests: [...data.interests, trimmed] });
                    }
                    setInterestInput("");
                  } else if (e.key === "Backspace" && !interestInput && data.interests.length > 0) {
                    setData({ ...data, interests: data.interests.slice(0, -1) });
                  }
                }}
                error={errors.interests}
              />
              {data.interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.interests.map((interest: string) => (
                    <Badge key={interest} variant="secondary" className="text-xs">
                      {interest}
                      <button
                        type="button"
                        onClick={() =>
                          setData({
                            ...data,
                            interests: data.interests.filter((i: string) => i !== interest),
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
            </CardContent></Card>

            <Card><CardContent className="pt-6">
              <p className="text-sm font-medium mb-3">
                Kontakt do rodziny (minimum jeden)
              </p>

               <Input
                 label="Numer telefonu"
                 type="tel"
                 placeholder="+48 123 456 789"
                 value={data.contactPhone}
                 onChange={(e) =>
                   setData({ ...data, contactPhone: e.target.value })
                 }
                 error={data.contactPhone ? getPhoneMessage(data.contactPhone) || errors.contactPhone : errors.contactPhone}
                 name="contactPhone"
                 autoComplete="tel"
               />

              <Input
                label="Email"
                type="email"
                placeholder="rodzina@email.com"
                value={data.contactEmail}
                onChange={(e) =>
                  setData({ ...data, contactEmail: e.target.value })
                }
                error={data.contactEmail ? getEmailMessage(data.contactEmail) || errors.contactEmail : errors.contactEmail}
                name="contactEmail"
                autoComplete="email"
              />

              <Input
                label="Profil Facebook (link)"
                placeholder="https://facebook.com/..."
                value={data.contactFb}
                onChange={(e) =>
                  setData({ ...data, contactFb: e.target.value })
                }
                name="contactFb"
                autoComplete="off"
              />

              <Input
                label="Profil Instagram"
                placeholder="@username"
                value={data.contactInstagram}
                onChange={(e) =>
                  setData({ ...data, contactInstagram: e.target.value })
                }
                name="contactInstagram"
                autoComplete="off"
              />

              {errors.contact && (
                <p className="text-xs text-destructive">{errors.contact}</p>
              )}
            </CardContent></Card>

            <Card><CardContent className="pt-6">
              <Input
                label="Miejscowość"
                placeholder="Warszawa"
                value={data.city}
                onChange={(e) => setData({ ...data, city: e.target.value })}
                error={errors.city}
                name="city"
                autoComplete="address-line2"
              />

              <Input
                label="Kod pocztowy"
                placeholder="XX-XXX"
                value={data.postalCode}
                onChange={(e) => setData({ ...data, postalCode: e.target.value })}
                error={errors.postalCode}
                name="postalCode"
                autoComplete="postal-code"
              />

              <Select
                label="Województwo"
                options={VOIVODESHIPS.map((v) => ({ value: v, label: v }))}
                value={data.voivodeship}
                onChange={(value) => setData({ ...data, voivodeship: value })}
                error={errors.voivodeship}
                name="voivodeship"
                placeholder="Wybierz województwo"
              />
            </CardContent></Card>

            <Card><CardContent className="pt-6">
              <Switch
                checked={data.mapVisible}
                onCheckedChange={(checked) =>
                  setData({ ...data, mapVisible: checked })
                }
                disabled={false}
                aria-label="Widoczność na mapie rodzin"
                label="Widoczność na mapie rodzin"
                description={
                  <>
                    Po włączeniu Twoja rodzina pojawi się na publicznej{" "}
                    <Link href="/mapa" className="underline">
                      mapie rodzin
                    </Link>
                    . Publikowane są wyłęcznie dane przeznaczone do mapy — nazwa rodziny, miejscowość i kontakty. Prywatne dane zapisowe (adresy, dane dzieci) nigdy nie są publikowane.
                  </>
                }
              />
            </CardContent></Card>

            <Button type="submit" className="w-full">
              Dalej
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            Masz już konto?{" "}
            <Link
              href="/login"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              Zaloguj się
            </Link>
          </div>
        </>
      )}

      {step === "part2" && (
        <>
          <div className="mb-6">
            <h1 className="font-heading text-3xl font-bold">
              Zarejestruj się
            </h1>
            <p className="text-sm text-muted-foreground">
              Krok 2: Konto i zgody
            </p>
          </div>

          <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
            <Card><CardContent className="pt-6">
              <p className="text-sm font-medium mb-3">
                Dane logowania
              </p>

              <Input
                label="Email"
                type="email"
                placeholder="email@example.com"
                value={data.email}
                onChange={(e) =>
                  setData({ ...data, email: e.target.value })
                }
                error={data.email ? getEmailMessage(data.email) || errors.email : errors.email}
                name="email"
                autoComplete="email"
              />

              <Input
                label="Hasło"
                type="password"
                placeholder="••••••••"
                value={data.password}
                onChange={(e) =>
                  setData({ ...data, password: e.target.value })
                }
                error={errors.password}
                name="password"
                autoComplete="new-password"
              />

              <Input
                label="Powtórz hasło"
                type="password"
                placeholder="••••••••"
                value={data.passwordConfirm}
                onChange={(e) =>
                  setData({ ...data, passwordConfirm: e.target.value })
                }
                error={errors.passwordConfirm}
                name="password_confirm"
                autoComplete="new-password"
              />
            </CardContent></Card>

            <Card><CardContent className="pt-6">
              <div className="flex flex-col gap-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={data.agreeDataProcessing}
                    onChange={(e) =>
                      setData({
                        ...data,
                        agreeDataProcessing: e.target.checked,
                      })
                    }
                    className="mt-0.5 size-4 rounded border-border text-primary focus:ring-ring"
                  />
                  <span className="text-sm">
                    Zgadzam się na przetwarzanie moich danych do celów
                    rejestracji w Ohana.
                  </span>
                </label>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={data.agreePrivacy}
                    onChange={(e) =>
                      setData({ ...data, agreePrivacy: e.target.checked })
                    }
                    className="mt-0.5 size-4 rounded border-border text-primary focus:ring-ring"
                  />
                  <span className="text-sm">
                    Zapoznałem się z{" "}
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="text-foreground underline underline-offset-4 hover:text-primary"
                    >
                      polityką prywatności
                    </Link>
                  </span>
                </label>

                {errors.agreeDataProcessing && (
                  <p className="text-xs text-destructive">{errors.agreeDataProcessing}</p>
                )}
                {errors.agreePrivacy && (
                  <p className="text-xs text-destructive">{errors.agreePrivacy}</p>
                )}
              </div>
            </CardContent></Card>

            {errors.submit && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.submit}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Rejestrowanie..." : "Zarejestruj się"}
            </Button>
          </form>
        </>
      )}

      {step === "confirm" && (
        <>
          <div className="mb-6">
            <h1 className="font-heading text-3xl font-bold">
              Potwierdź email
            </h1>
            <p className="text-sm text-muted-foreground">
              Krok 3: Kod z wiadomości email
            </p>
          </div>

          <form noValidate onSubmit={handleOtpSubmit} className="flex flex-col gap-6">
            <Card><CardContent className="pt-6">
              <p className="text-sm">
                Na adres{" "}
                <span className="font-medium">{data.email}</span>{" "}
                wysłaliśmy 6-cyfrowy kod potwierdzający. Wpisz go poniżej.
              </p>

               <div className="space-y-2">
                 <Label htmlFor="otp" className={errors.otp ? "text-destructive" : ""}>
                   Kod potwierdzający
                 </Label>
                 <InputOTP
                   id="otp"
                   maxLength={6}
                   value={otp}
                   onChange={setOtp}
                   disabled={submitting}
                   inputMode="numeric"
                   data-invalid={!!errors.otp}
                   containerClassName="justify-center sm:justify-start"
                   className="mx-auto sm:mx-0"
                 >
                   <InputOTPGroup>
                     <InputOTPSlot index={0} />
                     <InputOTPSlot index={1} />
                     <InputOTPSlot index={2} />
                   </InputOTPGroup>
                   <InputOTPSeparator />
                   <InputOTPGroup>
                     <InputOTPSlot index={3} />
                     <InputOTPSlot index={4} />
                     <InputOTPSlot index={5} />
                   </InputOTPGroup>
                 </InputOTP>
                 {errors.otp && (
                   <p className="text-xs text-destructive">{errors.otp}</p>
                 )}
               </div>
            </CardContent></Card>

            {errors.submit && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.submit}
              </div>
            )}

            <Button
              type="submit"
              disabled={otp.length !== 6 || submitting}
              className="w-full"
            >
              {submitting ? "Potwierdzanie..." : "Potwierdź kod"}
            </Button>

            {resendIn > 0 ? (
              <p className="text-sm text-muted-foreground text-center">
                Możesz poprosić o nowy kod za {resendIn} s
              </p>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={handleResend}
                className="w-full"
              >
                Wyślij kod ponownie
              </Button>
            )}
          </form>
        </>
      )}
    </main>
  );
}
