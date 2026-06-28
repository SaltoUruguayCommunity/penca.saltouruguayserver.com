import { useEffect, useRef, useState } from "preact/hooks";
import { Zap, ChevronDown, ChevronUp } from "lucide-preact";
import type { Session } from "@auth/core/types";

type Match = {
  id: number;
  matchDate: string;
  stage: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: number; name: string; flag: string | null };
  awayTeam: { id: number; name: string; flag: string | null };
};

type PredictionMap = Record<number, { homeScore: number; awayScore: number; points?: number | null }>;

type Props = {
  user: Session['user'] | null;
  groups: Array<{
    matches: Match[];
  }>;
  knockoutMatches: Match[];
  predictions: PredictionMap;
  onSubmit: (matchId: number, homeScore: number, awayScore: number) => Promise<void>;
};

function formatMatchDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-UY", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

const STAGE_LABELS: Record<string, string> = {
  group: "Fase de Grupos",
  last_32: "Treintaydosavos",
  round_of_16: "Dieciseisavos",
  quarter_final: "Cuartos",
  semi_final: "Semifinal",
  third_place: "Tercer Puesto",
  final: "Final",
};

export default function QuickPredict({ user, groups, knockoutMatches, predictions, onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [localPreds, setLocalPreds] = useState<Record<number, { home: string; away: string }>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // All future unfinished matches without prediction (groups + knockout)
  const allMatches = [
    ...groups.flatMap((g) => g.matches),
    ...knockoutMatches,
  ];
  const pending = allMatches
    .filter((m) => {
      const isFinished = m.status === "finished";
      const isLive = !isFinished && new Date(m.matchDate) <= new Date();
      return !isFinished && !isLive && !predictions[m.id];
    })
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

  const total = pending.length;
  const filled = Object.values(localPreds).filter(
    (p) => p.home !== "" && p.away !== ""
  ).length;

  // Initialize local state from existing predictions
  useEffect(() => {
    const init: Record<number, { home: string; away: string }> = {};
    for (const m of pending) {
      const pred = predictions[m.id];
      if (pred) {
        init[m.id] = { home: String(pred.homeScore), away: String(pred.awayScore) };
      } else {
        init[m.id] = { home: "", away: "" };
      }
    }
    setLocalPreds(init);
  }, [groups, predictions]);

  function focusNext(matchId: number, field: "home" | "away") {
    const matchIndex = pending.findIndex((m) => m.id === matchId);
    if (field === "home") {
      // Move to away of same match
      const ref = inputRefs.current[`${matchId}-away`];
      ref?.focus();
      ref?.select();
    } else {
      // Move to home of next match
      const nextMatch = pending[matchIndex + 1];
      if (nextMatch) {
        const ref = inputRefs.current[`${nextMatch.id}-home`];
        ref?.focus();
        ref?.select();
      }
    }
  }

  function handleInput(matchId: number, field: "home" | "away", value: string) {
    // Only allow single digit 0-9
    const digit = value.replace(/\D/g, "").slice(-1);
    setLocalPreds((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: digit },
    }));

    if (digit !== "") {
      // Auto-save when both fields filled
      const current = localPreds[matchId] ?? { home: "", away: "" };
      const newHome = field === "home" ? digit : current.home;
      const newAway = field === "away" ? digit : current.away;

      if (newHome !== "" && newAway !== "") {
        setSaving(matchId);
        onSubmit(matchId, parseInt(newHome), parseInt(newAway)).finally(() => {
          setSaving(null);
        });
      }

      // Always advance focus after typing a digit
      focusNext(matchId, field);
    }
  }

  function handleKeyDown(e: KeyboardEvent, matchId: number, field: "home" | "away") {
    if (e.key === "Backspace") {
      const current = localPreds[matchId] ?? { home: "", away: "" };
      if (current[field] === "" && field === "away") {
        // Go back to home
        const ref = inputRefs.current[`${matchId}-home`];
        ref?.focus();
        ref?.select();
      }
    }
  }

  if (!user) return null;
  if (total === 0) return null;

  return (
    <div class="mb-8">
      {/* Collapsed banner */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          class="w-full glass-card p-4 flex items-center gap-4 hover:border-accent/40 transition-all duration-200 group text-left"
        >
          <div class="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
            <Zap class="w-4 h-4 text-gold" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-barlow font-bold text-white">
              Te faltan <span class="text-gold">{total}</span> predicciones
            </p>
            <p class="text-xs text-muted mt-0.5">Llenás todos tus pronósticos en un abrir y cerrar de ojos.</p>
          </div>
          <span class="btn-primary !py-2 !px-4 !text-xs shrink-0 flex items-center gap-1.5">
            Cargar ahora
            <span class="text-xs opacity-70">→</span>
          </span>
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div class="glass-card overflow-hidden glow-violet">
          {/* Header */}
          <div class="px-5 py-4 border-b border-accent-border/20 flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <Zap class="w-4 h-4 text-gold" />
            </div>
            <div class="flex-1">
              <p class="font-barlow font-bold text-white text-sm uppercase tracking-wide">Carga rápida</p>
              <p class="text-xs text-muted">Avanzá partido a partido sin tocar el mouse.</p>
            </div>
            {/* Progress */}
            <div class="flex items-center gap-3 shrink-0">
              <div class="hidden sm:block w-32 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  class="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${total > 0 ? (filled / total) * 100 : 0}%` }}
                />
              </div>
              <span class="font-barlow font-black text-sm text-gold tabular-nums">
                {filled} / {total}
              </span>
              <button
                onClick={() => setOpen(false)}
                class="text-muted hover:text-white transition p-1"
              >
                <ChevronUp class="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hint */}
          <div class="px-5 py-2 border-b border-accent-border/10 bg-accent-subtle/20">
            <p class="text-[11px] text-muted">
              ⌨️ Escribí un dígito por casilla y <strong class="text-white">avanza solo</strong>. Usá <kbd class="px-1 py-0.5 rounded bg-zinc-800 text-[10px]">←</kbd> para corregir.
            </p>
          </div>

          {/* Match list */}
          <div class="divide-y divide-accent-border/10">
            {pending.map((m) => {
              const local = localPreds[m.id] ?? { home: "", away: "" };
              const isSaving = saving === m.id;
              const isDone = local.home !== "" && local.away !== "";

              return (
                <div
                  key={m.id}
                  class={`flex items-center gap-3 px-5 py-3 transition-colors ${isDone ? "bg-accent/5" : "hover:bg-accent-subtle/20"}`}
                >
                  {/* Date */}
                  <div class="w-[80px] shrink-0">
                    <p class="text-[10px] font-semibold text-muted capitalize">{formatMatchDate(m.matchDate)}</p>
                    <p class="text-[10px] text-muted/40">{formatTime(m.matchDate)}</p>
                  </div>

                  {/* Home team */}
                  <div class="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span class="text-sm font-semibold text-white truncate text-right hidden sm:block">
                      {m.homeTeam.name}
                    </span>
                    <span class="text-xs font-bold text-muted sm:hidden">
                      {m.homeTeam.name.slice(0, 3).toUpperCase()}
                    </span>
                    {m.homeTeam.flag && (
                      <div class="w-7 aspect-[3/2] shrink-0">
                        <img src={m.homeTeam.flag} alt="" class="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  {/* Score inputs */}
                  <div class="flex items-center gap-1.5 shrink-0">
                    <input
                      ref={(el) => { inputRefs.current[`${m.id}-home`] = el; }}
                      type="number"
                      min="0"
                      max="9"
                      value={local.home}
                      placeholder="–"
                      onInput={(e) => handleInput(m.id, "home", (e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => handleKeyDown(e, m.id, "home")}
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      class="input-score !w-10 !text-center text-base"
                      disabled={isSaving}
                    />
                    <span class="text-muted/40 font-bold">:</span>
                    <input
                      ref={(el) => { inputRefs.current[`${m.id}-away`] = el; }}
                      type="number"
                      min="0"
                      max="9"
                      value={local.away}
                      placeholder="–"
                      onInput={(e) => handleInput(m.id, "away", (e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => handleKeyDown(e, m.id, "away")}
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      class="input-score !w-10 !text-center text-base"
                      disabled={isSaving}
                    />
                  </div>

                  {/* Away team */}
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    {m.awayTeam.flag && (
                      <div class="w-7 aspect-[3/2] shrink-0">
                        <img src={m.awayTeam.flag} alt="" class="w-full h-full object-cover" />
                      </div>
                    )}
                    <span class="text-sm font-semibold text-white truncate hidden sm:block">
                      {m.awayTeam.name}
                    </span>
                    <span class="text-xs font-bold text-muted sm:hidden">
                      {m.awayTeam.name.slice(0, 3).toUpperCase()}
                    </span>
                  </div>

                  {/* Status */}
                  <div class="w-20 shrink-0 text-right">
                    {isSaving ? (
                      <span class="text-[10px] text-muted animate-pulse">Guardando...</span>
                    ) : isDone ? (
                      <span class="text-[10px] text-accent font-bold flex items-center justify-end gap-1">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        Guardado
                      </span>
                    ) : (
                      <span class="text-[10px] text-muted/40 uppercase tracking-wide">
                        {STAGE_LABELS[m.stage] ?? m.stage}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
