import type { RequestHeaders } from "./authenticator.js";

export interface AuthenticatedUser {
  readonly userId: string;
  readonly sessionId: string;
  readonly isPlatformAdmin: boolean;
}

export type AuthenticateUser = (
  headers: RequestHeaders,
) => Promise<AuthenticatedUser | null>;
