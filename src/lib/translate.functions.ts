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

async function getPlayer(videoId: string): Promise<any> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
      videoId,
    }),
  });
  if (!res.ok) throw new Error("تعذر الوصول إلى الفيديو على يوتيوب");
  return res.json();
}

function ts(v: string) {
  const parts = v.trim().split(":").map(Number);
  return parts.reduce((a, b) => a * 60 + b, 0);
}

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// Speech-to-text: download the audio track and let Gemini transcribe it with timings.
async function transcribeAudio(data: any, apiKey: string): Promise<Cue[]> {
  const formats: any[] = (data?.streamingData?.adaptiveFormats ?? []).filter(
    (f: any) => f.url && String(f.mimeType).startsWith("audio/mp4"),
  );
  formats.sort((a, b) => Number(a.contentLength ?? 9e9) - Number(b.contentLength ?? 9e9));
  const fmt = formats[0];
  if (!fmt) throw new Error("no audio");
  if (Number(fmt.contentLength ?? 0) > 20_000_000) throw new Error("audio too large");
  const audioRes = await fetch(fmt.url);
  if (!audioRes.ok) throw new Error("audio download failed");
  const b64 = toBase64(await audioRes.arrayBuffer());
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      stream: true,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe all spoken words in this audio in their original language, with accurate timestamps. Output only lines in the format 'MM:SS.s-MM:SS.s|text' (use H:MM:SS.s for over an hour). Keep each line a short subtitle-sized segment (max ~12 words). No other text.",
            },
            { type: "input_audio", input_audio: { data: b64, format: "m4a" } },
          ],
        },
      ],
    }),
  });
  if (!res.ok || !res.body) throw new Error(`stt ${res.status}`);
  const text = await readSSE(res.body, (ev) => ev.choices?.[0]?.delta?.content ?? "");
  const cues: Cue[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([\d:.]+)\s*-\s*([\d:.]+)\s*\|(.+)$/);
    if (m && m[1] && m[2] && m[3]) cues.push({ start: ts(m[1]), end: ts(m[2]), text: m[3].trim() });
  }
  if (!cues.length) throw new Error("empty transcript");
  return cues;
}

async function readSSE(body: ReadableStream<Uint8Array>, pick: (ev: any) => string) {
  const reader = body.getReader();
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
      if (!line.startsWith("data:") || line === "data: [DONE]") continue;
      let ev: any;
      try {
        ev = JSON.parse(line.slice(5));
      } catch {
        continue;
      }
      if (ev.type === "error" || ev.error) throw new Error(ev.error?.message || "خطأ في الخدمة");
      out += pick(ev);
    }
  }
  return out;
}

async function fetchCaptions(data: any): Promise<Cue[]> {
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
    const text = decode(m[3] ?? "");
    if (!text) continue;
    const start = Number(m[1]) / 1000;
    cues.push({ start, end: start + Number(m[2] ?? 2000) / 1000, text });
  }
  if (!cues.length) throw new Error("لم يتم العثور على نص في هذا الفيديو");
  return cues;
}

async function claudeTranslate(lines: string[], context: string, apiKey: string) {
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
      system: `You are an expert subtitle translator into Central Kurdish (Sorani, کوردیی ناوەندی) written in the Kurdish Arabic script. The input is a speech-to-text transcript of a video, one segment per line as "N|text". First understand the whole conversation: who is speaking, tone, topic and how sentences continue across lines. Then translate each segment into natural, fluent Sorani that fits the context of the dialogue (not word-for-word), fixing obvious transcription mistakes, keeping names and terms consistent, and keeping each line short like professional subtitles. Output exactly one line per input line as "N|translation", keeping every number. Output nothing else.`,
      messages: [{ role: "user", content: (context ? `Previous context (do not translate):\n${context}\n\nTranslate:\n` : "") + numbered }],
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
  const out = await readSSE(res.body, (ev) =>
    ev.type === "content_block_delta" && ev.delta?.type === "text_delta" ? ev.delta.text : "",
  );
  const result = [...lines];
  for (const l of out.split("\n")) {
    const mm = l.match(/^\s*(\d+)\s*\|(.*)$/);
    if (mm) {
      const i = Number(mm[1]) - 1;
      if (i >= 0 && i < result.length) result[i] = (mm[2] ?? "").trim();
    }
  }
  return result;
}

export const translateVideo = createServerFn({ method: "POST" })
  .validator(z.object({ videoId: z.string().regex(/^[\w-]{11}$/) }))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("مفتاح الذكاء الاصطناعي غير مُعد");
    const player = await getPlayer(data.videoId);
    let cues: Cue[];
    let source: "speech" | "captions" = "speech";
    try {
      cues = await transcribeAudio(player, apiKey);
    } catch (e) {
      console.error("speech-to-text failed, falling back to captions", e);
      cues = await fetchCaptions(player);
      source = "captions";
    }
    const CHUNK = 150;
    const translated: string[] = [];
    for (let i = 0; i < cues.length; i += CHUNK) {
      const part = cues.slice(i, i + CHUNK).map((c) => c.text);
      const ctx = cues.slice(Math.max(0, i - 20), i).map((c) => c.text).join("\n");
      translated.push(...(await claudeTranslate(part, ctx, apiKey)));
    }
    return { source, cues: cues.map((c, i) => ({ ...c, text: translated[i] ?? c.text })) };
  });
