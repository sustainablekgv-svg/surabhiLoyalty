
/**
 * Checks if an image URL is valid for display.
 * Filters out empty strings and invalid 'blob:' URLs that might be persisted from old sessions.
 * 
 * @param url - The image URL to check
 * @returns True if the URL is valid for display
 */
export const isValidImageUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    if (typeof url !== 'string') return false;
    if (url.trim() === '') return false;
    
    // Filter out blob URLs as they are session-specific and shouldn't be persisted
    if (url.startsWith('blob:')) return false;
    
    return true;
};
