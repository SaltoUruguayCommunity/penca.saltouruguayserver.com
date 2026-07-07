import { useEffect, useState } from "preact/hooks";
import { actions } from "astro:actions";
import { RefreshCw, Trophy, Save, Calculator, CloudDownload, RotateCcw, Bug, Link, Wand2, Upload } from "lucide-preact";
import { format, parseISO } from "date-fns";
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
  fifaMatchId?: string | null;
};

type Props = {
  user: Session['user'] | null;
};

type CsvPreview = {
  parsed: number;
  toInsert: number;
  skipped: number;
  omitted: number;
  updated: number;
  errors: { line: number; reason: string }[];
  previewInsert: { username: string; home: string; away: string; predHome: number; predAway: number }[];
  previewSkip: { username: string; home: string; away: string }[];
  previewError: { line: number; reason: string }[];
  dryRun: boolean;
};

export default function PencasAdmin({ user }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [resetting, setResetting] = useState<number | null>(null);
  const [calculating, setCalculating] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [diagnosis, setDiagnosis] = useState<{ groups: Record<string, { total: number; withGroupId: number }>; totalMatches: number; orphaned: number } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [reimporting, setReimporting] = useState(false);
  const [editingFifaId, setEditingFifaId] = useState<number | null>(null);
  const [fifaIdValue, setFifaIdValue] = useState<string>("");
  const [syncingFifaIds, setSyncingFifaIds] = useState(false);
  const [searchingMatchId, setSearchingMatchId] = useState<number | null>(null);
  const [fifaSearchResults, setFifaSearchResults] = useState<Array<{
    idMatch: string;
    date: string;
    homeAbbr: string;
    homeName: string;
    awayAbbr: string;
    awayName: string;
    stage: string;
  }> | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [csvOverwrite, setCsvOverwrite] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  async function loadMatches() {
    setLoadingMatches(true);
    const res = await actions.pencas.getMatches({});
    if (res.data) setMatches(res.data as Match[]);
    setLoadingMatches(false);
  }

  async function loadSyncMetadata() {
    const res = await actions.pencas.admin.getSyncMetadata();
    if (res.data) {
      setLastSyncedAt((res.data as { lastSyncedAt: string | null }).lastSyncedAt);
    }
  }

  useEffect(() => {
    loadMatches();
    loadSyncMetadata();
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
      const data = res.data as { updated: number; imported: number; stage: string | null };
      let text = `Sincronización completa — ${data.updated} partido${data.updated !== 1 ? "s" : ""} actualizado${data.updated !== 1 ? "s" : ""}`;
      if (data.imported > 0) {
        text += ` — ${data.imported} partido${data.imported !== 1 ? "s" : ""} de ${data.stage ?? "siguiente fase"} importado${data.imported !== 1 ? "s" : ""}`;
      }
      setMessage({ type: "success", text });
      await loadMatches();
      await loadSyncMetadata();
    }
  }

  async function handleReimportKnockout() {
    if (!window.confirm("¿Re-importar partidos de eliminatorias?\n\nSe agregarán los partidos que falten sin borrar existentes ni predicciones.")) return;

    setReimporting(true);
    setMessage(null);
    const res = await actions.pencas.admin.reimportKnockout();
    setReimporting(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      const data = res.data as { existing: number; imported: number; stages: string[] };
      const stageLabels: Record<string, string> = {
        last_32: "Treintaydosavos",
        last_16: "Dieciseisavos",
        round_of_16: "Dieciseisavos",
        quarter_final: "Cuartos",
        semi_final: "Semifinal",
        third_place: "Tercer Puesto",
        final: "Final",
      };
      const stageNames = data.stages.map((s) => stageLabels[s] ?? s).join(", ");
      setMessage({
        type: "success",
        text: `Eliminatorias: ${data.existing} existentes, ${data.imported} nuevos${stageNames ? ` (${stageNames})` : ""}`,
      });
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

  async function handleSaveFifaId(matchId: number) {
    setEditingFifaId(matchId);
    setMessage(null);
    const res = await actions.pencas.admin.setFifaMatchId({
      matchId,
      fifaMatchId: fifaIdValue.trim() || null,
    });
    setEditingFifaId(null);
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      setMessage({ type: "success", text: "FIFA Match ID actualizado" });
      await loadMatches();
    }
  }

  async function handleSyncFifaIds() {
    setSyncingFifaIds(true);
    setMessage(null);
    const res = await actions.pencas.admin.syncFifaMatchIds();
    setSyncingFifaIds(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      const data = res.data as { totalChecked: number; matched: number };
      setMessage({
        type: "success",
        text: `FIFA IDs sincronizados: ${data.matched} de ${data.totalChecked} partidos sin ID encontrados`,
      });
      await loadMatches();
    }
  }

  async function handleSearchFifa(matchId: number) {
    setSearchingMatchId(matchId);
    setFifaSearchResults(null);
    const res = await actions.pencas.admin.searchFifaMatch({ matchId });
    setSearchingMatchId(null);
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      setFifaSearchResults(res.data as typeof fifaSearchResults);
    }
  }

  async function handleSelectFifaMatch(matchId: number, fifaMatchId: string) {
    setMessage(null);
    const res = await actions.pencas.admin.setFifaMatchId({ matchId, fifaMatchId });
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      setMessage({ type: "success", text: `FIFA ID ${fifaMatchId} asignado` });
      setFifaSearchResults(null);
      await loadMatches();
    }
  }

  function updateScore(matchId: number, field: "homeScore" | "awayScore", value: number) {
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, [field]: value } : m)),
    );
  }

  function handleCsvFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvPreview(null);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function handlePreviewCsv() {
    if (!csvText) return;
    setMessage(null);
    setCsvImporting(true);
    const res = await actions.pencas.admin.importPredictionsCsv({ csv: csvText, dryRun: true, overwrite: csvOverwrite });
    setCsvImporting(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      setCsvPreview(res.data as CsvPreview);
    }
  }

  async function handleImportCsv() {
    if (!csvText) return;
    if (!window.confirm("¿Importar las predicciones faltantes? Esta acción no se puede deshacer.")) return;
    setMessage(null);
    setCsvImporting(true);
    const res = await actions.pencas.admin.importPredictionsCsv({ csv: csvText, dryRun: false, overwrite: csvOverwrite });
    setCsvImporting(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error.message });
    } else {
      const d = res.data as CsvPreview;
      setCsvPreview(d);
      setMessage({
        type: "success",
        text: `Importadas ${d.toInsert} predicciones, ${d.omitted} omitidas, ${d.errors.length} errores`,
      });
    }
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
              onClick={handleReimportKnockout}
              disabled={reimporting}
              class="btn-secondary !py-2.5 !px-4 !text-xs"
            >
              <RotateCcw class={`h-4 w-4 ${reimporting ? "animate-spin" : ""}`} />
              {reimporting ? "Re-importando..." : "Re-importar eliminatorias"}
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
            <button
              onClick={handleSyncFifaIds}
              disabled={syncingFifaIds}
              class="btn-secondary !py-2.5 !px-4 !text-xs"
            >
              <Wand2 class={`h-4 w-4 ${syncingFifaIds ? "animate-spin" : ""}`} />
              {syncingFifaIds ? "Buscando..." : "Auto-detectar FIFA IDs"}
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

      {/* Recuperar predicciones CSV */}
      <div class="glass-card p-4 sm:p-6 mb-6">
        <div class="flex items-center gap-3 mb-3">
          <Upload class="h-5 w-5 text-accent" />
          <span class="font-barlow font-bold uppercase text-sm text-white">Importar predicciones CSV</span>
        </div>
        <p class="text-xs text-muted mb-3">
          Importá predicciones desde tu copia local Turso. Se emparejan por
          equipo (<code class="text-accent-light">fifaCode</code>) y fecha, no por <code class="text-accent-light">matchId</code>,
          así que funciona aunque los IDs de ambas bases difieran.
        </p>
        <p class="text-[11px] text-muted bg-black/20 rounded p-2 font-mono mb-4">
          turso db shell tu-db-name &lt; query.sql<br />
          turso db shell tu-db-name ".mode csv" ".headers on" "SELECT ..." &gt; predicciones.csv
        </p>
        <div class="flex flex-wrap items-center gap-3 mb-2">
          <label class="btn-secondary !py-2.5 !px-4 !text-xs cursor-pointer inline-flex items-center gap-2">
            <Upload class="h-4 w-4" />
            {csvFileName || "Seleccionar CSV"}
            <input type="file" accept=".csv,text/csv" onInput={handleCsvFile} class="hidden" />
          </label>
          <label class="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={csvOverwrite}
              onInput={(e) => setCsvOverwrite((e.target as HTMLInputElement).checked)}
            />
            Sobrescribir existentes
          </label>
          <button
            onClick={handlePreviewCsv}
            disabled={!csvText || csvImporting}
            class="btn-secondary !py-2.5 !px-4 !text-xs"
          >
            {csvImporting ? "Analizando..." : "Vista previa"}
          </button>
          <button
            onClick={handleImportCsv}
            disabled={!csvText || csvImporting}
            class="btn-primary !py-2.5 !px-4 !text-xs"
          >
            Importar
          </button>
        </div>

        {csvPreview && (
          <div class="text-xs space-y-4 mt-4 pt-4 border-t border-accent-border/10">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="bg-green-accent/10 rounded-lg p-3 text-center">
                <div class="font-barlow font-black text-lg text-green-accent">{csvPreview.toInsert}</div>
                <div class="text-muted uppercase tracking-wider text-[10px]">Se importarán</div>
              </div>
              <div class="bg-accent-subtle/30 rounded-lg p-3 text-center">
                <div class="font-barlow font-black text-lg text-white">{csvPreview.skipped}</div>
                <div class="text-muted uppercase tracking-wider text-[10px]">Ya existen (igual)</div>
              </div>
              <div class="bg-gold/10 rounded-lg p-3 text-center">
                <div class="font-barlow font-black text-lg text-gold">{csvPreview.omitted}</div>
                <div class="text-muted uppercase tracking-wider text-[10px]">Existen distintas (omitidas)</div>
              </div>
              <div class="bg-red-900/10 rounded-lg p-3 text-center">
                <div class="font-barlow font-black text-lg text-red-400">{csvPreview.errors.length}</div>
                <div class="text-muted uppercase tracking-wider text-[10px]">Errores</div>
              </div>
            </div>

            {csvPreview.previewInsert.length > 0 && (
              <div>
                <p class="font-barlow font-bold uppercase text-xs text-green-accent mb-2">
                  Se importarán ({csvPreview.previewInsert.length}{csvPreview.toInsert > csvPreview.previewInsert.length ? "+" : ""})
                </p>
                <div class="max-h-48 overflow-y-auto space-y-1">
                  {csvPreview.previewInsert.map((p, i) => (
                    <div key={i} class="flex items-center justify-between py-1 px-2 bg-green-accent/5 rounded">
                      <span class="text-white">@{p.username}</span>
                      <span class="text-muted">{p.home} vs {p.away}</span>
                      <span class="text-accent-light font-semibold">{p.predHome} - {p.predAway}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {csvPreview.previewError.length > 0 && (
              <div>
                <p class="font-barlow font-bold uppercase text-xs text-red-400 mb-2">
                  Errores (no se importarán)
                </p>
                <div class="max-h-48 overflow-y-auto space-y-1">
                  {csvPreview.previewError.map((e, i) => (
                    <div key={i} class="py-1 px-2 bg-red-500/5 rounded text-red-400">
                      Línea {e.line}: {e.reason}
                    </div>
                  ))}
                </div>
                {csvPreview.errors.length > csvPreview.previewError.length && (
                  <p class="text-muted mt-1">... y {csvPreview.errors.length - csvPreview.previewError.length} más.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin info */}
      {user && (
        <div class="glass-card p-4 mb-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <img src={user.image ?? undefined} alt={user.name ?? "User avatar"} class="w-10 h-10 rounded-full object-cover" />
              <div>
                <p class="text-sm text-white font-semibold">{user.name}</p>
                <p class="text-[11px] text-muted uppercase tracking-wider">Administrador</p>
              </div>
            </div>
            {lastSyncedAt && (
              <div class="text-right">
                <p class="text-[11px] text-muted uppercase tracking-wider">Última sincronización</p>
                <p class="text-sm text-white font-semibold">
                  {format(parseISO(lastSyncedAt.includes('T') ? lastSyncedAt : lastSyncedAt.replace(' ', 'T') + 'Z'), "dd/MM/yyyy HH:mm", { locale: es })}
                </p>
              </div>
            )}
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
                <th class="px-5 py-4 text-center font-semibold">FIFA ID</th>
                <th class="px-5 py-4 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-accent-border/10">
              {loadingMatches ? (
                <tr>
                  <td colspan={7} class="text-center py-12 text-muted text-sm">
                    <RefreshCw class="h-5 w-5 animate-spin mx-auto mb-2 text-accent" />
                    Cargando partidos...
                  </td>
                </tr>
              ) : matches.length === 0 ? (
                <tr>
                  <td colspan={7} class="text-center py-12 text-muted text-sm">
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
                    <td class="px-5 py-4">
                      {editingFifaId === match.id ? (
                        <div class="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={fifaIdValue}
                            onInput={(e) => setFifaIdValue((e.target as HTMLInputElement).value)}
                            placeholder="400021528"
                            class="w-28 px-2 py-1 text-xs bg-black/30 border border-accent-border/40 rounded text-white font-mono focus:border-accent focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveFifaId(match.id);
                              if (e.key === "Escape") setEditingFifaId(null);
                            }}
                          />
                          <button
                            onClick={() => handleSaveFifaId(match.id)}
                            class="text-green-accent hover:text-green-accent/80 transition"
                          >
                            <Save class="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div class="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingFifaId(match.id);
                              setFifaIdValue(match.fifaMatchId ?? "");
                            }}
                            class={`inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded transition ${
                              match.fifaMatchId
                                ? "bg-green-accent/10 text-green-accent hover:bg-green-accent/20"
                                : "bg-zinc-800 text-muted hover:bg-zinc-700 hover:text-white"
                            }`}
                            title={match.fifaMatchId ? `FIFA ID: ${match.fifaMatchId}` : "Click para configurar FIFA ID"}
                          >
                            <Link class="h-3 w-3" />
                            {match.fifaMatchId || "—"}
                          </button>
                          {!match.fifaMatchId && (
                            <button
                              onClick={() => handleSearchFifa(match.id)}
                              disabled={searchingMatchId === match.id}
                              class="text-muted hover:text-accent-light transition"
                              title="Buscar en FIFA"
                            >
                              <Wand2 class={`h-3.5 w-3.5 ${searchingMatchId === match.id ? "animate-spin" : ""}`} />
                            </button>
                          )}
                        </div>
                      )}
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
