import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://app.workwise.co.ke';
  const now  = new Date();

  return [
    {
      url:              base,
      lastModified:     now,
      changeFrequency:  'weekly',
      priority:         1.0,
    },
    {
      url:              `${base}/pricing`,
      lastModified:     now,
      changeFrequency:  'monthly',
      priority:         0.9,
    },
    {
      url:              `${base}/auth/login`,
      lastModified:     now,
      changeFrequency:  'yearly',
      priority:         0.7,
    },
    {
      url:              `${base}/auth/register`,
      lastModified:     now,
      changeFrequency:  'yearly',
      priority:         0.8,
    },
  ];
}
