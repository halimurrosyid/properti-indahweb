const BRAND_TITLE_SEPARATOR = '| Properti Indahweb';

const normalizeMetaTitle = (metaTitle, fallbackTitle = '') => {
  const source = String(metaTitle || fallbackTitle || '').trim();

  if (!source) return null;

  return source
    .replace(/\s*\|\s*Properti Indahweb\s*$/i, '')
    .trim() || null;
};

module.exports = {
  normalizeMetaTitle
};
