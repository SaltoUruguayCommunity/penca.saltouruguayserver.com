import { Medal, User, Shield } from "lucide-preact";
import type { Session } from "@auth/core/types";

type LeaderboardEntry = {
  position: number;
  userId: number;
  username: string;
  avatar: string | null;
  totalPoints: number;
};

type Props = {
  entries: LeaderboardEntry[];
  session: Session | null;
};

const MEDAL_COLORS = [
  { icon: "#FACC15", text: "text-gold", bg: "bg-gold/10", border: "border-gold/30" },
  { icon: "#A1A1AA", text: "text-zinc-300", bg: "bg-zinc-300/10", border: "border-zinc-300/20" },
  { icon: "#D97706", text: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" },
];

export default function Leaderboard({ entries, session }: Props) {
  if (entries.length === 0) {
    return (
      <div class="glass-card p-12 text-center">
        <Medal class="h-12 w-12 mx-auto mb-4 text-accent/30" />
        <p class="text-muted text-sm">No hay puntos registrados aún.</p>
        <p class="text-muted/50 text-xs mt-1">¡Pronosticá partidos para aparecer en la tabla!</p>
      </div>
    );
  }

  return (
    <div class="glass-card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-accent-subtle/50 text-muted text-[11px] uppercase tracking-[0.12em]">
            <th class="px-5 py-4 text-left font-semibold w-14">#</th>
            <th class="px-5 py-4 text-left font-semibold">Usuario</th>
            <th class="px-5 py-4 text-right font-semibold">Puntos</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-accent-border/10">
          {entries.map((entry) => {
            const isMe = session?.user && entry.userId === session.user.id;
            return (
              <tr
                key={entry.userId}
                class={`transition ${
                  isMe ? "bg-accent-subtle/30" : "hover:bg-accent-subtle/10"
                }`}
              >
                <td class="px-5 py-4">
                  {entry.position <= 3 ? (
                    <div class={`w-8 h-8 rounded-full ${MEDAL_COLORS[entry.position - 1].bg} border ${MEDAL_COLORS[entry.position - 1].border} flex items-center justify-center`}>
                      <Medal class={`h-4 w-4 ${MEDAL_COLORS[entry.position - 1].text}`} />
                    </div>
                  ) : (
                    <span class="font-barlow font-bold text-base text-muted tabular-nums">
                      {entry.position}
                    </span>
                  )}
                </td>
                <td class="px-5 py-4">
                  <div class="flex items-center gap-3">
                    {entry.avatar ? (
                      <img
                        src={entry.avatar}
                        alt=""
                        class="h-8 w-8 rounded-full object-cover ring-2 ring-accent/20"
                      />
                    ) : (
                      <div class="h-8 w-8 rounded-full bg-accent-subtle border border-accent-border flex items-center justify-center">
                        <User class="h-4 w-4 text-accent" />
                      </div>
                    )}
                    <div class="flex items-center gap-2">
                      <span class={`font-semibold ${isMe ? "text-accent-light" : "text-white"}`}>
                        {entry.username}
                      </span>
                      {isMe && (
                        <span class="badge-pill !text-[10px] !px-2 !py-0.5">
                          <Shield class="h-2.5 w-2.5 mr-1" />
                          Vos
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td class="px-5 py-4 text-right">
                  <span class="font-barlow font-black text-xl text-accent tabular-nums">
                    {entry.totalPoints}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
