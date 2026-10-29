import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — ترجم" },
      { name: "description", content: "سجّل الدخول أو أنشئ حساباً لترجمة فيديوهات يوتيوب إلى الكوردية السورانية." },
      { property: "og:title", content: "تسجيل الدخول — ترجم" },
      { property: "og:description", content: "ادخل إلى حسابك في منصة ترجم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/translate" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/translate", data: { display_name: name } },
        });
        if (error) throw error;
        setMsg({ ok: true, text: "تم إنشاء الحساب. افتح بريدك واضغط رابط التأكيد ثم سجّل الدخول." });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setMsg({ ok: true, text: "أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك." });
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      setMsg({
        ok: false,
        text: m.includes("Invalid login") ? "البريد أو كلمة المرور غير صحيحة" : m.includes("confirm") ? "يجب تأكيد البريد أولاً" : m || "حدث خطأ",
      });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-xl border border-border bg-input px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <h1 className="font-display mb-2 text-center text-4xl font-bold">
          {mode === "signin" ? "أهلاً بعودتك" : mode === "signup" ? "إنشاء حساب" : "نسيت كلمة المرور"}
        </h1>
        <p className="mb-8 text-center text-muted-foreground">
          {mode === "forgot" ? "أدخل بريدك وسنرسل لك رابطاً." : "ترجمة فيديوهاتك إلى الكوردية بانتظارك."}
        </p>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
          {mode === "signup" && (
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className={field} />
          )}
          <input required dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className={field} />
          {mode !== "forgot" && (
            <input required dir="ltr" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={field} />
          )}
          <button disabled={busy} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
            {busy ? "لحظة…" : mode === "signin" ? "دخول" : mode === "signup" ? "إنشاء الحساب" : "إرسال الرابط"}
          </button>
          {msg && <p className={msg.ok ? "text-center text-sm text-primary" : "text-center text-sm text-destructive"}>{msg.text}</p>}
        </form>
        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          {mode === "signin" && (
            <>
              <button onClick={() => setMode("signup")} className="hover:text-primary">ليس لديك حساب؟ أنشئ حساباً</button>
              <button onClick={() => setMode("forgot")} className="hover:text-primary">نسيت كلمة المرور؟</button>
            </>
          )}
          {mode !== "signin" && <button onClick={() => setMode("signin")} className="hover:text-primary">العودة لتسجيل الدخول</button>}
        </div>
      </div>
    </main>
  );
}
