import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { translateVideo, type Cue } from "@/lib/translate.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ترجم — ترجمة فيديوهات يوتيوب بالذكاء الاصطناعي" },
      { name: "description", content: "الصق رابط فيديو يوتيوب واحصل على ترجمة فورية تظهر أسفل الفيديو." },
      { property: "og:title", content: "ترجم — ترجمة فيديوهات يوتيوب" },
      { property: "og:description", content: "ترجمة فيديوهات يوتيوب بالذكاء الاصطناعي مع عرض الترجمة على الفيديو." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const LANGS = ["العربية", "English", "Français", "Español", "Türkçe", "Deutsch", "فارسی", "اردو"];

function parseId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/) || url.match(/^([\w-]{11})$/);
  return m?.[1] ?? null;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function loadYT(): Promise<any> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    if (!document.getElementById("yt-api")) {
      const s = document.createElement("script");
      s.id = "yt-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(s);
    }
  });
}

function Index() {
  const translate = useServerFn(translateVideo);
  const [url, setUrl] = useState("");
  const [lang, setLang] = useState("العربية");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [caption, setCaption] = useState("");
  const playerRef = useRef<any>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = parseId(url.trim());
    if (!id) return setError("الرابط غير صحيح، تأكد من أنه رابط فيديو يوتيوب");
    setError("");
    setCues([]);
    setCaption("");
    setVideoId(id);
    setLoading(true);
    try {
      const r = await translate({ data: { videoId: id, language: lang } });
      setCues(r.cues);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !hostRef.current) return;
      playerRef.current?.destroy?.();
      const el = document.createElement("div");
      hostRef.current.innerHTML = "";
      hostRef.current.appendChild(el);
      playerRef.current = new YT.Player(el, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { cc_load_policy: 0, iv_load_policy: 3, rel: 0, fs: 0, playsinline: 1 },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useEffect(() => {
    if (!cues.length) return;
    const t = setInterval(() => {
      const time = playerRef.current?.getCurrentTime?.() ?? 0;
      let found = "";
      for (const c of cues) {
        if (time >= c.start && time < c.end) found = found ? found + " " + c.text : c.text;
        if (c.start > time) break;
      }
      setCaption(found);
    }, 150);
    return () => clearInterval(t);
  }, [cues]);

  return (
    <main dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-20">
        <header className="mb-10 text-center">
          <p className="mb-3 text-sm tracking-[0.3em] text-primary">ترجم</p>
          <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
            أي فيديو، <span className="text-primary">بلغتك</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            الصق رابط فيديو يوتيوب، اختر اللغة، وشاهد الترجمة تظهر أسفل الفيديو مباشرة.
          </p>
        </header>

        <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-card p-3 md:flex-row">
          <input
            dir="ltr"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 rounded-xl bg-input px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-xl bg-input px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {LANGS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <button
            disabled={loading}
            className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "جارٍ الترجمة…" : "ترجم الفيديو"}
          </button>
        </form>

        {error && <p className="mt-4 text-center text-destructive">{error}</p>}

        {videoId && (
          <section className="mt-10">
            <div ref={frameRef} className="relative aspect-video w-full overflow-hidden rounded-2xl bg-secondary shadow-2xl">
              <div ref={hostRef} className="absolute inset-0" />
              {caption && (
                <div className="pointer-events-none absolute inset-x-0 bottom-[8%] flex justify-center px-6">
                  <span dir="auto" className="caption-box">
                    {caption}
                  </span>
                </div>
              )}
              {loading && (
                <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-caption px-3 py-1 text-xs text-caption-foreground">
                  Claude يترجم الآن…
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>{cues.length ? `${cues.length} سطر مترجم` : ""}</span>
              <button
                type="button"
                onClick={() => frameRef.current?.requestFullscreen?.()}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent"
              >
                ملء الشاشة مع الترجمة
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
