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
    <div>
      <main>
        <div>
          {step === "part1" && (
            <>
              <div>
                <h1>
                  Zarejestruj się
                </h1>
                <p>
                  Krok 1: Dane rodziny
                </p>
              </div>

              <form noValidate onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
                <Card><CardContent>
                  <Input
                    label="Nazwa profilu (np. Kossakowscy)"
                    placeholder="Nazwa rodziny"
                    value={data.profileName}
                    onChange={(e) => setData({ ...data, profileName: e.target.value })}
                    error={errors.profileName}
                  />

                  <ChildrenAgesInput
                    numChildren={data.numChildren}
                    ages={data.childrenAges}
                    onNumChildrenChange={(num) =>
                      setData({ ...data, numChildren: num })
                    }
                    onAgesChange={(ages) =>
                      setData({ ...data, childrenAges: ages })
                    }
                    error={errors.numChildren}
                  />

                  <InterestsInput
                    value={data.interests}
                    onChange={(interests) => setData({ ...data, interests })}
                    error={errors.interests}
                  />
                </CardContent></Card>

                <Card><CardContent>
                  <p>
                    Kontakt do rodziny (minimum jeden)
                  </p>

                  <PhoneInput
                    label="Numer telefonu"
                    value={data.contactPhone}
                    onChange={(e) =>
                      setData({ ...data, contactPhone: e.target.value })
                    }
                    error={data.contactPhone ? getPhoneMessage(data.contactPhone) || errors.contactPhone : errors.contactPhone}
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
                  />

                  <Input
                    label="Profil Facebook (link)"
                    placeholder="https://facebook.com/..."
                    value={data.contactFb}
                    onChange={(e) =>
                      setData({ ...data, contactFb: e.target.value })
                    }
                  />

                  <Input
                    label="Profil Instagram"
                    placeholder="@username"
                    value={data.contactInstagram}
                    onChange={(e) =>
                      setData({ ...data, contactInstagram: e.target.value })
                    }
                  />

                  {errors.contact && (
                    <p>{errors.contact}</p>
                  )}
                </CardContent></Card>

                <Card><CardContent>
                  <Input
                    label="Miejscowość"
                    placeholder="Warszawa"
                    value={data.city}
                    onChange={(e) => setData({ ...data, city: e.target.value })}
                    error={errors.city}
                  />

                  <Input
                    label="Kod pocztowy"
                    placeholder="XX-XXX"
                    value={data.postalCode}
                    onChange={(e) => setData({ ...data, postalCode: e.target.value })}
                    error={errors.postalCode}
                  />

                  <Select
                    label="Województwo"
                    options={VOIVODESHIPS.map((v) => ({ value: v, label: v }))}
                    value={data.voivodeship}
                    onChange={(value) => setData({ ...data, voivodeship: value })}
                    error={errors.voivodeship}
                  />
                </CardContent></Card>

                <Card><CardContent>
                  <Switch
                    checked={data.mapVisible}
                    onCheckedChange={(checked) =>
                      setData({ ...data, mapVisible: checked })
                    }
                    aria-label="Widoczność na mapie rodzin"
                    label="Widoczność na mapie rodzin"
                    description="Po włączeniu Twoja rodzina pojawi się na publicznej mapie Ohany. Publikowane są wyłącznie dane przeznaczone do mapy — nazwa rodziny, miejscowość i kontakty. Prywatne dane zapisowe (adresy, dane dzieci) nigdy nie są publikowane."
                  />
                </CardContent></Card>

                <Button type="submit">
                  Dalej
                </Button>
              </form>

              <div>
                Masz już konto?{" "}
                <Link
                  href="/login"
                >
                  Zaloguj się
                </Link>
              </div>
            </>
          )}

          {step === "part2" && (
            <>
              <div>
                <h1>
                  Zarejestruj się
                </h1>
                <p>
                  Krok 2: Konto i zgody
                </p>
              </div>

              <form noValidate onSubmit={handleSubmit}>
                <Card><CardContent>
                  <p>
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
                  />
                </CardContent></Card>

                <Card><CardContent>
                  <label>
                    <input
                      type="checkbox"
                      checked={data.agreeDataProcessing}
                      onChange={(e) =>
                        setData({
                          ...data,
                          agreeDataProcessing: e.target.checked,
                        })
                      }
                    />
                    <span>
                      Zgadzam się na przetwarzanie moich danych do celów
                      rejestracji w Ohana.
                    </span>
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={data.agreePrivacy}
                      onChange={(e) =>
                        setData({ ...data, agreePrivacy: e.target.checked })
                      }
                    />
                    <span>
                      Zapoznałem się z{" "}
                      <Link
                        href="/privacy"
                        target="_blank"
                      >
                        polityką prywatności
                      </Link>
                    </span>
                  </label>

                  {errors.agreeDataProcessing && (
                    <p>
                      {errors.agreeDataProcessing}
                    </p>
                  )}
                  {errors.agreePrivacy && (
                    <p>{errors.agreePrivacy}</p>
                  )}
                </CardContent></Card>

                {errors.submit && (
                  <div>
                    {errors.submit}
                  </div>
                )}

                <Button type="submit" disabled={submitting}>
                  {submitting ? "Rejestrowanie..." : "Zarejestruj się"}
                </Button>
              </form>
            </>
          )}

          {step === "confirm" && (
            <>
              <div>
                <h1>
                  Potwierdź email
                </h1>
                <p>
                  Krok 3: Kod z wiadomości email
                </p>
              </div>

              <form noValidate onSubmit={handleOtpSubmit}>
                <Card><CardContent>
                  <p>
                    Na adres{" "}
                    <span>{data.email}</span>{" "}
                    wysłaliśmy 6-cyfrowy kod potwierdzający. Wpisz go poniżej.
                  </p>

                  <OtpInput
                    label="Kod potwierdzający"
                    length={6}
                    mode="numeric"
                    groupEvery={3}
                    onChange={setOtp}
                    status={errors.otp ? "error" : "idle"}
                    errorMessage={errors.otp}
                    disabled={submitting}
                  />
                </CardContent></Card>

                {errors.submit && (
                  <div>
                    {errors.submit}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={otp.length !== 6 || submitting}
                >
                  {submitting ? "Potwierdzanie..." : "Potwierdź kod"}
                </Button>

                {resendIn > 0 ? (
                  <p>
                    Możesz poprosić o nowy kod za {resendIn} s
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleResend}
                  >
                    Wyślij kod ponownie
                  </Button>
                )}
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
