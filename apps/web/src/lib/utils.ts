import { type ClassValue, clsx } from "clsx";

// Merge classes with clsx for predictable styling overrides
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
