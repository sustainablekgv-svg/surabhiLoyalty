import { clsx, type ClassValue } from 'clsx';
import { SHA256 } from 'crypto-js';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const hashPin = (pin: string): string => {
  return SHA256(pin).toString();
};

export const verifyPin = (pin: string, hashedPin: string): boolean => {
  return SHA256(pin).toString() === hashedPin;
};

/**
 * Ensures rich text content (HTML from ReactQuill / WYSIWYG) renders cleanly,
 * and seamlessly converts plain text with newlines into paragraph tags.
 */
export const formatRichText = (content?: string): string => {
  if (!content) return '';
  const trimmed = content.trim();
  if (!trimmed) return '';
  // Check if content already contains HTML tags (e.g. <p>, <div>, <span>, <ul>, etc.)
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }
  // If plain text, convert double newlines into paragraphs and single newlines into <br />
  return trimmed
    .split(/\n{2,}/)
    .map(para => `<p>${para.replace(/\n/g, '<br />')}</p>`)
    .join('');
};

/**
 * Strips HTML tags and entities from a string for plain-text uses like SEO, meta tags, and table previews.
 */
export const stripHtml = (content?: string): string => {
  if (!content) return '';
  return content
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

