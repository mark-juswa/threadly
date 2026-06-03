const decodeHtmlEntities = (text) => {
  if (!text) return '';

  const namedEntities = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };

  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const codePoint = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return namedEntities[entity] || match;
  });
};

export const htmlToPlainText = (html = '') => {
  if (!html || typeof html !== 'string') return '';

  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<img[^>]*>/gi, ' [Image] ')
      .replace(/<\/(h[1-6]|p|div|li|blockquote|pre)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
};

export const limitPlainText = (text, maxChars) => {
  if (!text || text.length <= maxChars) {
    return { text: text || '', truncated: false };
  }

  return {
    text: `${text.slice(0, maxChars).trim()}\n\n[Content truncated]`,
    truncated: true,
  };
};

const cleanInlineText = (text = '') => decodeHtmlEntities(
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const extractMatches = (html, regex, mapper) => {
  const matches = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const value = mapper(match);
    if (value) matches.push(value);
  }

  return matches;
};

export const extractHtmlStructure = (html = '') => {
  if (!html || typeof html !== 'string') {
    return {
      headings: [],
      highlights: [],
      bullets: [],
      numberedItems: [],
      checklists: [],
    };
  }

  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  const headings = extractMatches(
    withoutScripts,
    /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi,
    (match) => {
      const text = cleanInlineText(match[2]);
      return text ? { level: Number(match[1]), text } : null;
    }
  );

  const highlights = [
    ...extractMatches(
      withoutScripts,
      /<mark[^>]*>([\s\S]*?)<\/mark>/gi,
      (match) => cleanInlineText(match[1])
    ),
    ...extractMatches(
      withoutScripts,
      /<span[^>]*(?:background|highlight)[^>]*>([\s\S]*?)<\/span>/gi,
      (match) => cleanInlineText(match[1])
    ),
  ].filter(Boolean);

  const bullets = extractMatches(
    withoutScripts,
    /<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    (listMatch) => extractMatches(
      listMatch[1],
      /<li[^>]*>([\s\S]*?)<\/li>/gi,
      (itemMatch) => cleanInlineText(itemMatch[1])
    )
  ).flat().filter(Boolean);

  const numberedItems = extractMatches(
    withoutScripts,
    /<ol[^>]*>([\s\S]*?)<\/ol>/gi,
    (listMatch) => extractMatches(
      listMatch[1],
      /<li[^>]*>([\s\S]*?)<\/li>/gi,
      (itemMatch) => cleanInlineText(itemMatch[1])
    )
  ).flat().filter(Boolean);

  const customChecklists = extractMatches(
    withoutScripts,
    /<div[^>]*class=["'][^"']*checklist-item[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    (match) => {
      const checked = /data-checked=["']true["']|bg-green-500/.test(match[1]);
      const textMatch = match[1].match(/<span[^>]*class=["'][^"']*checklist-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const text = cleanInlineText(textMatch?.[1] || match[1]);
      return text ? { checked, text } : null;
    }
  );

  const textChecklists = extractMatches(
    withoutScripts,
    /(?:^|>|\n)\s*\[([xX ])\]\s*([^<\n]+)/g,
    (match) => {
      const text = cleanInlineText(match[2]);
      return text ? { checked: match[1].toLowerCase() === 'x', text } : null;
    }
  );

  return {
    headings: headings.slice(0, 30),
    highlights: [...new Set(highlights)].slice(0, 30),
    bullets: [...new Set(bullets)].slice(0, 40),
    numberedItems: [...new Set(numberedItems)].slice(0, 40),
    checklists: [...customChecklists, ...textChecklists].slice(0, 40),
  };
};
