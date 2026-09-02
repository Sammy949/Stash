import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 * Required by the vendored shadcn primitives in src/components/shadcn.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
