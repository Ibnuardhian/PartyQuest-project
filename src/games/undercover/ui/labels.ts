import type { Category, Role } from "@/games/undercover/contract";

export const CATEGORY_LABELS: Record<Category, string> = {
  campuran: "Campuran", makanan: "Makanan", hewan: "Hewan", benda: "Benda sehari-hari", tempat: "Tempat", pekerjaan: "Pekerjaan",
};

export const ROLE_LABELS: Record<Role, string> = { civilian: "Civilian", undercover: "Undercover", "mr-white": "Mr. White" };
