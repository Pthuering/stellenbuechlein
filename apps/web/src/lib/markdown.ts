// Anzeigentext (Markdown) sicher als HTML darstellen.

import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: false });

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    // Verweise innerhalb der App (#/stelle/…, aus Antworten der KI) bleiben im selben Fenster.
    if ((node.getAttribute('href') ?? '').startsWith('#/')) {
      node.removeAttribute('target');
      return;
    }
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'code', 'pre', 'span'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  });
}
