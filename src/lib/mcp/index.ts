import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProducts from "./tools/list-products";
import listCategories from "./tools/list-categories";
import listDeliveryZones from "./tools/list-delivery-zones";
import getLoyaltyCard from "./tools/get-loyalty-card";
import storeStatus from "./tools/store-status";
import listRecentOrders from "./tools/list-recent-orders";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fresh-kirkuk-mcp",
  title: "فريش Fresh - Kirkuk",
  version: "0.1.0",
  instructions:
    "Tools for the Fresh grocery store in Kirkuk (vegetables, fruits, meat, fish, poultry). " +
    "Public tools: list_products, list_categories, list_delivery_zones, store_status, get_loyalty_card. " +
    "Staff-only (requires sign-in): list_recent_orders.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listProducts,
    listCategories,
    listDeliveryZones,
    storeStatus,
    getLoyaltyCard,
    listRecentOrders,
  ],
});
