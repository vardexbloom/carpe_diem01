import { z } from "zod";

const item = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,100}$/), size: z.string().min(1).max(10), qty: z.number().int().min(1).max(10) });
export const itemsSchema = z.array(item).min(1).max(30);

export const customerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[6-9][0-9]{9}$/),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]).optional(),
  address1: z.string().trim().min(5).max(200),
  address2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/),
});

export const quoteSchema = z.object({ method: z.enum(["online", "cod"]), items: itemsSchema });
export const checkoutSchema = quoteSchema.extend({ idempotencyKey: z.string().min(8).max(100), customer: customerSchema });
