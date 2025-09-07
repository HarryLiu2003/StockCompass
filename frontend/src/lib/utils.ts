import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Export a single, unified function for merging class names
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}