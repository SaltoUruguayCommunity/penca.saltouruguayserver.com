import { useEffect, useState } from "preact/hooks";
import { actions } from "astro:actions";
import { RefreshCw, Trophy, Save, Calculator, CloudDownload, RotateCcw, Bug } from "lucide-preact";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Session } from "@auth/core/types";

type Match = {
  id: number;
  stage: string;
  status: string;
  matchDate: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { name: string; flag: string | null };
  awayTeam: { name: string; flag: string | null };
};

type Props = {
  session: Session | null;
};

export default function PencasAdmin({ session }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [fetching, setFetching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [resetting, setResetting] = useState<number | null>(null);
  const [calculating, setCalculating] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [diagnosis, setDiagnosis] = useState<{ groups: Record<string, { total: number; withGroupId: number }>; totalMatches: number; orphaned: number } | null>(null);

  async function loadMatches() {
    const res = await actions.pencas.getMatches({});
    if (res.data) setMatches(res.data as Match[]);
  }

  useEffect(() => {
    loadMatches();
  }, []);

  async function handleFetch() {
    setFetching(true);
    setMessage(null);
    const res = await actions.pencas.admin.fetchFromApi();
    setFetching(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      setMessage({ type: "success", text: "Datos importados correctamente" });
      await loadMatches();
    }
  }

  async function handleSyncScores() {
    setSyncing(true);
    setMessage(null);
    const res = await actions.pencas.admin.syncScores();
    setSyncing(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      const count = (res.data as { updated: number })?.updated ?? 0;
      setMessage({ type: "success", text: `Sincronización completa — ${count} partido${count !== 1 ? "s" : ""} actualizado${count !== 1 ? "s" : ""}` });
      await loadMatches();
    }
  }

  async function handleUpdateScore(matchId: number) {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const name = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    const scoreStr = `${match.homeScore ?? "?"} - ${match.awayScore ?? "?"}`;

    if (!window.confirm(`¿Guardar resultado para "${name}"?\n\n${scoreStr}\n\nEsto marcará el partido como finalizado y recalculará los puntos.`)) {
      return;
    }

    setSaving(matchId);
    setMessage(null);

    const res = await actions.pencas.admin.updateMatchScore({
      matchId,
      homeScore: match.homeScore ?? 0,
      awayScore: match.awayScore ?? 0,
    });
    setSaving(null);
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      setMessage({ type: "success", text: `"${name}" — resultado guardado` });
      await loadMatches();
    }
  }

  async function handleCalculate(matchId: number) {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    setCalculating(matchId);
    setMessage(null);
    const res = await actions.pencas.admin.calculatePoints({ matchId });
    setCalculating(null);
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      setMessage({ type: "success", text: `Puntos recalculados para "${match.homeTeam.name} vs ${match.awayTeam.name}"` });
    }
  }

  async function handleReset(matchId: number) {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    if (!window.confirm(`¿Resetear "${match.homeTeam.name} vs ${match.awayTeam.name}"?\n\nSe borrará el resultado y los puntos de todos los pronósticos.`)) return;

    setResetting(matchId);
    setMessage(null);
    const res = await actions.pencas.admin.resetMatchScore({ matchId });
    setResetting(null);
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      setMessage({ type: "success", text: `"${match.homeTeam.name} vs ${match.awayTeam.name}" — resultado eliminado` });
      await loadMatches();
    }
  }

  function updateScore(matchId: number, field: "homeScore" | "awayScore", value: number) {
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, [field]: value } : m)),
    );
  }

  return (
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div class="glass-card p-4 sm:p-6 mb-8 glow-violet">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-accent-subtle border border-accent-border flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                <Trophy class="h-5 w-5 text-accent" />
              </div>
              <div>
                <h1 class="font-barlow font-bold uppercase text-xl text-gradient">Admin Panel</h1>
                <p class="text-muted text-xs uppercase tracking-wider">Penca Mundial 2026</p>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                const res = await actions.pencas.admin.checkMatches();
                if (res.data) setDiagnosis(res.data as typeof diagnosis);
              }}
              class="btn-secondary !py-2.5 !px-3 !text-xs"
              title="Diagnóstico"
            >
              <Bug class="h-4 w-4" />
            </button>
            <button
              onClick={handleSyncScores}
              disabled={syncing}
              class="btn-secondary !py-2.5 !px-4 !text-xs"
            >
              <CloudDownload class={`h-4 w-4 ${syncing ? "animate-bounce" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar resultados"}
            </button>
            <button
              onClick={handleFetch}
              disabled={fetching}
              class="btn-primary !py-2.5 !px-4 !text-xs"
            >
              <RefreshCw class={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
              {fetching ? "Importando..." : "Importar datos"}
            </button>
          </div>
        </div>
      </div>

      {/* Message toast */}
      {message && (
        <div class={`mb-6 px-5 py-3 rounded-lg text-sm font-medium backdrop-blur-md ${message.type === "success"
          ? "bg-green-accent/10 border border-green-accent/20 text-green-accent shadow-[0_0_20px_rgba(34,197,94,0.1)]"
          : "bg-red-500/10 border border-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
          }`}>
          {message.text}
        </div>
      )}

      {/* Diagnosis */}
      {diagnosis && (
        <div class="glass-card p-4 mb-6 text-xs">
          <div class="flex items-center justify-between mb-3">
            <span class="font-barlow font-bold uppercase text-sm text-white">Diagnóstico</span>
            <button onClick={() => setDiagnosis(null)} class="text-muted hover:text-white transition">&times;</button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div class="bg-accent-subtle/30 rounded-lg p-3 text-center">
              <div class="font-barlow font-black text-lg text-white">{diagnosis.totalMatches}</div>
              <div class="text-muted uppercase tracking-wider text-[10px]">Total partidos</div>
            </div>
            <div class="bg-red-900/10 rounded-lg p-3 text-center">
              <div class="font-barlow font-black text-lg text-red-400">{diagnosis.orphaned}</div>
              <div class="text-muted uppercase tracking-wider text-[10px]">Sin grupo</div>
            </div>
          </div>
          {Object.entries(diagnosis.groups).map(([name, data]) => (
            <div class="flex items-center justify-between py-1.5 border-b border-accent-border/10 last:border-0">
              <span class="text-muted">{name}</span>
              <span class={data.total > 0 && data.withGroupId === data.total ? "text-green-accent" : "text-red-400"}>
                {data.withGroupId}/{data.total}
              </span>
            </div>
          ))}
          {diagnosis.orphaned > 0 && (
            <p class="text-red-400 text-[11px] mt-2">
              Hay partidos sin grupo. Re-importá los datos para corregirlo.
            </p>
          )}
        </div>
      )}

      {/* Admin info */}
      {session?.user && (
        <div class="glass-card p-4 mb-6 flex items-center gap-3 glow-violet">
          <img src={session.user.image ?? undefined} alt={session.user.name ?? "User avatar"} class="w-10 h-10 rounded-full object-cover" />
          <div>
            <p class="text-sm text-white font-semibold">{session.user.name}</p>
            <p class="text-[11px] text-muted uppercase tracking-wider">Administrador</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div class="glass-card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-accent-subtle/50 text-muted text-[11px] uppercase tracking-[0.12em]">
                <th class="px-5 py-4 text-left font-semibold">Fecha</th>
                <th class="px-5 py-4 text-left font-semibold">Local</th>
                <th class="px-5 py-4 text-center font-semibold">Score</th>
                <th class="px-5 py-4 text-left font-semibold">Visitante</th>
                <th class="px-5 py-4 text-center font-semibold">Estado</th>
                <th class="px-5 py-4 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-accent-border/10">
              {matches.length === 0 ? (
                <tr>
                  <td colspan="6" class="text-center py-12 text-muted text-sm">
                    No hay partidos. Importá desde la API primero.
                  </td>
                </tr>
              ) : (
                matches.map((match) => (
                  <tr key={match.id} class="hover:bg-accent-subtle/10 transition">
                    <td class="px-5 py-4 text-muted whitespace-nowrap text-xs">
                      {format(new Date(match.matchDate), "d MMM", { locale: es })}
                    </td>
                    <td class="px-5 py-4 text-white font-medium">{match.homeTeam.name}</td>
                    <td class="px-5 py-4 text-center">
                      <div class="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={match.homeScore ?? ""}
                          onInput={(e) =>
                            updateScore(match.id, "homeScore", parseInt((e.target as HTMLInputElement).value) || 0)
                          }
                          class="input-score !w-10 !h-9 !text-sm"
                        />
                        <span class="text-accent/40 font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          value={match.awayScore ?? ""}
                          onInput={(e) =>
                            updateScore(match.id, "awayScore", parseInt((e.target as HTMLInputElement).value) || 0)
                          }
                          class="input-score !w-10 !h-9 !text-sm"
                        />
                      </div>
                    </td>
                    <td class="px-5 py-4 text-white font-medium">{match.awayTeam.name}</td>
                    <td class="px-5 py-4 text-center">
                      <span class={`badge-pill ${match.status === "finished"
                        ? "!bg-green-accent/15 !text-green-accent"
                        : match.status === "live"
                          ? "!bg-gold/15 !text-gold"
                          : "!bg-accent/10 !text-accent-light"
                        }`}>
                        {match.status === "finished" ? "Finalizado" : match.status === "live" ? "En vivo" : "Programado"}
                      </span>
                    </td>
                    <td class="px-5 py-4 text-center">
                      <div class="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleUpdateScore(match.id)}
                          disabled={saving === match.id}
                          class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-accent/10 hover:bg-accent/20 text-accent-light px-3 py-1.5 rounded-md transition disabled:opacity-50"
                        >
                          <Save class="h-3 w-3" />
                          {saving === match.id ? "..." : "Guardar"}
                        </button>
                        <button
                          onClick={() => handleCalculate(match.id)}
                          disabled={calculating === match.id}
                          class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-muted px-3 py-1.5 rounded-md transition disabled:opacity-50"
                        >
                          <Calculator class="h-3 w-3" />
                          {calculating === match.id ? "..." : "Puntos"}
                        </button>
                        {match.status === "finished" && (
                          <button
                            onClick={() => handleReset(match.id)}
                            disabled={resetting === match.id}
                            class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-red-900/20 hover:bg-red-900/30 text-red-400 px-3 py-1.5 rounded-md transition disabled:opacity-50"
                          >
                            <RotateCcw class="h-3 w-3" />
                            {resetting === match.id ? "..." : "Reset"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
