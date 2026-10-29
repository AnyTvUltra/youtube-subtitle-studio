import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "الوضع النهاري" : "الوضع الليلي"}
      className="rounded-full border border-border p-2 text-foreground transition hover:bg-accent"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="font-display text-2xl font-bold text-primary">
          ترجم
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <ThemeToggle />
          {email ? (
            <>
              <Link to="/translate" className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground">
                المترجم
              </Link>
              <button onClick={signOut} className="rounded-full border border-border px-4 py-2 hover:bg-accent">
                خروج
              </button>
            </>
          ) : (
            <Link to="/auth" className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground">
              تسجيل الدخول
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
