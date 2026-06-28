import { useEffect, useState } from "preact/hooks";
import { toast } from "../../lib/toast";
import type { Session } from "@auth/core/types";
import { actions } from "astro:actions";
import GroupsView from "./GroupsView";
import KnockoutView from "./KnockoutView";
import Leaderboard from "./Leaderboard";
import LoginButton from "./LoginButton";
import RecentMatches from "./RecentMatches";
import QuickPredict from "./QuickPredict";
import TodayMatches from "./TodayMatches";

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
  streak: number;
  totalPoints: number;
};

type Props = {
  user: Session['user'] | null;
};

type Tab = "groups" | "knockout" | "leaderboard";

function getDefaultTab(groups: Group[]): Tab {
  const allGroupMatches = groups.flatMap((g) => g.matches);
  if (allGroupMatches.length === 0) return "groups";
  const hasUnfinished = allGroupMatches.some((m) => m.status !== "finished");
  return hasUnfinished ? "groups" : "knockout";
}

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

export default function PencasApp({ user }: Props) {
  const [tab, setTab] = useState<Tab>("groups");
  const [groups, setGroups] = useState<Group[]>([]);
  const [knockoutMatches, setKnockoutMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<PredictionMap>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      actions.pencas.getGroups(),
      actions.pencas.getLeaderboard(),
      actions.pencas.getMatches({}),
    ]).then(([groupsRes, lbRes, matchesRes]) => {
      const g = (groupsRes.data ?? []) as Group[];
      setGroups(g);
      if (lbRes.data) setLeaderboard(lbRes.data as LeaderboardEntry[]);

      // Extract knockout matches (groupId is null)
      const allMatches = (matchesRes.data ?? []) as Match[];
      setKnockoutMatches(allMatches.filter((m) => !groups.some((g) => g.matches.some((gm) => gm.id === m.id))));

      setTab(getDefaultTab(g));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user) {
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
  }, [user]);

  async function handleSubmit(matchId: number, homeScore: number, awayScore: number) {
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
      <div class="glass-card p-4 sm:p-6 mb-6 glow-violet">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 class="font-barlow font-bold uppercase text-xl text-gradient">
              Panel de pronósticos
            </h3>
            <p class="text-muted text-base mt-1">
              {user
                ? `Bienvenido, ${user.username ?? user.name}`
                : "Iniciá sesión para pronosticar"}
            </p>
            {user && leaderboard.length > 0 && (() => {
              const me = leaderboard.find(e => e.userId === Number(user.id));
              return me && me.streak > 0 ? (
                <div class="mt-2 flex items-center gap-1.5 text-xs text-gold font-semibold">
                  <span>🔥 Racha de {me.streak} acierto{me.streak !== 1 ? "s" : ""}</span>
                </div>
              ) : null;
            })()}
          </div>
          <div class="flex items-center gap-2">
            {user?.is_admin && (
              <a href="/admin/pencas" class="text-xs font-barlow font-bold uppercase tracking-wider text-accent hover:text-accent-light transition px-3 py-2 rounded-md border border-accent-border/30 hover:border-accent/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.15)]">
                Admin
              </a>
            )}
            <LoginButton user={user} />
          </div>
        </div>
      </div>

      <TodayMatches groups={groups} knockoutMatches={knockoutMatches} />
      <RecentMatches />

      <QuickPredict
        user={user}
        groups={groups}
        knockoutMatches={knockoutMatches}
        predictions={predictions}
        onSubmit={async (matchId, home, away) => {
          await handleSubmit(matchId, home, away);
        }}
      />

      {/* Tabs */}
      <div class="flex gap-1 mb-6 border-b border-accent-border/20">
        <button
          onClick={() => setTab("groups")}
          class={`relative px-5 py-3 text-lg font-barlow font-bold uppercase tracking-wider transition -mb-[1px] ${tab === "groups"
            ? "text-accent"
            : "text-muted hover:text-white"
            }`}
        >
          Grupos
          <span class={`absolute bottom-0 left-0 h-0.5 bg-accent transition-all duration-300 ${tab === "groups" ? "w-full" : "w-0"}`}></span>
        </button>
        <button
          onClick={() => setTab("knockout")}
          class={`relative px-5 py-3 text-lg font-barlow font-bold uppercase tracking-wider transition -mb-[1px] ${tab === "knockout"
            ? "text-accent"
            : "text-muted hover:text-white"
            }`}
        >
          Eliminatorias
          <span class={`absolute bottom-0 left-0 h-0.5 bg-accent transition-all duration-300 ${tab === "knockout" ? "w-full" : "w-0"}`}></span>
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          class={`relative px-5 py-3 text-lg font-barlow font-bold uppercase tracking-wider transition -mb-[1px] ${tab === "leaderboard"
            ? "text-accent"
            : "text-muted hover:text-white"
            }`}
        >
          Tabla de posiciones
          <span class={`absolute bottom-0 left-0 h-0.5 bg-accent transition-all duration-300 ${tab === "leaderboard" ? "w-full" : "w-0"}`}></span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div class="glass-card p-12 text-center glow-violet">
          <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p class="text-muted text-sm">Cargando datos del mundial...</p>
        </div>
      ) : tab === "groups" ? (
        <GroupsView
          groups={groups}
          predictions={predictions}
          user={user}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      ) : tab === "knockout" ? (
        <KnockoutView
          predictions={predictions}
          user={user}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      ) : (
        <Leaderboard entries={leaderboard} user={user} />
      )}
    </div>
  );
}