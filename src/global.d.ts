import type { Session as AuthSession, DefaultSession } from "@auth/core/types";

declare module "@auth/core/types" {
    interface Session extends AuthSession {
        user: {
            id: number;
            username: string;
            is_admin?: boolean;
            coins?: number;
        } & DefaultSession["user"];
    }
}