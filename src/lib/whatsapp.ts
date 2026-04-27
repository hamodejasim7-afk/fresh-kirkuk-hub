// Build a WhatsApp message body with all order details
import type { Database } from "@/integrations/supabase/types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type ItemRow = Database["public"]["Tables"]["order_items"]["Row"];

const fmtIQD = (n: number) => `${Math.round(n).toLocaleString("ar-IQ")} د.ع`;

export const buildOrderWhatsAppText = (order: OrderRow, items: ItemRow[]) => {
  const date = new Date(order.created_at).toLocaleString("ar-IQ", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const lines: string[] = [];
  lines.push("🛒 *طلب جديد - فريش Fresh*");
  lines.push("━━━━━━━━━━━━━━━");
  lines.push(`👤 الاسم: ${order.customer_name}`);
  lines.push(`📱 الهاتف: ${order.customer_phone}`);
  lines.push(`📍 العنوان: ${order.customer_address}`);
  if (order.notes) lines.push(`📝 ملاحظات: ${order.notes}`);
  lines.push(`🕐 الوقت: ${date}`);
  lines.push("━━━━━━━━━━━━━━━");
  lines.push("*المنتجات:*");
  items.forEach((it, i) => {
    lines.push(
      `${i + 1}. ${it.product_name} × ${it.quantity} ${it.unit ?? ""} = ${fmtIQD(
        it.price_iqd * Number(it.quantity)
      )}`
    );
  });
  lines.push("━━━━━━━━━━━━━━━");
  const subtotal = items.reduce((s, it) => s + it.price_iqd * Number(it.quantity), 0);
  const fee = order.delivery_fee_iqd ?? 0;
  lines.push(`المجموع الفرعي: ${fmtIQD(subtotal)}`);
  if (fee > 0) lines.push(`🚚 توصيل: ${fmtIQD(fee)}`);
  lines.push(`💰 *المجموع الكلي: ${fmtIQD(order.total_iqd)}*`);
  return lines.join("\n");
};

// Normalize an Iraqi phone number to international (no plus, no spaces)
// Accepts: 07XXXXXXXXX, 7XXXXXXXXX, +9647XXXXXXXXX, 009647XXXXXXXXX
export const normalizeIqPhone = (raw: string): string => {
  let p = raw.replace(/\D/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("964")) return p;
  if (p.startsWith("0")) p = p.slice(1);
  return "964" + p;
};

export const buildWhatsAppLink = (phone: string, text: string) => {
  const number = normalizeIqPhone(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};
