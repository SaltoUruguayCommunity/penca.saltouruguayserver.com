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

type Prediction = {
  matchId: number;
  homeScore: number;
  awayScore: number;
} | null;

type Props = {
  match: Match;
  prediction: Prediction;
  session: Session | null;
  onSubmit: (matchId: number, homeScore: number, awayScore: number) => void;
  submitting: boolean;
};

const STAGE_LABELS: Record<string, string> = {
  group: "Fase de Grupos",
  round_of_16: "Octavos",
  quarter_final: "Cuartos",
  semi_final: "Semifinal",
  third_place: "Tercer Puesto",
  final: "Final",
};

export default function MatchCard({ match, prediction, session, onSubmit, submitting }: Props) {
  const matchDate = new Date(match.matchDate);
  const now = new Date();
  const isFinished = match.status === "finished";
  const isLive = !isFinished && matchDate <= now;
  const isPast = isFinished || isLive;
  const hasPrediction = prediction !== null;

  function handleSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const homeScore = parseInt(formData.get("homeScore") as string);
    const awayScore = parseInt(formData.get("awayScore") as string);
    if (isNaN(homeScore) || isNaN(awayScore)) return;
    onSubmit(match.id, homeScore, awayScore);
  }

  return (
    <div class="glass-card !bg-accent-subtle/30 p-4">
      {/* Top row: date + stage + status */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <span data-time={match.matchDate} class="text-[11px] text-muted font-semibold uppercase tracking-wider"></span>
          <span class="text-[11px] text-muted/50 font-semibold uppercase tracking-wider">
            {STAGE_LABELS[match.stage] ?? match.stage}
          </span>
        </div>
        <span
          class={`badge-pill ${
            isLive
              ? "!bg-green-accent/15 !text-green-accent"
              : isFinished
                ? "!bg-zinc-800 !text-zinc-400"
                : "!bg-accent/10 !text-accent-light"
          }`}
        >
          {isLive ? "EN VIVO" : isFinished ? "Finalizado" : "Programado"}
        </span>
      </div>

      {/* Teams + Score + Prediction */}
      <div class="flex items-center justify-between gap-4">
        {/* Home team */}
        <div class="flex items-center gap-2.5 flex-1 min-w-0">
          {match.homeTeam.flag ? (
            <img src={match.homeTeam.flag} alt="" class="h-7 w-7 object-contain shrink-0" />
          ) : (
            <div class="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center text-sm shrink-0">
              ⚽
            </div>
          )}
          <span class="text-sm font-semibold text-white truncate">
            {match.homeTeam.name}
          </span>
        </div>

        {/* Score / Prediction inputs */}
        <div class="flex items-center gap-2 shrink-0">
          {isFinished ? (
            <div class="flex items-center gap-2.5">
              <span class="font-barlow font-black text-xl text-white tabular-nums w-8 text-center">
                {match.homeScore ?? "-"}
              </span>
              <span class="text-accent/50 font-bold">-</span>
              <span class="font-barlow font-black text-xl text-white tabular-nums w-8 text-center">
                {match.awayScore ?? "-"}
              </span>
            </div>
          ) : isLive ? (
            <div class="flex items-center gap-2.5">
              <span class="font-barlow font-black text-xl text-white tabular-nums w-8 text-center">
                {match.homeScore ?? "-"}
              </span>
              <span class="text-accent/50 font-bold">-</span>
              <span class="font-barlow font-black text-xl text-white tabular-nums w-8 text-center">
                {match.awayScore ?? "-"}
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} class="flex items-center gap-2">
              <input
                type="number"
                name="homeScore"
                min="0"
                max="50"
                defaultValue={hasPrediction ? prediction.homeScore : ""}
                disabled={!session?.user || submitting}
                placeholder="-"
                required
                class="input-score"
              />
              <span class="text-accent/40 font-bold text-lg">-</span>
              <input
                type="number"
                name="awayScore"
                min="0"
                max="50"
                defaultValue={hasPrediction ? prediction.awayScore : ""}
                disabled={!session?.user || submitting}
                placeholder="-"
                required
                class="input-score"
              />
              {session?.user && (
                <button
                  type="submit"
                  disabled={submitting}
                  class="btn-primary !py-2 !px-3 !text-[11px] ml-1"
                >
                  {submitting ? "..." : hasPrediction ? "Editar" : "Ok"}
                </button>
              )}
            </form>
          )}
        </div>

        {/* Away team */}
        <div class="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
          <span class="text-sm font-semibold text-white truncate">
            {match.awayTeam.name}
          </span>
          {match.awayTeam.flag ? (
            <img src={match.awayTeam.flag} alt="" class="h-7 w-7 object-contain shrink-0" />
          ) : (
            <div class="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center text-sm shrink-0">
              ⚽
            </div>
          )}
        </div>
      </div>

      {/* Prediction result (after match finished) */}
      {hasPrediction && isFinished && (
        <div class="mt-3 pt-3 border-t border-accent-border/20 flex items-center justify-center gap-2">
          <span class="text-[11px] text-muted uppercase tracking-wider font-semibold">Tu pronóstico:</span>
          <span class="font-barlow font-bold text-sm text-white tabular-nums">
            {prediction.homeScore} - {prediction.awayScore}
          </span>
          <span
            class={`badge-pill ${
              prediction.points && prediction.points > 0
                ? "!bg-green-accent/15 !text-green-accent"
                : "!bg-zinc-800 !text-zinc-500"
            }`}
          >
            {prediction.points != null
              ? `${prediction.points} pts`
              : "Pendiente"}
          </span>
        </div>
      )}

      {/* Prediction show for non-finished (edit mode) */}
      {hasPrediction && !isFinished && (
        <div class="mt-3 pt-3 border-t border-accent-border/20 flex items-center justify-center gap-2">
          <span class="text-[11px] text-muted uppercase tracking-wider font-semibold">Tu pronóstico:</span>
          <span class="font-barlow font-bold text-sm text-accent-light tabular-nums">
            {prediction.homeScore} - {prediction.awayScore}
          </span>
        </div>
      )}

      <div class="mt-3 pt-2 border-t border-accent-border/10 text-center">
        <a
          href={`/matches/${match.id}`}
          class="inline-flex items-center gap-1 text-[11px] text-muted hover:text-accent transition font-semibold uppercase tracking-wider"
        >
          Ver detalle →
        </a>
      </div>
    </div>
  );
}
