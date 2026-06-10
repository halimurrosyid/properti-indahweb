const { PrismaClient } = require('@prisma/client');
const { normalizeMetaTitle } = require('../utils/seoMeta');
const prisma = new PrismaClient();

// GET /artikel
exports.getBlogList = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    // Fetch published posts
    const [posts, totalCount] = await prisma.$transaction([
      prisma.blogPost.findMany({
        where: { status: 'published' },
        include: { category: true, author: true },
        orderBy: { published_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.blogPost.count({
        where: { status: 'published' }
      })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Fetch all categories for sidebar/filter
    const categories = await prisma.blogCategory.findMany({
      include: {
        _count: {
          select: { posts: { where: { status: 'published' } } }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Fetch latest articles for sidebar
    const latestPosts = await prisma.blogPost.findMany({
      where: { status: 'published' },
      orderBy: { published_at: 'desc' },
      take: 5
    });

    res.render('pages/blog-list', {
      title: 'Artikel & Info Properti Terbaru',
      description: 'Dapatkan berita, panduan hukum, tips, dan wawasan seputar investasi properti di Indonesia.',
      posts,
      categories,
      latestPosts,
      currentPage: page,
      totalPages,
      activeCategory: null
    });
  } catch (error) {
    next(error);
  }
};

// GET /artikel/kategori/:slug
exports.getBlogListByCategory = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    // Find category by slug
    const category = await prisma.blogCategory.findUnique({
      where: { slug }
    });

    if (!category) {
      const err = new Error('Kategori blog tidak ditemukan.');
      err.status = 404;
      return next(err);
    }

    // Fetch published posts in category
    const [posts, totalCount] = await prisma.$transaction([
      prisma.blogPost.findMany({
        where: {
          status: 'published',
          category_id: category.id
        },
        include: { category: true, author: true },
        orderBy: { published_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.blogPost.count({
        where: {
          status: 'published',
          category_id: category.id
        }
      })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Fetch all categories for sidebar/filter
    const categories = await prisma.blogCategory.findMany({
      include: {
        _count: {
          select: { posts: { where: { status: 'published' } } }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Fetch latest articles for sidebar
    const latestPosts = await prisma.blogPost.findMany({
      where: { status: 'published' },
      orderBy: { published_at: 'desc' },
      take: 5
    });

    res.render('pages/blog-list', {
      title: `Kategori: ${category.name}`,
      description: category.description || `Kumpulan artikel seputar ${category.name} di 1rumah.biz.id.`,
      posts,
      categories,
      latestPosts,
      currentPage: page,
      totalPages,
      activeCategory: category
    });
  } catch (error) {
    next(error);
  }
};

// GET /artikel/:slug
exports.getBlogDetail = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: { category: true, author: true }
    });

    // Protect: only show published post in public.
    // If it's draft/scheduled/archived/deleted, only super_admin/admin can preview it.
    if (!post || (post.status !== 'published' && (!req.session.user || (req.session.user.role !== 'super_admin' && req.session.user.role !== 'admin')))) {
      const err = new Error('Artikel tidak ditemukan.');
      err.status = 404;
      return next(err);
    }

    // Fetch related articles (same category, up to 3 posts, excluding current one)
    const relatedPosts = await prisma.blogPost.findMany({
      where: {
        status: 'published',
        category_id: post.category_id,
        NOT: { id: post.id }
      },
      orderBy: { published_at: 'desc' },
      take: 3
    });

    // Build canonical
    const proto = req.protocol;
    const host = req.get('host');
    const canonical = post.canonical_url || `${proto}://${host}/artikel/${post.slug}`;

    res.render('pages/blog-detail', {
      title: normalizeMetaTitle(post.meta_title, post.title),
      description: post.meta_description || post.excerpt || post.title.substring(0, 160),
      post,
      relatedPosts,
      canonicalUrl: canonical
    });
  } catch (error) {
    next(error);
  }
};
