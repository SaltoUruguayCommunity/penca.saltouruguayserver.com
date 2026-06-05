import { defineConfig } from "auth-astro";
import { eq, sql } from "drizzle-orm";
import { client } from "./src/db";
import { UsersTable } from "./src/db/schema";

export default defineConfig({
  providers: [
    {
      id: "saltouruguay",
      name: "SaltoUruguayServer",
      type: "oauth",
      authorization: {
        url: `${import.meta.env.SUS_OAUTH_ISSUER ?? "https://saltouruguayserver.com"}/oauth/authorize`,
        params: { scope: "openid profile email", response_type: "code" },
      },
      token: `${import.meta.env.SUS_OAUTH_ISSUER ?? "https://saltouruguayserver.com"}/oauth/token`,
      userinfo: {
        url: `${import.meta.env.SUS_OAUTH_ISSUER ?? "https://saltouruguayserver.com"}/oauth/userinfo`,
      },
      clientId: import.meta.env.SUS_OAUTH_CLIENT_ID,
      clientSecret: import.meta.env.SUS_OAUTH_CLIENT_SECRET,
      //checks: ["pkce"],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.displayName || profile.username,
          email: profile.email,
          image: profile.avatar,
          username: profile.username,
        };
      },
    },
  ],
  callbacks: {
    jwt: async ({ token, account, profile }) => {
      if (account && profile) {
        const susId = Number(profile.sub);

        const existingUser = await client
          .select()
          .from(UsersTable)
          .where(eq(UsersTable.susId, susId))
          .get();

        if (existingUser) {
          await client
            .update(UsersTable)
            .set({
              displayName: profile.displayName || profile.name,
              username: profile.username,
              avatar: profile.picture || profile.avatar,
              email: profile.email,
              admin: Boolean(profile.is_admin),
              updatedAt: sql`(current_timestamp)`,
            })
            .where(eq(UsersTable.id, existingUser.id))
            .run();

          token.userId = existingUser.id;
          token.is_admin = Boolean(profile.is_admin);
        } else {
          const newUser = {
            susId,
            displayName: profile.displayName || profile.name,
            username: profile.username,
            avatar: profile.picture || profile.avatar,
            email: profile.email,
            admin: Boolean(profile.is_admin),
            coins: 0,
          };

          const result = await client
            .insert(UsersTable)
            .values(newUser)
            .returning()
            .get();

          token.userId = result.id;
          token.is_admin = Boolean(profile.is_admin);
        }
      }
      return token;
    },

    session: async ({ session, token }) => {
      if (token.userId) {
        const user = await client
          .select()
          .from(UsersTable)
          .where(eq(UsersTable.id, token.userId))
          .get();

        if (user) {
          session.user = {
            ...session.user,
            id: user.id,
            username: user.username,
            is_admin: Boolean(user.admin),
            coins: user.coins,
          };
        }
      }
      return session;
    },
  },
});
