import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";

const API_SESIONES = "https://veratv-be.vera.com.uy/api/sesiones";
const API_SETUP = "https://veratv-be.vera.com.uy/api/setup";

export const anteltv = {
  getPlaybackUrl: defineAction({
    input: z.object({
      publicId: z.string(),
    }),
    handler: async ({ publicId }, { request }) => {
      const forwarded = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const clientIp = forwarded?.split(",")[0]?.trim() || realIp || "";

      const commonHeaders: Record<string, string> = {
        Accept: "application/json",
        Origin: "https://anteltv.com.uy",
        Referer: "https://anteltv.com.uy/",
      };
      if (clientIp) commonHeaders["X-Forwarded-For"] = clientIp;

      const sesRes = await fetch(API_SESIONES, {
        method: "POST",
        headers: { ...commonHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "anonima" }),
      });

      if (!sesRes.ok) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Error al crear sesión en AntelTV",
        });
      }

      const { token } = await sesRes.json();

      const setupRes = await fetch(`${API_SETUP}?token=${token}&public_id=${publicId}`, {
        headers: commonHeaders,
      });

      if (!setupRes.ok) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Error al obtener URL de reproducción",
        });
      }

      const setupData = await setupRes.json();

      if (setupData.url?.status !== "OK" || !setupData.url?.suggested?.url) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Stream no disponible para tu conexión",
        });
      }

      return {
        playbackUrl: setupData.url.suggested.url,
        backupUrl: setupData.url_backup?.suggested?.url || null,
      };
    },
  }),
};
