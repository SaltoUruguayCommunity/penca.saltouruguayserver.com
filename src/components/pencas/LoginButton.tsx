import { useCallback, useState } from "preact/hooks";
import { signOut } from "auth-astro/client";
import type { Session } from "@auth/core/types";
import { LogOut, User } from "lucide-preact";

type Props = {
  session: Session | null;
};

export default function LoginButton({ session }: Props) {
  const [error, setError] = useState("");

  function handleSignIn() {
    const width = 580;
    const height = 680;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;

    window.open(
      "/auth/sus",
      "Iniciar sesión",
      `toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,copyhistory=no,width=${width},height=${height},top=${top},left=${left}`,
    );

    const onError = () => {
      setError("No se pudo iniciar sesión");
      window.removeEventListener("SignInError", onError);
    };

    window.addEventListener("SignInError", onError, { once: true });
  }

  const handleSignOut = useCallback(async () => {
    await signOut({ callbackUrl: "/" });
  }, []);

  if (session?.user) {
    return (
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2.5">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name ?? ""}
              class="h-9 w-9 rounded-full object-cover ring-2 ring-accent/30"
            />
          ) : (
            <div class="h-9 w-9 rounded-full bg-accent-subtle border border-accent-border flex items-center justify-center">
              <User class="h-4 w-4 text-accent" />
            </div>
          )}
          <div class="hidden sm:block">
            <p class="text-sm font-semibold text-white leading-tight">
              {session.user.username ?? session.user.name}
            </p>
            {typeof session.user.coins === "number" && (
              <p class="text-[11px] text-gold font-semibold uppercase tracking-wider">
                ★ {session.user.coins} monedas
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          class="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted hover:text-accent transition font-semibold cursor-pointer"
        >
          <LogOut class="h-3.5 w-3.5" />
          <span class="hidden sm:inline">Salir</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleSignIn}
        class="btn-primary !py-2.5 !px-5 !text-xs cursor-pointer"
      >
        Ingresar
      </button>
      {error && (
        <p class="text-[11px] text-red-400 mt-1 text-right">{error}</p>
      )}
    </div>
  );
}
