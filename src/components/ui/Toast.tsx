import { useEffect, useState } from "preact/hooks";
import { subscribe } from "../../lib/toast";

type ToastItem = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribe(setToasts);
  }, []);

  const icon: Record<string, string> = {
    success: "M5 13l4 4L19 7",
    error: "M18 6L6 18M6 6l12 12",
    info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  return (
    <div class="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-[100] flex flex-col gap-2 sm:max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          class="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md"
          style={{
            background: t.type === "success"
              ? "rgba(34,197,94,0.12)"
              : t.type === "error"
              ? "rgba(239,68,68,0.12)"
              : "rgba(139,92,246,0.12)",
            borderColor: t.type === "success"
              ? "rgba(34,197,94,0.4)"
              : t.type === "error"
              ? "rgba(239,68,68,0.4)"
              : "rgba(139,92,246,0.4)",
          }}
        >
          <svg
            class="h-5 w-5 mt-0.5 shrink-0"
            style={{
              color: t.type === "success" ? "#22C55E" : t.type === "error" ? "#EF4444" : "#A78BFA",
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d={icon[t.type]} />
          </svg>
          <p class="text-sm text-white font-medium leading-snug">{t.message}</p>
        </div>
      ))}
    </div>
  );
}
