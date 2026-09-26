import React from 'react';
import parse from 'html-react-parser';
import { cn } from '@/lib/utils';
import 'quill/dist/quill.core.css';

interface RichTextRendererProps {
  content?: string | null;
  className?: string;
}

/**
 * RichTextRenderer converts rich HTML text (authored in Quill / WYSIWYG)
 * directly into native React elements using html-react-parser.
 * 
 * Directly renders headings, paragraphs, lists, bold, italics, links,
 * and Quill-specific alignments (.ql-align-*) with Tailwind typography.
 */
export const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  content,
  className = '',
}) => {
  if (!content) return null;

  const trimmed = content.trim();
  if (!trimmed) return null;

  // If content is plain text (no HTML tags), wrap into paragraphs for proper formatting
  const formattedHtml = /<[a-z][\s\S]*>/i.test(trimmed)
    ? trimmed
    : trimmed
        .split(/\n{2,}/)
        .map(para => `<p>${para.replace(/\n/g, '<br />')}</p>`)
        .join('');

  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-gray-700 leading-relaxed overflow-hidden break-words ql-editor !p-0',
        className
      )}
    >
      {parse(formattedHtml)}
    </div>
  );
};

export default RichTextRenderer;
