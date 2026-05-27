import { generateShoppingList } from "@/server/actions/shopping";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  const result = await generateShoppingList();
  if (!result.success) {
    return new Response(result.error, { status: 500 });
  }

  return Response.json({
    ok:    true,
    items: result.data.items.length,
    taskId: result.data.taskId,
  });
}
