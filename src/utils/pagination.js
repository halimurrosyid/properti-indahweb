const DEFAULT_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const toPositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizePerPage = (value, options, fallback) => {
  const parsed = toPositiveInt(value, fallback);
  if (options.includes(parsed)) return parsed;
  return fallback;
};

const buildPagination = (query, totalItems, options = {}) => {
  const pageParam = options.pageParam || 'page';
  const perPageParam = options.perPageParam || 'perPage';
  const perPageOptions = options.perPageOptions || DEFAULT_PER_PAGE_OPTIONS;
  const defaultPerPage = options.defaultPerPage || perPageOptions[0] || 10;
  const perPage = normalizePerPage(query[perPageParam], perPageOptions, defaultPerPage);
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const requestedPage = toPositiveInt(query[pageParam], 1);
  const currentPage = Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * perPage;

  return {
    pageParam,
    perPageParam,
    perPageOptions,
    currentPage,
    page: currentPage,
    perPage,
    limit: perPage,
    skip,
    totalItems,
    totalPages,
    hasPrevious: currentPage > 1,
    hasNext: currentPage < totalPages,
    query: { ...query }
  };
};

module.exports = {
  DEFAULT_PER_PAGE_OPTIONS,
  buildPagination
};
