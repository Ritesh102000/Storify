import { forgeError } from "@/lib/forge/api";
import { listForgeStories } from "@/lib/forge/stories";

export async function GET() {
  try {
    return Response.json({ stories: await listForgeStories() });
  } catch (error) {
    return forgeError(error);
  }
}
