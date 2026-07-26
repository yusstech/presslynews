import type {
  Article,
  ArticleCard,
  AuthorSummary,
  CountrySummary,
  Media,
  TopicSummary,
} from '@pressly/types';
import { estimateReadingTimeMinutes } from '@pressly/types';

/**
 * In-memory seed content for the Reader while the API is built (Phase 4).
 * Query helpers below mimic the shape the API will later expose, so pages
 * won't change when the real data source lands.
 */

export const countries: Record<string, CountrySummary> = {
  sa: { id: 'c-sa', code: 'sa', name: 'Saudi Arabia', region: 'Middle East', defaultLanguage: 'ar' },
  ng: { id: 'c-ng', code: 'ng', name: 'Nigeria', region: 'West Africa', defaultLanguage: 'en' },
  sy: { id: 'c-sy', code: 'sy', name: 'Syria', region: 'Middle East', defaultLanguage: 'ar' },
  fr: { id: 'c-fr', code: 'fr', name: 'France', region: 'Europe', defaultLanguage: 'fr' },
  de: { id: 'c-de', code: 'de', name: 'Germany', region: 'Europe', defaultLanguage: 'de' },
};

export const topics: Record<string, TopicSummary> = {
  energy: { id: 't-energy', slug: 'energy', name: 'Energy' },
  world: { id: 't-world', slug: 'world', name: 'World' },
  business: { id: 't-business', slug: 'business', name: 'Business' },
  technology: { id: 't-tech', slug: 'technology', name: 'Technology' },
  culture: { id: 't-culture', slug: 'culture', name: 'Culture' },
};

export const authors: Record<string, AuthorSummary> = {
  layla: { id: 'a-layla', name: 'Layla Haddad', slug: 'layla-haddad' },
  daniel: { id: 'a-daniel', name: 'Daniel Okafor', slug: 'daniel-okafor' },
  sophie: { id: 'a-sophie', name: 'Sophie Bernard', slug: 'sophie-bernard' },
  markus: { id: 'a-markus', name: 'Markus Weber', slug: 'markus-weber' },
};

function img(seed: string): Media {
  return {
    id: `m-${seed}`,
    storageKey: `${seed}.jpg`,
    filename: `${seed}.jpg`,
    mimeType: 'image/jpeg',
    size: 0,
    width: 1200,
    height: 800,
    alt: '',
    processingStatus: 'READY',
    variants: {
      original: `https://picsum.photos/seed/${seed}/1600/1067`,
      large: `https://picsum.photos/seed/${seed}/1200/800`,
      tablet: `https://picsum.photos/seed/${seed}/900/600`,
      mobile: `https://picsum.photos/seed/${seed}/640/427`,
      thumb: `https://picsum.photos/seed/${seed}/240/160`,
    },
  };
}

interface SeedArticle extends Omit<Article, 'readingTime'> {}

const raw: SeedArticle[] = [
  {
    id: 'art-1',
    slug: 'saudi-arabia-grid-expansion',
    headline: 'Saudi Arabia accelerates its high-voltage grid across the north',
    subheadline:
      'New transmission lines from Tabuk to Al Jouf aim to move renewable power to where it is needed.',
    summary:
      'A wave of high-voltage transmission projects is reshaping how electricity moves across the Kingdom, connecting solar and wind capacity in the north to demand centres further south.',
    status: 'PUBLISHED',
    articleType: 'ANALYSIS',
    isBreaking: false,
    primaryLanguage: 'en',
    country: countries.sa,
    topic: topics.energy,
    author: authors.layla,
    heroImage: { id: 'm-grid', alt: 'Transmission towers at dusk', variants: img('grid').variants },
    publishedAt: '2026-07-22T08:00:00.000Z',
    body: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Across the northern provinces, a new generation of transmission lines is quietly changing the shape of Saudi Arabia’s power system. The projects connecting Tabuk and Al Jouf are among the most ambitious, designed to carry renewable electricity over long distances with minimal loss.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Why the north matters' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'The Kingdom’s best solar and wind resources sit far from its largest cities. Moving that power efficiently is an engineering problem as much as a political one.',
            },
          ],
        },
        {
          type: 'pullQuote',
          attrs: { attribution: 'Ministry of Energy briefing' },
          content: [
            { type: 'text', text: 'The grid is the quiet backbone of the energy transition.' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Engineers describe the work as unglamorous but decisive. ',
            },
            {
              type: 'text',
              text: 'Without the lines, the panels are stranded.',
              marks: [{ type: 'italic' }],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'art-2',
    slug: 'nigeria-substation-milestone',
    headline: 'Kwara substation reaches a milestone for Nigeria’s rural grid',
    subheadline: 'A notarised handover marks progress in extending reliable power beyond the cities.',
    summary:
      'The newly certified substation in Kwara is a small but meaningful step in Nigeria’s long effort to bring dependable electricity to underserved regions.',
    status: 'PUBLISHED',
    articleType: 'NEWS',
    isBreaking: true,
    primaryLanguage: 'en',
    country: countries.ng,
    topic: topics.energy,
    author: authors.daniel,
    heroImage: { id: 'm-sub', alt: 'Electrical substation', variants: img('substation').variants },
    publishedAt: '2026-07-23T14:30:00.000Z',
    body: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'The certification of the Kwara substation, attested and notarised this week, closes a chapter that began years ago with a simple promise: steadier power for communities that have long lived with its absence.',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'For the engineers on site, the paperwork is the least visible part of the work — but it is what turns a structure into infrastructure.',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'art-3',
    slug: 'daraa-reconstruction-power',
    headline: 'إعادة بناء شبكة الكهرباء في درعا خطوة بخطوة',
    subheadline: 'مشروع محطة تحويل جديد يعيد التيار إلى مناطق تضررت خلال سنوات الحرب.',
    summary:
      'يمثل مشروع محطة درعا محاولة هادئة لإعادة الخدمات الأساسية إلى منطقة أنهكتها سنوات من الصراع.',
    status: 'PUBLISHED',
    articleType: 'FEATURE',
    isBreaking: false,
    primaryLanguage: 'ar',
    country: countries.sy,
    topic: topics.energy,
    author: authors.layla,
    heroImage: { id: 'm-daraa', alt: 'خطوط الكهرباء', variants: img('daraa').variants },
    publishedAt: '2026-07-21T10:00:00.000Z',
    body: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'في درعا، يعمل المهندسون على إعادة وصل ما انقطع. محطة التحويل الجديدة ليست مجرد منشأة تقنية، بل وعد بعودة الحياة الطبيعية إلى أحياء عاشت طويلاً في العتمة.',
            },
          ],
        },
        {
          type: 'pullQuote',
          content: [{ type: 'text', text: 'الكهرباء هي أول علامات عودة الحياة.' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'يقول أحد العاملين في الموقع إن كل عمود يُنصب هو خطوة نحو استقرار أطول.',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'art-4',
    slug: 'europe-energy-market-shift',
    headline: 'La France repense son marché de l’électricité',
    subheadline: 'Un débat calme mais décisif sur la manière de tarifer une énergie plus propre.',
    summary:
      'Alors que l’Europe ajuste ses règles, la France cherche un équilibre entre prix stables et transition rapide.',
    status: 'PUBLISHED',
    articleType: 'ANALYSIS',
    isBreaking: false,
    primaryLanguage: 'fr',
    country: countries.fr,
    topic: topics.business,
    author: authors.sophie,
    heroImage: { id: 'm-eu', alt: 'Lignes électriques', variants: img('europe').variants },
    publishedAt: '2026-07-20T09:00:00.000Z',
    body: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Le débat semble technique, mais ses conséquences toucheront chaque foyer. La façon dont l’électricité est tarifée façonne la vitesse de la transition.',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'art-5',
    slug: 'germany-industrial-power',
    headline: 'Deutschlands Industrie sucht nach stabilem Strom',
    subheadline: 'Zwischen Klimazielen und Wettbewerbsfähigkeit wächst der Druck auf das Netz.',
    summary:
      'Die deutsche Industrie steht vor einer heiklen Balance: saubere Energie zu verlässlichen Preisen.',
    status: 'PUBLISHED',
    articleType: 'NEWS',
    isBreaking: false,
    primaryLanguage: 'de',
    country: countries.de,
    topic: topics.business,
    author: authors.markus,
    heroImage: { id: 'm-de', alt: 'Industrieanlage', variants: img('germany').variants },
    publishedAt: '2026-07-19T16:00:00.000Z',
    body: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Für die deutsche Industrie ist verlässlicher Strom keine Nebensache, sondern die Grundlage ihrer Zukunft.',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'art-6',
    slug: 'quiet-technology-of-the-grid',
    headline: 'The quiet technology holding the modern grid together',
    subheadline: 'Software, not steel, increasingly decides how reliably the lights stay on.',
    summary:
      'A new layer of control software is becoming as important to the grid as the cables themselves.',
    status: 'PUBLISHED',
    articleType: 'FEATURE',
    isBreaking: false,
    primaryLanguage: 'en',
    country: countries.ng,
    topic: topics.technology,
    author: authors.daniel,
    heroImage: { id: 'm-tech', alt: 'Control room', variants: img('control').variants },
    publishedAt: '2026-07-18T11:00:00.000Z',
    body: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'The most important upgrades to the grid are increasingly invisible: lines of code that balance supply and demand in real time.',
            },
          ],
        },
      ],
    },
  },
];

const articles: Article[] = raw.map((a) => ({
  ...a,
  readingTime: estimateReadingTimeMinutes(a.body),
}));

const toCard = (a: Article): ArticleCard => {
  const { body, status, seoTitle, metaDescription, sources, relatedArticleIds, ...card } = a;
  void body;
  void status;
  void seoTitle;
  void metaDescription;
  void sources;
  void relatedArticleIds;
  return card;
};

// ─── Query helpers (mirror the future API surface) ───────────────────────────

export function getAllArticles(): Article[] {
  return [...articles].sort(
    (a, b) => Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? ''),
  );
}

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getHomeData() {
  const all = getAllArticles();
  const hero = all[0];
  if (!hero) throw new Error('No articles available');
  const rest = all.slice(1);
  return {
    hero,
    breaking: all.filter((a) => a.isBreaking),
    latest: rest.slice(0, 5).map(toCard),
    editorsPicks: all.filter((a) => a.articleType === 'FEATURE').map(toCard),
    topics: Object.values(topics),
    countries: Object.values(countries),
  };
}

export function getArticlesByCountry(code: string): ArticleCard[] {
  return getAllArticles()
    .filter((a) => a.country?.code === code)
    .map(toCard);
}

export function getArticlesByTopic(slug: string): ArticleCard[] {
  return getAllArticles()
    .filter((a) => a.topic?.slug === slug)
    .map(toCard);
}

export function getRelated(article: Article, limit = 3): ArticleCard[] {
  return getAllArticles()
    .filter((a) => a.id !== article.id && a.topic?.slug === article.topic?.slug)
    .slice(0, limit)
    .map(toCard);
}

export function searchArticles(query: string): ArticleCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getAllArticles()
    .filter((a) =>
      [a.headline, a.subheadline, a.summary, a.country?.name, a.topic?.name, a.author?.name]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    )
    .map(toCard);
}

export { toCard };
