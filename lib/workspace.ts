import {env} from "cloudflare:workers";

export const WORKSPACE_COOKIE = "jobtime_workspace";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type WorkspaceContext = {
  id: string;
  kind: "browser" | "account";
  legacyOwner: boolean;
  setCookie?: string;
};

function cookieValue(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${WORKSPACE_COOKIE}=([^;]+)`));
  const value = match?.[1] ?? "";
  return /^browser_[a-z0-9-]{20,80}$/i.test(value) ? value : null;
}

function cookieHeader(request: Request, id: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${WORKSPACE_COOKIE}=${id}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

async function accountWorkspace(userId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`jobtime:${userId}`));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `account_${encoded}`;
}

export async function workspaceContext(request: Request): Promise<WorkspaceContext> {
  const userId = request.headers.get("oai-authenticated-user-id")?.trim() || null;
  const ownerId = (env as unknown as {JOBTIME_OWNER_ID?: string}).JOBTIME_OWNER_ID?.trim();
  if (userId) return {id: await accountWorkspace(userId), kind: "account", legacyOwner: !!ownerId && userId === ownerId};
  const existing = cookieValue(request);
  if (existing) return {id: existing, kind: "browser", legacyOwner: false};
  const id = `browser_${crypto.randomUUID()}`;
  return {id, kind: "browser", legacyOwner: false, setCookie: cookieHeader(request, id)};
}

export function withWorkspaceCookie(response: Response, context: WorkspaceContext) {
  if (context.setCookie) response.headers.set("Set-Cookie", context.setCookie);
  response.headers.set("Vary", "Cookie");
  return response;
}
