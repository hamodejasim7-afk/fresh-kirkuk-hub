import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "list_delivery_zones",
  title: "List delivery zones",
  description: "List active delivery zones in Kirkuk with their delivery fees in IQD.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    const { data, error } = await sb
      .from("delivery_zones")
      .select("id,name,price_iqd,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { zones: data ?? [] },
    };
  },
});
