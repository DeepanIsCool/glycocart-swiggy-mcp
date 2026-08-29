import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
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

function getKey(): Buffer {
  const secret = process.env.SWIGGY_TOKEN_SECRET;
  if (!secret) throw new Error("SWIGGY_TOKEN_SECRET is not set");
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decrypt<T>(raw: string | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    const buf = Buffer.from(raw, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  } catch {
    return undefined;
  }
}

const secureCookie = process.env.NODE_ENV === "production";

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
