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
