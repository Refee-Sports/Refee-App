import { appleAppSiteAssociation } from "@/lib/well-known";

// Read at request time so setting APPLE_TEAM_ID takes effect without a rebuild.
export const dynamic = "force-dynamic";

export function GET() {
  const file = appleAppSiteAssociation(process.env);
  if (!file) return new Response("Not found", { status: 404 });
  // Apple requires application/json, served directly (no redirect) over HTTPS.
  return Response.json(file);
}
