"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("error") === "email-confirm"
      ? "Potwierdzenie nie powiodło się. Spróbuj ponownie."
      : null,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Nieprawidłowy email lub hasło.");
      setLoading(false);
      return;
    }

    const isAdmin = data.session?.user.app_metadata?.role === "admin";
    router.push(isAdmin ? "/admin" : "/dashboard");
    router.refresh();
  };

  return (
    <div>
      <main>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>
                Zaloguj się
              </CardTitle>
              <CardDescription>
                do Ohany i dołącz do naszej społeczności
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                {error && (
                  <div>
                    {error}
                  </div>
                )}

                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Input
                  type="password"
                  placeholder="Hasło"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <Button
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Logowanie..." : "Zaloguj się"}
                </Button>
              </form>

              <div>
                Nie masz konta?{" "}
                <Link
                  href="/register"
                >
                  Zarejestruj się
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
