import type { Session } from "@auth/core/types";

export const getSessionClient: () => Promise<Session | null> = async () => {
  try {
    const sessionResponse = await fetch("/api/auth/session");
    if (!sessionResponse.ok) return null;
    return await sessionResponse.json();
  } catch {
    return null;
  }
};

export function handleSignIn() {
  const width = 580;
  const height = 680;
  const left = window.innerWidth / 2 - width / 2;
  const top = window.innerHeight / 2 - height / 2;

  window.open(
    "/auth/sus",
    "Iniciar sesión",
    `toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,copyhistory=no,width=${width},height=${height},top=${top},left=${left}`,
  );

}
