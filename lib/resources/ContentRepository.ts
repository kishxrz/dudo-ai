import { 
  BlogArticle, 
  BLOG_ARTICLES, 
  Author, 
  AUTHORS, 
  PromptTemplate, 
  TEMPLATES, 
  CaseStudy, 
  CASE_STUDIES, 
  ProductUpdate, 
  PRODUCT_UPDATES, 
  Guide, 
  GUIDES, 
  Comparison, 
  COMPARISONS, 
  Series, 
  SERIES 
} from './data';

export interface ContentRepositoryInterface {
  getArticles(filters?: { category?: string; tag?: string; authorId?: string; search?: string; sort?: string }): BlogArticle[];
  getArticleBySlug(slug: string): BlogArticle | null;
  getAuthorById(id: string): Author | null;
  getRelatedArticles(article: BlogArticle, limit?: number): BlogArticle[];
  getTemplates(category?: string): PromptTemplate[];
  getCaseStudies(industry?: string): CaseStudy[];
  getProductUpdates(): ProductUpdate[];
  getGuides(): Guide[];
  getGuideBySlug(slug: string): Guide | null;
  getComparisons(): Comparison[];
  getComparisonBySlug(slug: string): Comparison | null;
  getSeries(id: string): Series | null;
  getSeriesArticles(seriesId: string): BlogArticle[];
  calculateReadingTime(text: string): number;
}

export const ContentRepository: ContentRepositoryInterface = {
  getArticles(filters = {}) {
    let list = [...BLOG_ARTICLES];

    if (filters.category && filters.category !== 'All') {
      list = list.filter(a => a.category.toLowerCase() === filters.category!.toLowerCase());
    }

    if (filters.tag) {
      list = list.filter(a => a.tags.includes(filters.tag!));
    }

    if (filters.authorId) {
      list = list.filter(a => a.authorId === filters.authorId);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(a => 
        a.title.toLowerCase().includes(q) || 
        a.description.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    if (filters.sort === 'popular') {
      // Simulate popularity sorting, e.g. featured first
      list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    } else if (filters.sort === 'featured') {
      list = list.filter(a => a.featured);
    } else {
      // newest by default
      list.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
    }

    return list;
  },

  getArticleBySlug(slug) {
    return BLOG_ARTICLES.find(a => a.slug === slug) || null;
  },

  getAuthorById(id) {
    return AUTHORS.find(a => a.id === id) || null;
  },

  getRelatedArticles(article, limit = 3) {
    // Score based related content engine
    const scored = BLOG_ARTICLES
      .filter(a => a.slug !== article.slug)
      .map(a => {
        let score = 0;
        if (a.category === article.category) score += 2;
        if (a.authorId === article.authorId) score += 1;
        const commonTags = a.tags.filter(t => article.tags.includes(t));
        score += commonTags.length * 3;
        
        // Add series booster
        if (article.seriesId && a.seriesId === article.seriesId) {
          score += 10;
        }

        return { article: a, score };
      });

    const related = scored
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.article);

    // fallback to newest if not enough matches
    if (related.length < limit) {
      const remainder = BLOG_ARTICLES
        .filter(a => a.slug !== article.slug && !related.some(r => r.slug === a.slug))
        .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
      return [...related, ...remainder].slice(0, limit);
    }

    return related.slice(0, limit);
  },

  getTemplates(category) {
    if (category) {
      return TEMPLATES.filter(t => t.category.toLowerCase() === category.toLowerCase());
    }
    return TEMPLATES;
  },

  getCaseStudies(industry) {
    if (industry) {
      return CASE_STUDIES.filter(c => c.industry.toLowerCase().includes(industry.toLowerCase()));
    }
    return CASE_STUDIES;
  },

  getProductUpdates() {
    return [...PRODUCT_UPDATES].sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
  },

  getGuides() {
    return GUIDES;
  },

  getGuideBySlug(slug) {
    return GUIDES.find(g => g.slug === slug) || null;
  },

  getComparisons() {
    return COMPARISONS;
  },

  getComparisonBySlug(slug) {
    return COMPARISONS.find(c => c.slug === slug) || null;
  },

  getSeries(id) {
    return SERIES.find(s => s.id === id) || null;
  },

  getSeriesArticles(seriesId) {
    return BLOG_ARTICLES
      .filter(a => a.seriesId === seriesId)
      .sort((a, b) => (a.seriesPart || 0) - (b.seriesPart || 0));
  },

  calculateReadingTime(text) {
    const wpm = 200;
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / wpm));
  }
};
