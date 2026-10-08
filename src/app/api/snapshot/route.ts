import { snapshot } from "@/lib/data";

export function GET() {
  return Response.json(snapshot, { headers: { "access-control-allow-origin": "*" } });
}
