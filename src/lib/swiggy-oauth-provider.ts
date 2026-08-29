import { cookies } from "next/headers";
import { encrypt, decrypt, secureCookie } from "./crypto";
import type {
  OAuthClientProvider,
  OAuthClientMetadata,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
  OAuthDiscoveryState
} from "@modelcontextprotocol/client";

const SESSION_COOKIE = "swiggy_session";
const HANDSHAKE_COOKIE = "swiggy_oauth";

interface HandshakeState {
  codeVerifier?: string;
  discoveryState?: OAuthDiscoveryState;
  clientInformation?: StoredOAuthClientInformation;
}

/**
 * OAuthClientProvider backed by httpOnly encrypted cookies — one short-lived
 * cookie for the PKCE/discovery round-trip, one longer-lived one for the
 * final tokens. No DB/KV exists in this app; cookies are the zero-infra fit
 * for per-visitor OAuth state in a stateless Next.js route handler.
 */
export class CookieOAuthProvider implements OAuthClientProvider {
  constructor(private redirectUri: string) {}

  get redirectUrl() {
    return this.redirectUri;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "GlycoCart",
      redirect_uris: [this.redirectUri]
    };
  }

  private async readHandshake(): Promise<HandshakeState> {
    const jar = await cookies();
    return decrypt<HandshakeState>(jar.get(HANDSHAKE_COOKIE)?.value) ?? {};
  }

  private async writeHandshake(patch: Partial<HandshakeState>) {
    const jar = await cookies();
    const current = await this.readHandshake();
    jar.set(HANDSHAKE_COOKIE, encrypt({ ...current, ...patch }), {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: 600
    });
  }

  async clientInformation() {
    return (await this.readHandshake()).clientInformation;
  }

  async saveClientInformation(info: StoredOAuthClientInformation) {
    await this.writeHandshake({ clientInformation: info });
  }

  async tokens() {
    const jar = await cookies();
    return decrypt<StoredOAuthTokens>(jar.get(SESSION_COOKIE)?.value);
  }

  async saveTokens(tokens: StoredOAuthTokens) {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, encrypt(tokens), {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
  }

  private capturedAuthorizationUrl: URL | null = null;

  redirectToAuthorization(url: URL) {
    this.capturedAuthorizationUrl = url;
  }

  /** Server-side stand-in for a browser redirect — the route handler reads this and issues the actual HTTP redirect. */
  consumeRedirectUrl(): URL | null {
    return this.capturedAuthorizationUrl;
  }

  async saveCodeVerifier(v: string) {
    await this.writeHandshake({ codeVerifier: v });
  }

  async codeVerifier() {
    const v = (await this.readHandshake()).codeVerifier;
    if (!v) throw new Error("Missing PKCE code verifier — the login attempt may have expired, try connecting again");
    return v;
  }

  async saveDiscoveryState(state: OAuthDiscoveryState) {
    await this.writeHandshake({ discoveryState: state });
  }

  async discoveryState() {
    return (await this.readHandshake()).discoveryState;
  }

  async clearSession() {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.delete(HANDSHAKE_COOKIE);
  }
}
