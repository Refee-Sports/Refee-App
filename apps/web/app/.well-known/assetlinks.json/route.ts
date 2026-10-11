import { assetLinks } from "@/lib/well-known";

// Read at request time so setting ANDROID_CERT_SHA256 takes effect without a rebuild.
export const dynamic = "force-dynamic";

export function GET() {
  const file = assetLinks(process.env);
  if (!file) return new Response("Not found", { status: 404 });
  return Response.json(file);
}
