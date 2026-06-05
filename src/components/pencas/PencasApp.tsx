import { useEffect, useState } from "preact/hooks";
import { toast } from "../../lib/toast";
import type { Session } from "@auth/core/types";
import { actions } from "astro:actions";
import GroupsView from "./GroupsView";
import Leaderboard from "./Leaderboard";
import LoginButton from "./LoginButton";
import LiveMatches from "./LiveMatches";

type Group = {
  id: number;
  name: string;
  teams: Array<{ id: number; name: string; flag: string | null; fifaCode: string | null }>;
  matches: Array<{
    id: number;
    matchDate: string;
    stage: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: { id: number; name: string; flag: string | null };
    awayTeam: { id: number; name: string; flag: string | null };
  }>;
};

type PredictionMap = Record<number, { homeScore: number; awayScore: number; points?: number | null }>;

type LeaderboardEntry = {
  position: number;
  userId: number;
  username: string;
  avatar: string | null;
  totalPoints: number;
};

type Props = {
  session: Session | null;
};

export default function PencasApp({ session }: Props) {
  const [tab, setTab] = useState<"groups" | "leaderboard">("groups");
  const [groups, setGroups] = useState<Group[]>([]);
  const [predictions, setPredictions] = useState<PredictionMap>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      actions.pencas.getGroups(),
      actions.pencas.getLeaderboard(),
    ]).then(([groupsRes, lbRes]) => {
      if (groupsRes.data) setGroups(groupsRes.data as Group[]);
      if (lbRes.data) setLeaderboard(lbRes.data as LeaderboardEntry[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (session?.user) {
      actions.pencas.getPredictions({}).then((res) => {
        if (res.data) {
          const map: PredictionMap = {};
          for (const p of res.data as Array<{ matchId: number; homeScore: number; awayScore: number; points?: number | null }>) {
            map[p.matchId] = { homeScore: p.homeScore, awayScore: p.awayScore, points: p.points };
          }
          setPredictions(map);
        }
      });
    }
  }, [session]);

  async function handleSubmit(matchId: number, homeScore: number, awayScore: number) {
    const { default: confetti } = await import("canvas-confetti");
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#8B5CF6", "#FACC15", "#22C55E", "#FFFFFF"],
    });

    setPredictions((prev) => ({
      ...prev,
      [matchId]: { homeScore, awayScore },
    }));

    setSubmitting(true);
    const res = await actions.pencas.submitPrediction({ matchId, homeScore, awayScore });
    setSubmitting(false);

    const reload = await actions.pencas.getPredictions({});
    if (reload.data) {
      const map: PredictionMap = {};
      for (const p of reload.data as Array<{ matchId: number; homeScore: number; awayScore: number; points?: number | null }>) {
        map[p.matchId] = { homeScore: p.homeScore, awayScore: p.awayScore, points: p.points };
      }
      setPredictions(map);
    }

    if (res.error) {
      toast.error(res.error.message);
    } else {
      toast.success("Pronostico guardado");
    }
  }

  return (
    <div>
      {/* App header */}
      <div class="glass-card p-4 sm:p-6 mb-6">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 class="font-barlow font-bold uppercase text-xl text-white">
              Panel de pronósticos
            </h3>
            <p class="text-muted text-sm mt-1">
              {session?.user
                ? `Bienvenido, ${session.user.username ?? session.user.name}`
                : "Iniciá sesión para pronosticar"}
            </p>
          </div>
          <div class="flex items-center gap-2">
            {session?.user?.is_admin && (
              <a href="/admin/pencas" class="text-xs font-barlow font-bold uppercase tracking-wider text-accent hover:text-accent-light transition px-3 py-2 rounded-md border border-accent-border/30 hover:border-accent/50">
                Admin
              </a>
            )}
            <LoginButton session={session} />
          </div>
        </div>
      </div>

      <LiveMatches />

      {/* Tabs */}
      <div class="flex gap-1 mb-6 border-b border-accent-border/20">
        <button
          onClick={() => setTab("groups")}
          class={`px-5 py-3 text-sm font-barlow font-bold uppercase tracking-wider transition border-b-2 -mb-[1px] ${
            tab === "groups"
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-white"
          }`}
        >
          Grupos
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          class={`px-5 py-3 text-sm font-barlow font-bold uppercase tracking-wider transition border-b-2 -mb-[1px] ${
            tab === "leaderboard"
              ? "text-accent border-accent"
              : "text-muted border-transparent hover:text-white"
          }`}
        >
          Tabla de posiciones
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div class="glass-card p-12 text-center">
          <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p class="text-muted text-sm">Cargando datos del mundial...</p>
        </div>
      ) : tab === "groups" ? (
        <GroupsView
          groups={groups}
          predictions={predictions}
          session={session}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      ) : (
        <Leaderboard entries={leaderboard} session={session} />
      )}
    </div>
  );
}
