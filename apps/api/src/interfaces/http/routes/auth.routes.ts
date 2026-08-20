import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../infrastructure/auth/auth.js";

export function registerAuthRoutes(app: FastifyInstance) {
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(
        request.url,
        `http://${request.headers.host ?? "localhost"}`,
      );
      const headers = fromNodeHeaders(request.headers);
      headers.delete("content-length");
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          body:
            request.method === "GET" ||
            request.method === "HEAD" ||
            request.body === undefined
              ? undefined
              : JSON.stringify(request.body),
        }),
      );

      reply.status(response.status);
      for (const [name, value] of response.headers) {
        if (name !== "set-cookie") reply.header(name, value);
      }
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });
}
