import { useState } from "preact/hooks";
import { LiveBoxPlayer } from "./LiveBoxPlayer.tsx";

interface LiveBoxProps {
  isUruguayPlaying: boolean;
  isAntelISP: boolean;
  homeTeam?: string | null;
  awayTeam?: string | null;
}

export default function LiveBox({
  isUruguayPlaying,
  isAntelISP,
  homeTeam,
  awayTeam,
}: LiveBoxProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!isUruguayPlaying || !isOpen) return null;

  const matchup =
    homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : "Uruguay";

  return (
    <div
      id="live-box"
      class="fixed z-50 bottom-4 right-4 md:bottom-6 md:right-6 transition-all ease-in drop-shadow-[0_0_20px_rgba(56,189,248,0.25)]"
    >
      <div class="relative w-full aspect-video bg-black overflow-hidden group rounded-[12px_24px_12px_24px] border-2 border-sky-400 shadow-[4px_4px_0px_0px_theme(colors.sky.500)]">
        <button
          id="live-box-close"
          class="absolute right-2 top-2 z-10 cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-bold text-white/60 bg-black/50 hover:text-white hover:bg-sky-400/30 transition-colors backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          Cerrar ✕
        </button>

        <div class="w-[320px] md:w-[380px] h-full bg-black relative">
          {isAntelISP ? (
            <LiveBoxPlayer />
          ) : (
            <div class="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] px-4 text-center">
              <p class="text-sm text-white/50 font-mono">
                Partido en vivo solo disponible para usuarios de Antel
              </p>
            </div>
          )}
        </div>
      </div>

      <div class="mt-2 flex flex-col items-center justify-center gap-y-1.5 py-2 px-3 text-center rounded-xl bg-sky-500 border border-sky-400">
        <div class="flex items-center gap-1.5">
          <span class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/15 text-[9px] font-bold uppercase tracking-wider text-white">
            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            EN VIVO
          </span>
        </div>
        <p class="text-xs font-barlow font-semibold text-white">
          {matchup}
        </p>
        <a
          href="/en-vivo"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[10px] text-white/70 hover:text-white transition-colors font-mono"
        >
          Ver en pantalla completa →
        </a>
      </div>
    </div>
  );
}
