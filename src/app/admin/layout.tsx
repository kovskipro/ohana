"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        router.push("/login");
        return;
      }
      const { data: admin } = await supabase.rpc("is_admin");
      if (!admin) {
        router.push("/dashboard");
        return;
      }
      setIsAdmin(true);
    };
    check();
  }, [router, supabase]);

  if (isAdmin === null) {
    return (
      <div>
        <p>Wczytywanie...</p>
      </div>
    );
  }

  return <div>{children}</div>;
}
