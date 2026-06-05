import { useEffect, useState } from "preact/hooks";
import { toast } from "../../lib/toast";
import { actions } from "astro:actions";
import type { Session } from "@auth/core/types";
import { Trophy, Users, BarChart3 } from "lucide-preact";
import confetti from "canvas-confetti";

type Match = {
  id: number;
  matchDate: string;
  stage: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: number; name: string; flag: string | null };
  awayTeam: { id: number; name: string; flag: string | null };
  group: { id: number; name: string } | null;
};

type Prediction = {
  userId: number;
  username: string;
  avatar: string | null;
  homeScore: number;
  awayScore: number;
  points: number | null;
};

type Props = {
  match: Match;
  predictions: Prediction[];
  userPrediction: Prediction | null;
  userStreak?: number;
  session: Session | null;
};

export default function MatchDetailView({ match, predictions: initialPredictions, userPrediction, userStreak = 0, session }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>(initialPredictions);
  const [myPrediction, setMyPrediction] = useState<Prediction | null>(userPrediction);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => new Date(match.matchDate).getTime() - Date.now());

  const matchDate = new Date(match.matchDate);
  const now = new Date();
  const isFinished = match.status === "finished";
  const isLive = !isFinished && matchDate <= now;
  const isPast = isFinished || isLive;
  const canPredict = !isPast && !!session?.user;

  useEffect(() => {
    if (isPast) return;
    const id = setInterval(() => {
      const diff = new Date(match.matchDate).getTime() - Date.now();
      setTimeLeft(diff);
      if (diff <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [match.matchDate, isPast]);

  function formatTime(ms: number) {
    const total = Math.max(0, ms);
    const days = Math.floor(total / 86400000);
    const h = Math.floor((total % 86400000) / 3600000);
    const m = Math.floor((total % 3600000) / 60000);
    const s = Math.floor((total % 60000) / 1000);
    if (days > 1) return `${days} días`;
    if (days === 1) return `1 día`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const homeScore = parseInt(formData.get("homeScore") as string);
    const awayScore = parseInt(formData.get("awayScore") as string);
    if (isNaN(homeScore) || isNaN(awayScore)) return;

    const prevPrediction = myPrediction;

    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.5 },
      colors: ["#8B5CF6", "#FACC15", "#22C55E", "#FFFFFF"],
    });

    setMyPrediction({ userId: Number(session!.user!.id), username: session!.user!.username ?? session!.user!.name ?? "", avatar: session!.user!.image ?? null, homeScore, awayScore, points: null });
    setSubmitting(true);
    const res = await actions.pencas.submitPrediction({ matchId: match.id, homeScore, awayScore });
    setSubmitting(false);

    const reload = await actions.pencas.getMatchDetail({ matchId: match.id });
    if (reload.data) {
      setPredictions(reload.data.predictions as Prediction[]);
      const userId = session?.user?.id;
      if (userId) {
        const updated = reload.data.predictions.find((p: Prediction) => p.userId === Number(userId)) ?? null;
        setMyPrediction(updated);
      }
    }

    if (res.error) {
      toast.error(res.error.message || "Error al guardar pronóstico");
    } else {
      toast.success("Pronóstico guardado");
    }
  }

  const totalPredictions = predictions.length;
  const homeWins = predictions.filter((p) => p.homeScore > p.awayScore).length;
  const awayWins = predictions.filter((p) => p.homeScore < p.awayScore).length;
  const draws = predictions.filter((p) => p.homeScore === p.awayScore).length;
  const mostCommon = [
    ...Object.entries(
      predictions.reduce<Record<string, number>>((acc, p) => {
        const key = `${p.homeScore}-${p.awayScore}`;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    ),
  ].sort((a, b) => b[1] - a[1]);
  const topPrediction = mostCommon[0];

  return (
    <div class="space-y-6">
      {/* Countdown banner */}
      {!isPast && (
        <div class={`glass-card p-4 flex items-center gap-3 ${!session?.user ? "border-accent-border/30" : ""}`}>
          <span class={`text-lg ${timeLeft > 60000 ? "" : "animate-pulse"}`}>⏱</span>
          <div class="flex-1">
            <p class={`text-sm font-semibold ${session?.user ? "text-accent-light" : "text-muted"}`}>
              {session?.user
                ? `Te quedan ${formatTime(timeLeft)} para pronosticar`
                : `Quedan ${formatTime(timeLeft)} — Iniciá sesión para pronosticar`}
            </p>
          </div>
          {session?.user && (
            <span class="text-xs font-barlow font-bold uppercase tracking-wider text-accent-light/60">
              {timeLeft > 3600000 ? "Disponible" : timeLeft > 60000 ? "Minutos" : "Segundos"}
            </span>
          )}
        </div>
      )}
      {isLive && (
        <div class="glass-card p-4 flex items-center gap-3 border-green-accent/20 glow-green">
          <span class="w-2 h-2 rounded-full bg-green-accent animate-pulse" />
          <p class="text-sm font-semibold text-green-accent">Partido en juego</p>
        </div>
      )}
      {isFinished && (
        <div class="glass-card p-4 flex items-center gap-3">
          <span class="text-lg">⚫</span>
          <p class="text-sm font-semibold text-muted">Partido finalizado</p>
        </div>
      )}

      {canPredict && (
        <div class="glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-barlow font-bold uppercase text-sm text-white">Tu pronóstico</h3>
            {userStreak > 0 && (
              <span class="inline-flex items-center gap-1 text-xs text-gold font-semibold">
                <span>🔥</span> Racha de {userStreak}
              </span>
            )}
          </div>
          <form onSubmit={handleSubmit} class="flex items-center gap-3">
            <input
              type="number"
              name="homeScore"
              min="0"
              max="50"
              defaultValue={myPrediction ? myPrediction.homeScore : ""}
              disabled={submitting}
              placeholder="0"
              required
              class="input-score !w-16 !text-center !text-lg"
            />
            <span class="text-accent/40 font-bold text-xl">-</span>
            <input
              type="number"
              name="awayScore"
              min="0"
              max="50"
              defaultValue={myPrediction ? myPrediction.awayScore : ""}
              disabled={submitting}
              placeholder="0"
              required
              class="input-score !w-16 !text-center !text-lg"
            />
            <button type="submit" disabled={submitting} class="btn-primary !py-2.5 !px-5">
              {submitting ? "..." : myPrediction ? "Editar" : "Pronosticar"}
            </button>
          </form>
          {myPrediction && !isFinished && (
            <div class="mt-3 flex items-center gap-2 text-xs text-muted uppercase tracking-wider font-semibold">
              <span>Tu pronóstico actual:</span>
              <span class="text-accent-light font-barlow font-bold">
                {myPrediction.homeScore} - {myPrediction.awayScore}
              </span>
            </div>
          )}
        </div>
      )}

      {!session?.user && !isPast && (
        <div class="glass-card p-6 text-center">
          <p class="text-muted text-sm">
            Iniciá sesión para pronosticar este partido.
          </p>
        </div>
      )}

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="glass-card p-5 text-center hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all duration-300">
          <Users class="h-5 w-5 mx-auto mb-2 text-accent" />
          <div class="font-barlow font-black text-2xl text-white">{totalPredictions}</div>
          <div class="text-[11px] text-muted uppercase tracking-wider font-semibold mt-1">Pronosticos</div>
        </div>
        {isFinished && match.homeScore !== null && match.awayScore !== null && (
          <>
            <div class="glass-card p-5 text-center hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all duration-300">
              <BarChart3 class="h-5 w-5 mx-auto mb-2 text-accent" />
              <div class="font-barlow font-black text-2xl text-white">
                {totalPredictions > 0
                  ? Math.round(
                    (predictions.filter(
                      (p) => p.homeScore === match.homeScore && p.awayScore === match.awayScore,
                    ).length /
                      totalPredictions) *
                    100,
                  )
                  : 0}
                %
              </div>
              <div class="text-[11px] text-muted uppercase tracking-wider font-semibold mt-1">Acertaron exacto</div>
            </div>
            <div class="glass-card p-5 text-center hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all duration-300">
              <Trophy class="h-5 w-5 mx-auto mb-2 text-accent" />
              <div class="font-barlow font-black text-2xl text-white">
                {totalPredictions > 0
                  ? Math.round(
                    (predictions.filter((p) => {
                      const pHome = p.homeScore;
                      const pAway = p.awayScore;
                      const pHomeDiff = pHome > pAway ? 1 : pHome < pAway ? -1 : 0;
                      const realHomeDiff = match.homeScore! > match.awayScore! ? 1 : match.homeScore! < match.awayScore! ? -1 : 0;
                      return pHomeDiff === realHomeDiff;
                    }).length /
                      totalPredictions) *
                    100,
                  )
                  : 0}
                %
              </div>
              <div class="text-[11px] text-muted uppercase tracking-wider font-semibold mt-1">Acertaron ganador</div>
            </div>
          </>
        )}
        {!isFinished && topPrediction && (
          <div class="glass-card p-5 text-center sm:col-span-2 glow-gold">
            <div class="font-barlow font-black text-2xl text-white">{topPrediction[0]}</div>
            <div class="text-[11px] text-muted uppercase tracking-wider font-semibold mt-1">
              Resultado mas pronosticado ({topPrediction[1]} votos)
            </div>
          </div>
        )}
      </div>

      <div class="glass-card overflow-hidden">
        <div class="px-5 py-4 border-b border-accent-border/20">
          <h3 class="font-barlow font-bold uppercase text-sm text-white">
            Todos los pronosticos ({totalPredictions})
          </h3>
        </div>

        {predictions.length === 0 ? (
          <div class="p-8 text-center">
            <p class="text-muted text-sm">Sin pronosticos todavia.</p>
            <p class="text-muted/50 text-xs mt-1">Se el primero en pronosticar.</p>
          </div>
        ) : (
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-accent-subtle/50 text-muted text-[11px] uppercase tracking-[0.12em]">
                  <th class="px-5 py-3 text-left font-semibold">Usuario</th>
                  <th class="px-5 py-3 text-center font-semibold">Pronostico</th>
                  <th class="px-5 py-3 text-right font-semibold">Puntos</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-accent-border/10">
                {predictions
                  .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
                  .map((p) => {
                    const isMe = session?.user && p.userId === Number(session.user.id);
                    const exactMatch = isFinished && match.homeScore === p.homeScore && match.awayScore === p.awayScore;
                    const correctWinner = isFinished && !exactMatch && match.homeScore !== null && match.awayScore !== null && (
                      (match.homeScore > match.awayScore && p.homeScore > p.awayScore) ||
                      (match.homeScore < match.awayScore && p.homeScore < p.awayScore) ||
                      (match.homeScore === match.awayScore && p.homeScore === p.awayScore)
                    );

                    return (
                      <tr key={p.userId} class={`transition ${isMe ? "bg-accent-subtle/30" : "hover:bg-accent-subtle/10"}`} style={isMe ? {boxShadow: 'inset 0 0 20px rgba(139,92,246,0.05)'} : {}}>
                        <td class="px-5 py-3">
                          <div class="flex items-center gap-2.5">
                            {p.avatar ? (
                              <img src={p.avatar} alt="" class="h-7 w-7 rounded-full object-cover ring-2 ring-accent/20" />
                            ) : (
                              <div class="h-7 w-7 rounded-full bg-accent-subtle border border-accent-border flex items-center justify-center text-[10px] text-accent">
                                U
                              </div>
                            )}
                            <div class="flex items-center gap-1.5">
                              <span class={`font-semibold ${isMe ? "text-accent-light" : "text-white"}`}>
                                {isMe ? "Vos" : p.username}
                              </span>
                              {exactMatch && (
                                <span class="text-[10px]" title="Exacto">🎯</span>
                              )}
                              {correctWinner && (
                                <span class="text-[10px]" title="Ganador">✅</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td class="px-5 py-3 text-center">
                          <span class={`font-barlow font-bold text-base tabular-nums ${exactMatch ? "text-green-accent" : correctWinner ? "text-accent-light" : "text-white"}`}>
                            {p.homeScore} - {p.awayScore}
                          </span>
                        </td>
                        <td class="px-5 py-3 text-right">
                          <span class={`font-barlow font-bold text-base tabular-nums ${p.points && p.points > 0 ? "text-green-accent" : p.points === 0 ? "text-zinc-500" : "text-muted"
                            }`}>
                            {p.points != null ? `${p.points} pts` : "-"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
