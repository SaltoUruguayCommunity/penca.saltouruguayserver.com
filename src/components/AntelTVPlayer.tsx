import { useEffect, useRef, useState } from "preact/hooks";
import Hls from "hls.js";
import AntelTVLogo from "../images/AntelTVLogo.tsx";

const PUBLIC_ID = "2s6nd";
const API_SESIONES = "https://veratv-be.vera.com.uy/api/sesiones";
const API_SETUP = "https://veratv-be.vera.com.uy/api/setup";
const FALLBACK_URL = "https://anteltv.com.uy/play/2s6nd";

export function AntelTVPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number>(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.5);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => { });
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  };

  const isFallback = status === "error";

  const showControlsTemporarily = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    let hlsInstance: Hls | null = null;
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setStatus("error");
      }
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
            video.play().catch(() => { });
            setStatus("ready");
          });
          hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setStatus("error");
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = playbackUrl;
          video.addEventListener("loadedmetadata", () => {
            video.play().catch(() => { });
            setStatus("ready");
          });
        } else {
          throw new Error("HLS no soportado en este navegador");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("AntelTVPlayer error:", err);
          setStatus("error");
        }
      }
    }

    init();

    const onFullscreenChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {

      document.removeEventListener("fullscreenchange", onFullscreenChange);
      cancelled = true;
      clearTimeout(timeout);
      if (hlsInstance) hlsInstance.destroy();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (!muted) video.volume = volume;
  }, [muted, volume]);

  return (
    <div
      ref={containerRef}
      class="relative w-full h-full bg-black overflow-hidden group"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video siempre montado para que el ref exista */}
      <video
        ref={videoRef}
        playsinline
        muted={muted}
        class="w-full h-full object-cover cursor-pointer"
        style={{ display: status === "ready" ? "block" : "none" }}
        onClick={status === "ready" ? togglePlay : undefined}
        onLoadedData={() => setPlaying(true)}
      />

      {/* Loading overlay */}
      {status === "loading" && (
        <div class="absolute inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden">
          <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.08),_transparent_70%)]" />
          <div class="flex flex-col items-center gap-6 relative z-10">
            <div class="w-12 h-12 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
            <div class="text-center">
              <p class="text-lg font-barlow font-semibold text-white/80">Cargando transmisión</p>
              <p class="text-xs text-white/30 font-mono mt-1">Canal 5 &middot; AntelTV</p>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
            <div class="h-full w-full bg-accent origin-left animate-[loadingBar_2s_ease-in-out_infinite]" />
          </div>
          <style>{`
            @keyframes loadingBar {
              0% { transform: scaleX(0); transform-origin: left; }
              50% { transform: scaleX(1); transform-origin: left; }
              51% { transform: scaleX(1); transform-origin: right; }
              100% { transform: scaleX(0); transform-origin: right; }
            }
          `}</style>
        </div>
      )}

      {/* Fallback iframe */}
      {isFallback && (
        <iframe
          src={FALLBACK_URL}
          title="AntelTV"
          class="absolute inset-0 w-full h-full border-0 bg-black"
          allow="autoplay; fullscreen; picture-in-picture"
        />
      )}

      {/* Center play/pause overlay */}
      {status === "ready" && (
        <div
          class="absolute inset-0 flex items-center justify-center transition-opacity duration-300 cursor-pointer"
          style={{ opacity: showControls ? 1 : 0 }}
          onClick={togglePlay}
        >
          <div class="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center transition-transform duration-200 hover:scale-110">
            {playing ? (
              <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg class="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Bottom controls bar */}
      {status === "ready" && (
        <div
          class="absolute bottom-0 left-0 right-0 transition-opacity duration-300"
          style={{ opacity: showControls ? 1 : 0 }}
        >
          <div class="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-0">
            <div class="bg-surface/40 backdrop-blur-md border-t border-white/5 px-4 md:px-6 py-2 flex items-center justify-between">
              <div class="flex items-center gap-1">
                <button onClick={togglePlay} class="text-white/70 hover:text-white transition p-1">
                  {playing ? (
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => setMuted((m) => !m)}
                  class="text-white/70 hover:text-white transition p-1"
                  title={muted ? "Desilenciar" : "Silenciar"}
                >
                  {muted || volume === 0 ? (
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M23 9l-6 6" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17 9l6 6" />
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.54 8.46a5 5 0 010 7.07" />
                    </svg>
                  ) : (
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width={2}>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19.07 4.93a10 10 0 010 14.14" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.54 8.46a5 5 0 010 7.07" />
                    </svg>
                  )}
                </button>

                <div class="hidden sm:flex items-center w-20">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={muted ? 0 : volume}
                    onInput={(e) => {
                      const v = parseFloat((e.target as HTMLInputElement).value);
                      setVolume(v);
                      if (v > 0) setMuted(false);
                      else setMuted(true);
                    }}
                    class="w-full h-1 appearance-none bg-white/20 rounded-full cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
                      [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0
                      hover:bg-white/30 transition-colors"
                  />
                </div>

                <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/15 text-[10px] font-bold uppercase tracking-wider text-red-400">
                  <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  EN VIVO
                </span>
                <span class="text-sm font-semibold text-white/70 font-barlow hidden sm:inline">Canal 5</span>
              </div>
              <div class="flex items-center gap-3">
                <AntelTVLogo class="h-8 w-auto opacity-50 hover:opacity-100 transition-opacity" />
                <button onClick={toggleFullscreen} class="text-white/70 hover:text-white transition p-1">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {fullscreen ? (
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    ) : (
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}