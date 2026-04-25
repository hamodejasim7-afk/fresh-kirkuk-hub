import { z } from "zod";

export const orderCustomerSchema = z.object({
  name: z.string().trim().min(1, "يرجى إدخال الاسم").max(100, "الاسم طويل جداً"),
  phone: z.string().trim().min(5, "يرجى إدخال رقم هاتف صحيح").max(30, "رقم الهاتف طويل جداً"),
  address: z.string().trim().min(3, "يرجى إدخال العنوان بشكل أوضح").max(1000, "العنوان طويل جداً"),
  notes: z.string().trim().max(1000, "الملاحظات طويلة جداً").catch(""),
});

export type OrderCustomer = z.infer<typeof orderCustomerSchema>;