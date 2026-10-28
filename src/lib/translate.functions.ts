import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Cue = { start: number; end: number; text: string };

function decode(s: string) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchCaptions(videoId: string): Promise<Cue[]> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
      videoId,
    }),
  });
  if (!res.ok) throw new Error("تعذر الوصول إلى الفيديو على يوتيوب");
  const data: any = await res.json();
  const tracks: any[] = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!tracks.length) throw new Error("هذا الفيديو لا يحتوي على ترجمة أو نص متاح للقراءة");
  const track =
    tracks.find((t) => t.kind !== "asr" && t.languageCode?.startsWith("en")) ??
    tracks.find((t) => t.kind !== "asr") ??
    tracks[0];
  const xml = await (await fetch(track.baseUrl)).text();
  const cues: Cue[] = [];
  const re = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const text = decode(m[3]);
    if (!text) continue;
    const start = Number(m[1]) / 1000;
    cues.push({ start, end: start + Number(m[2] ?? 2000) / 1000, text });
  }
  if (!cues.length) throw new Error("لم يتم العثور على نص في هذا الفيديو");
  return cues;
}

async function claudeTranslate(lines: string[], language: string, apiKey: string) {
  const numbered = lines.map((l, i) => `${i + 1}|${l}`).join("\n");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-5",
      max_tokens: 16000,
      stream: true,
      system: `You translate video subtitles into ${language}. Each input line is "N|text". Output exactly one line per input line in the same format "N|translation", keeping every number, natural and concise like professional subtitles. Output nothing else.`,
      messages: [{ role: "user", content: numbered }],
    }),
  });
  if (!res.ok || !res.body) {
    let msg = `خطأ في خدمة الترجمة (${res.status})`;
    try {
      const j: any = await res.json();
      msg = j?.error?.message || j?.message || msg;
    } catch {}
    if (res.status === 402) msg = "نفد رصيد الذكاء الاصطناعي. يرجى إضافة رصيد.";
    if (res.status === 429) msg = "طلبات كثيرة، حاول مرة أخرى بعد قليل.";
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5));
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") out += ev.delta.text;
        if (ev.type === "error") throw new Error(ev.error?.message || "خطأ في الترجمة");
      } catch (e) {
        if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
      }
    }
  }
  const result = [...lines];
  for (const l of out.split("\n")) {
    const mm = l.match(/^\s*(\d+)\s*\|(.*)$/);
    if (mm) {
      const i = Number(mm[1]) - 1;
      if (i >= 0 && i < result.length) result[i] = mm[2].trim();
    }
  }
  return result;
}

export const translateVideo = createServerFn({ method: "POST" })
  .inputValidator(z.object({ videoId: z.string().regex(/^[\w-]{11}$/), language: z.string().min(2).max(40) }))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("مفتاح الذكاء الاصطناعي غير مُعد");
    const cues = await fetchCaptions(data.videoId);
    const CHUNK = 120;
    const translated: string[] = [];
    for (let i = 0; i < cues.length; i += CHUNK) {
      const part = cues.slice(i, i + CHUNK).map((c) => c.text);
      translated.push(...(await claudeTranslate(part, data.language, apiKey)));
    }
    return { cues: cues.map((c, i) => ({ ...c, text: translated[i] ?? c.text })) };
  });
