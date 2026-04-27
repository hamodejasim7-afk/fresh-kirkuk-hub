import * as XLSX from "xlsx";

interface OrderLite {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  notes: string | null;
  total_iqd: number;
  delivery_fee_iqd: number;
  status: string;
  driver_id: string | null;
  archived_at: string | null;
  created_at: string;
}

interface OrderItemLite {
  id: string;
  order_id: string;
  product_name: string;
  category: string | null;
  unit: string | null;
  price_iqd: number;
  quantity: number;
}

const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  assigned: "معين لسائق",
  on_the_way: "قيد التوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

/**
 * Export orders + items to a multi-sheet .xlsx file.
 * Sheet 1: Orders summary
 * Sheet 2: Line items (one row per product)
 */
export function exportOrdersToExcel(
  orders: OrderLite[],
  itemsMap: Record<string, OrderItemLite[]>,
  filename: string,
) {
  const wb = XLSX.utils.book_new();

  // ---- Orders sheet ----
  const ordersRows = orders.map((o) => {
    const its = itemsMap[o.id] ?? [];
    const subtotal = its.reduce((s, it) => s + Number(it.price_iqd) * Number(it.quantity), 0);
    return {
      "رقم الطلب": o.id,
      "التاريخ": new Date(o.created_at).toLocaleString("ar-IQ"),
      "تاريخ الأرشفة": o.archived_at ? new Date(o.archived_at).toLocaleString("ar-IQ") : "",
      "اسم الزبون": o.customer_name,
      "الهاتف": o.customer_phone,
      "العنوان": o.customer_address,
      "عدد المنتجات": its.length,
      "المجموع الفرعي (IQD)": subtotal,
      "رسوم التوصيل (IQD)": o.delivery_fee_iqd,
      "المجموع الكلي (IQD)": o.total_iqd,
      "الحالة": STATUS_LABEL[o.status] ?? o.status,
      "ملاحظات": o.notes ?? "",
    };
  });

  // Totals row
  const grandTotal = orders.reduce((s, o) => s + Number(o.total_iqd), 0);
  const grandFees = orders.reduce((s, o) => s + Number(o.delivery_fee_iqd), 0);
  ordersRows.push({
    "رقم الطلب": "",
    "التاريخ": "",
    "تاريخ الأرشفة": "",
    "اسم الزبون": "",
    "الهاتف": "",
    "العنوان": "",
    "عدد المنتجات": orders.length as any,
    "المجموع الفرعي (IQD)": (grandTotal - grandFees) as any,
    "رسوم التوصيل (IQD)": grandFees as any,
    "المجموع الكلي (IQD)": grandTotal as any,
    "الحالة": "الإجمالي",
    "ملاحظات": "",
  });

  const ws1 = XLSX.utils.json_to_sheet(ordersRows);
  ws1["!cols"] = [
    { wch: 36 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 14 },
    { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 18 },
    { wch: 14 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "الطلبات");

  // ---- Line items sheet ----
  const itemRows: any[] = [];
  for (const o of orders) {
    const its = itemsMap[o.id] ?? [];
    for (const it of its) {
      itemRows.push({
        "رقم الطلب": o.id,
        "التاريخ": new Date(o.created_at).toLocaleString("ar-IQ"),
        "الزبون": o.customer_name,
        "المنتج": it.product_name,
        "الفئة": it.category ?? "",
        "الكمية": Number(it.quantity),
        "الوحدة": it.unit ?? "",
        "السعر (IQD)": Number(it.price_iqd),
        "الإجمالي (IQD)": Number(it.price_iqd) * Number(it.quantity),
      });
    }
  }
  const ws2 = XLSX.utils.json_to_sheet(itemRows);
  ws2["!cols"] = [
    { wch: 36 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 14 },
    { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "المنتجات");

  XLSX.writeFile(wb, filename);
}
