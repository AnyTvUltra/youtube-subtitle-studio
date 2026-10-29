import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic, Languages, Captions, Link2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ترجم — ترجمة فيديوهات يوتيوب إلى الكوردية السورانية" },
      { name: "description", content: "الصق رابط فيديو يوتيوب واحصل على ترجمة كوردية سورانية دقيقة حسب سياق الحوار، تظهر أسفل الفيديو مثل يوتيوب." },
      { property: "og:title", content: "ترجم — أي فيديو، بالكوردية" },
      { property: "og:description", content: "تحويل كلام الفيديو إلى نص وترجمته إلى الكوردية السورانية بالذكاء الاصطناعي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Link2, title: "الصق الرابط فقط", text: "لا تحميل ولا برامج. رابط يوتيوب واحد يكفي." },
  { icon: Mic, title: "يستمع للكلام", text: "يحوّل صوت الفيديو إلى نص مع توقيت كل جملة." },
  { icon: Languages, title: "ترجمة حسب السياق", text: "يفهم الحوار كاملاً ويترجمه إلى السورانية بأسلوب طبيعي." },
  { icon: Captions, title: "ترجمة على الفيديو", text: "تظهر أسفل منتصف الفيديو بخلفية شفافة كما في يوتيوب." },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
          <div>
            <p className="mb-4 text-sm tracking-[0.3em] text-primary">کوردی · سۆرانی</p>
            <h1 className="font-display text-5xl font-bold leading-tight md:text-7xl">
              أي فيديو، <span className="text-primary">بلغتك</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              منصة ترجم تحوّل كلام فيديوهات يوتيوب إلى ترجمة كوردية سورانية متناسقة مع سياق الحوار، وتعرضها فوق الفيديو مباشرة.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/translate" className="rounded-full bg-primary px-7 py-3 font-semibold text-primary-foreground shadow-lg transition hover:opacity-90">
                ابدأ الترجمة مجاناً
              </Link>
              <Link to="/auth" className="rounded-full border border-border px-7 py-3 font-semibold transition hover:bg-accent">
                تسجيل الدخول
              </Link>
            </div>
          </div>

          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-secondary shadow-2xl">
            <img src="https://i.ytimg.com/vi/aqz-KE-bpKQ/maxresdefault.jpg" alt="معاينة فيديو مترجم" className="h-full w-full object-cover opacity-80" />
            <div className="absolute inset-x-0 bottom-[8%] flex justify-center px-6">
              <span className="caption-box">ئەمە نموونەیەکی وەرگێڕانە بۆ زمانی کوردی</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="font-display mb-12 text-center text-3xl font-bold md:text-4xl">كيف تعمل؟</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary">
              <div className="mb-4 flex items-center justify-between">
                <f.icon className="h-7 w-7 text-primary" />
                <span className="font-display text-3xl text-muted-foreground/40">{i + 1}</span>
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24">
        <div className="rounded-3xl border border-border bg-card p-10 text-center md:p-14">
          <h2 className="font-display text-3xl font-bold md:text-4xl">جاهز لتشاهد بلغتك؟</h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">أنشئ حساباً في ثوانٍ، واحتفظ بسجل كل الفيديوهات التي ترجمتها.</p>
          <Link to="/auth" className="mt-8 inline-block rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground">
            أنشئ حسابك
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">© ترجم {new Date().getFullYear()}</footer>
    </main>
  );
}
