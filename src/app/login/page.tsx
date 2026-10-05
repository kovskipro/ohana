"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    <main className="flex justify-center py-12">
      <div className="w-full max-w-md">
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
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              <Input
                type="password"
                placeholder="Hasło"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? "Logowanie..." : "Zaloguj się"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              Nie masz konta?{" "}
              <Link
                href="/register"
                className="text-foreground underline underline-offset-4 hover:text-primary"
              >
                Zarejestruj się
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
