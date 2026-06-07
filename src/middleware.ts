import { defineMiddleware } from "astro:middleware";
import { getSession } from "auth-astro/server";

export const onRequest = defineMiddleware(async (context, next) => {
    const session = await getSession(context.request);

    if (session) {
        context.locals.user = session.user;
    } else {
        context.locals.user = null;
    }

    return next();
});