export function allowMutation(request: Request) {
  const origin = request.headers.get("origin");
  const local = new URL(request.url);
  if (request.headers.get("sec-fetch-site") === "cross-site" || origin && new URL(origin).host !== local.host) throw new Error("이 앱 화면에서 다시 요청해주세요.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("잘못된 요청 형식입니다.");
}
export function failure(error: unknown, status=400) {
  return Response.json({error:error instanceof Error ? error.message : "요청을 처리하지 못했습니다."},{status});
}
