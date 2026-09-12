/**
 * Utility helper functions for mobile app formatting & safe data extraction.
 */

/**
 * Safely extracts a display name from a category which can be:
 * - A string (e.g., "Food & Dining")
 * - An object (e.g., { id: '...', name: 'Food & Dining', slug: 'food-dining', color: '...', icon: '...' })
 * - Null or undefined
 */
export const getCategoryName = (cat: any, fallback = 'General'): string => {
  if (!cat) return fallback;
  if (typeof cat === 'string') return cat;
  if (typeof cat === 'object') {
    if (typeof cat.name === 'string' && cat.name.trim()) return cat.name;
    if (typeof cat.slug === 'string' && cat.slug.trim()) return cat.slug;
  }
  return fallback;
};
