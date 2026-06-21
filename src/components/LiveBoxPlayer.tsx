import { useEffect, useRef, useState } from "preact/hooks";
import Hls from "hls.js";

const PUBLIC_ID = "2s6nd";
const API_SESIONES = "https://veratv-be.vera.com.uy/api/sesiones";
const API_SETUP = "https://veratv-be.vera.com.uy/api/setup";
const FALLBACK_URL = "https://anteltv.com.uy/play/2s6nd";

export function LiveBoxPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let hlsInstance: Hls | null = null;
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled) setStatus("error");
    }, 20000);

    async function init() {
      try {
        const sesRes = await fetch(API_SESIONES, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "anonima" }),
        });
        if (cancelled) return;
        if (!sesRes.ok) throw new Error("Error al crear sesión");
        const { token } = await sesRes.json();

        const setupRes = await fetch(`${API_SETUP}?token=${token}&public_id=${PUBLIC_ID}`);
        if (cancelled) return;
        clearTimeout(timeout);
        if (!setupRes.ok) throw new Error("Error al obtener URL de reproducción");
        const setupData = await setupRes.json();
        if (setupData.url?.status !== "OK" || !setupData.url?.suggested?.url) {
          throw new Error("Stream no disponible");
        }

        const playbackUrl = setupData.url.suggested.url;
        const video = videoRef.current;
        if (!video) return;

        if (Hls.isSupported()) {
          hlsInstance = new Hls();
          hlsInstance.loadSource(playbackUrl);
          hlsInstance.attachMedia(video);
          hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
            setStatus("ready");
          });
          hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setStatus("error");
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = playbackUrl;
          video.addEventListener("loadedmetadata", () => {
            video.play().catch(() => {});
            setStatus("ready");
          });
        } else {
          throw new Error("HLS no soportado");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("LiveBoxPlayer error:", err);
          setStatus("error");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (hlsInstance) hlsInstance.destroy();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  if (status === "error") {
    return (
      <iframe
        src={FALLBACK_URL}
        title="AntelTV"
        class="absolute inset-0 w-full h-full border-0 bg-black"
        allow="autoplay"
      />
    );
  }

  return (
    <div class="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        playsinline
        muted={muted}
        class="w-full h-full object-cover"
        style={{ display: status === "ready" ? "block" : "none" }}
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          v.paused ? v.play().catch(() => {}) : v.pause();
        }}
      />

      {status === "loading" && (
        <div class="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center">
          <div class="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        </div>
      )}

      <button
        onClick={() => setMuted((m) => !m)}
        class="absolute bottom-2 right-2 z-10 p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white/70 hover:text-white transition"
        title={muted ? "Desilenciar" : "Silenciar"}
      >
        {muted ? (
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M23 9l-6 6" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 9l6 6" />
          </svg>
        ) : (
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.07 4.93a10 10 0 010 14.14" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.54 8.46a5 5 0 010 7.07" />
          </svg>
        )}
      </button>
    </div>
  );
}
