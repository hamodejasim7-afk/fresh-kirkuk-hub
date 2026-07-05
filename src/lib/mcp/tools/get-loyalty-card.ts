import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_loyalty_card",
  title: "Get loyalty card",
  description: "Look up a customer's public Fresh loyalty card by phone number (stamps and gifts).",
  inputSchema: {
    phone: z.string().min(6).describe("Customer phone number as stored (e.g. 07701234567)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ phone }) => {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    const { data, error } = await sb
      .from("customers")
      .select("full_name,phone,area,total_stamps,gift_count,lifetime_orders")
      .eq("phone", phone)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "No loyalty card found for this phone." }] };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { card: data },
    };
  },
});
