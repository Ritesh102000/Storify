import { TEMPLATE_SUMMARIES, setupFromTemplate } from "@/lib/fixtures";

export async function GET() {
  return Response.json({
    templates: TEMPLATE_SUMMARIES.map((template) => ({
      ...template,
      setup: setupFromTemplate(template.template_id),
    })),
  });
}
