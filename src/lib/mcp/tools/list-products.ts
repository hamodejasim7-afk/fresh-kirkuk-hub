import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_products",
  title: "List products",
  description: "List available products in the Fresh store (vegetables, fruits, meat, fish, poultry).",
  inputSchema: {
    category: z.string().optional().describe("Optional category filter."),
    only_available: z.boolean().optional().describe("Return only in-stock/available products."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category, only_available }) => {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    let q = sb.from("products").select("id,name,category,price_iqd,unit,is_available,stock_qty,emoji").order("sort_order");
    if (category) q = q.eq("category", category);
    if (only_available) q = q.eq("is_available", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
