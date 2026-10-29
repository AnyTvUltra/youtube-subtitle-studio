import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة — ترجم" },
      { name: "description", content: "اختر كلمة مرور جديدة لحسابك في ترجم." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة — ترجم" },
      { property: "og:description", content: "اختر كلمة مرور جديدة لحسابك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setMsg(error.message);
    navigate({ to: "/translate" });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <form onSubmit={submit} className="mx-auto mt-16 max-w-md space-y-4 rounded-2xl border border-border bg-card p-6">
        <h1 className="font-display text-3xl font-bold">كلمة مرور جديدة</h1>
        <input required dir="ltr" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-border bg-input px-4 py-3 outline-none focus:ring-2 focus:ring-ring" />
        <button className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">حفظ</button>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </form>
    </main>
  );
}
