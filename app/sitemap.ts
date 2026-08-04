import { MetadataRoute } from 'next';
import { ContentRepository } from '@/lib/resources/ContentRepository';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://dudo.ai';

  // Static URLs
  const staticUrls = [
    '',
    '/login',
    '/signup',
    '/resources',
    '/resources/blog',
    '/resources/templates',
    '/resources/product-updates',
    '/resources/guides',
    '/resources/compare'
  ].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'weekly' as const,
    priority: route === '' || route === '/resources' ? 1.0 : 0.8
  }));

  // Dynamic Blog posts URLs
  const blogUrls = ContentRepository.getArticles().map(article => ({
    url: `${baseUrl}/resources/blog/${article.slug}`,
    lastModified: new Date(article.publishDate).toISOString(),
    changeFrequency: 'monthly' as const,
    priority: 0.6
  }));

  // Dynamic Guides URLs
  const guideUrls = ContentRepository.getGuides().map(guide => ({
    url: `${baseUrl}/resources/guides/${guide.slug}`,
    lastModified: new Date(guide.publishDate).toISOString(),
    changeFrequency: 'monthly' as const,
    priority: 0.6
  }));

  // Dynamic Comparison URLs
  const compareUrls = ContentRepository.getComparisons().map(comp => ({
    url: `${baseUrl}/resources/compare/${comp.slug}`,
    lastModified: new Date(comp.publishDate).toISOString(),
    changeFrequency: 'monthly' as const,
    priority: 0.6
  }));

  return [...staticUrls, ...blogUrls, ...guideUrls, ...compareUrls];
}
