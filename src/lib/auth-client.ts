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
