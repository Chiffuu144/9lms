const allowedTags = new Set(['A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'EM', 'H1', 'H2', 'H3', 'H4', 'HR', 'I', 'IMG', 'LI', 'OL', 'P', 'PRE', 'S', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'U', 'UL']);
const blockedTags = new Set(['IFRAME', 'OBJECT', 'EMBED', 'SCRIPT', 'STYLE', 'SVG', 'MATH', 'TEMPLATE']);
const allowedAttributes = new Set(['alt', 'colspan', 'height', 'href', 'rowspan', 'src', 'target', 'title', 'width']);

const isSafeUrl = value => {
  try {
    const protocol = new URL(value, document.baseURI).protocol;
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:';
  } catch {
    return false;
  }
};

const sanitizeElement = element => {
  for (const child of [...element.childNodes]) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    if (blockedTags.has(child.tagName)) {
      child.remove();
      continue;
    }
    sanitizeElement(child);
    if (!allowedTags.has(child.tagName)) child.replaceWith(...child.childNodes);
  }

  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    const numeric = name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan';
    const url = name === 'href' || name === 'src';
    const urlAllowed = name === 'src'
      ? (() => { try { const protocol = new URL(attribute.value, document.baseURI).protocol; return protocol === 'http:' || protocol === 'https:'; } catch { return false; } })()
      : isSafeUrl(attribute.value);
    if (!allowedAttributes.has(name) || (numeric && !/^\d{1,4}$/.test(attribute.value)) || (url && !urlAllowed) || (name === 'target' && attribute.value !== '_blank')) {
      element.removeAttribute(attribute.name);
    }
  }
  if (element.tagName === 'A' && element.getAttribute('target') === '_blank') element.setAttribute('rel', 'noopener noreferrer');
};

export default function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  for (const child of [...template.content.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      if (blockedTags.has(child.tagName)) child.remove();
      else {
        sanitizeElement(child);
        if (!allowedTags.has(child.tagName)) child.replaceWith(...child.childNodes);
      }
    }
  }
  return template.innerHTML;
}
