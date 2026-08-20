import type { IncomingHttpHeaders } from "node:http";

export interface AuthenticatedUser {
  readonly userId: string;
  readonly sessionId: string;
  readonly isPlatformAdmin: boolean;
}

export type AuthenticateUser = (
  headers: IncomingHttpHeaders,
) => Promise<AuthenticatedUser | null>;
