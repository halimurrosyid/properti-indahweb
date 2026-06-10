const normalizeMetaTitle = (metaTitle, fallbackTitle = '') => {
  const source = String(metaTitle || fallbackTitle || '').trim();

  if (!source) return null;

  return source
    .replace(/\s*\|\s*(1rumah\.biz\.id|Properti Indahweb)\s*$/i, '')
    .trim() || null;
};

module.exports = {
  normalizeMetaTitle
};
