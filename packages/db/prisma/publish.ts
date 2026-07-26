import { PrismaClient } from '@prisma/client';
import { join } from 'node:path';
import { MediaStorage } from '@pressly/storage';

/**
 * Publish stories from the command line.
 *
 * This is the intended authoring path: write the story here, run the script,
 * and it is live. The Newsroom UI still exists for quick edits, but nothing
 * requires opening a browser to publish.
 *
 * Each story may carry one hero image — give it a local file path or a URL and
 * it goes through the same sharp pipeline the Newsroom upload uses (four widths
 * × JPEG + WebP). Omit `image` and the story publishes without one; the Reader
 * has a designed treatment for that case.
 *
 * Set `publishedAt` to backdate a story to its real publication date. A future
 * date schedules it instead — see the field's note.
 *
 *   pnpm db:publish
 *
 * Edit STORIES below, or import `publishStory` from your own script.
 */

/**
 * One block of an article body.
 *
 * A bare string is a paragraph, because that is what most of an article is and
 * quoting every line in an object would bury the writing in punctuation.
 * Everything else is a single-key object naming the block.
 *
 * Inside any string, `[label](href)` becomes a link — the one piece of inline
 * syntax worth supporting, since links are the only mark this publisher
 * actually needs and writing them as node trees by hand is unreadable.
 */
export type Block =
  | string
  | { h2: string }
  | { h3: string }
  | { list: string[] }
  | { ordered: string[] }
  | { quote: string; by?: string }
  | { table: { caption?: string; header: string[]; rows: string[][] } }
  | { rule: true };

export interface StoryInput {
  headline: string;
  /**
   * The article body. Plain strings are paragraphs; see `Block` for headings,
   * lists, tables and quotes. Converted to the same structured JSON Tiptap
   * produces, so a story published from here is indistinguishable from one
   * written in the Newsroom.
   */
  body: Block[];
  summary?: string;
  subheadline?: string;
  /**
   * The `<title>` tag, when it should differ from the headline. Headlines are
   * written to be read on the page; titles are written to be read in a result
   * list, where roughly 60 characters survive and the entity should come first.
   */
  seoTitle?: string;
  /** The `<meta name="description">`. Around 155 characters before truncation. */
  metaDescription?: string;
  /** Local file path or https URL. Omit for a story with no picture. */
  image?: string;
  imageAlt?: string;
  imageCredit?: string;
  /**
   * Shown under the hero. Use it to say what the photograph actually is —
   * particularly when it is illustrative rather than of the subject itself.
   */
  imageCaption?: string;
  /** Licence or source note, stored alongside the image. */
  imageUsageRights?: string;
  /** Topic slug, e.g. 'energy'. Must already exist. */
  topic?: string;
  /** ISO country code, e.g. 'ng'. Must already exist. */
  country?: string;
  language?: 'en' | 'ar' | 'fr' | 'de';
  /**
   * When the story was — or will be — published. Anything `new Date()` accepts:
   * '2026-03-14' (midnight UTC), '2026-03-14T09:30:00Z', or a Date. Defaults to
   * now.
   *
   * A date in the future schedules the story rather than publishing it: status
   * SCHEDULED with `publishAt` set, which `/api/cron/publish-due` releases when
   * it falls due. Backdating is the common case and just works — the Reader
   * orders by this field.
   */
  publishedAt?: string | Date;
  isBreaking?: boolean;
  articleType?: 'NEWS' | 'ANALYSIS' | 'OPINION' | 'FEATURE' | 'INTERVIEW' | 'BRIEFING';
}

function slugify(headline: string): string {
  return (
    headline
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || `story-${Date.now()}`
  );
}

/**
 * Splits `[label](href)` out of a string into text nodes carrying link marks.
 *
 * Relative hrefs stay in the tab — they are internal navigation. External ones
 * open in a new tab with `rel="noopener"`, deliberately without `noreferrer`:
 * the security concern is the opener reference, and stripping the referrer only
 * hides the citation from the site being credited.
 */
function inline(text: string) {
  const nodes: Array<Record<string, unknown>> = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push({ type: 'text', text: text.slice(last, match.index) });
    const [, label, href] = match;
    const external = /^https?:\/\//.test(href!);
    nodes.push({
      type: 'text',
      text: label,
      marks: [
        {
          type: 'link',
          attrs: external
            ? { href, target: '_blank', rel: 'noopener' }
            : { href },
        },
      ],
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) });
  return nodes;
}

const para = (text: string) => ({ type: 'paragraph', content: inline(text) });

function block(b: Block): Record<string, unknown> {
  if (typeof b === 'string') return para(b);
  if ('h2' in b) return { type: 'heading', attrs: { level: 2 }, content: inline(b.h2) };
  if ('h3' in b) return { type: 'heading', attrs: { level: 3 }, content: inline(b.h3) };
  if ('list' in b) {
    return {
      type: 'bulletList',
      content: b.list.map((item) => ({ type: 'listItem', content: [para(item)] })),
    };
  }
  if ('ordered' in b) {
    return {
      type: 'orderedList',
      content: b.ordered.map((item) => ({ type: 'listItem', content: [para(item)] })),
    };
  }
  if ('quote' in b) {
    return { type: 'pullQuote', attrs: { attribution: b.by }, content: inline(b.quote) };
  }
  if ('table' in b) {
    return {
      type: 'table',
      attrs: b.table.caption ? { caption: b.table.caption } : undefined,
      header: b.table.header,
      rows: b.table.rows,
    };
  }
  return { type: 'horizontalRule' };
}

function doc(blocks: Block[]) {
  return { type: 'doc', content: blocks.map(block) };
}

/** Every word in the body, links and table cells included. */
function plainText(blocks: Block[]): string {
  const strip = (s: string) => s.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1');
  return blocks
    .map((b) => {
      if (typeof b === 'string') return strip(b);
      if ('h2' in b) return strip(b.h2);
      if ('h3' in b) return strip(b.h3);
      if ('list' in b) return b.list.map(strip).join(' ');
      if ('ordered' in b) return b.ordered.map(strip).join(' ');
      if ('quote' in b) return strip(b.quote);
      if ('table' in b) {
        return [b.table.caption ?? '', ...b.table.header, ...b.table.rows.flat()].join(' ');
      }
      return '';
    })
    .join(' ');
}

/** ~200 words per minute, matching what the editor computes on save. */
function readingTime(blocks: Block[]): number {
  const words = plainText(blocks).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function readSource(pathOrUrl: string): Promise<Buffer> {
  if (/^https?:\/\//.test(pathOrUrl)) {
    const res = await fetch(pathOrUrl);
    if (!res.ok) throw new Error(`${res.status} fetching ${pathOrUrl}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return (await import('node:fs/promises')).readFile(pathOrUrl);
}

async function createMedia(
  prisma: PrismaClient,
  source: Buffer,
  meta: Pick<StoryInput, 'imageAlt' | 'imageCredit' | 'imageCaption' | 'imageUsageRights'>,
  uploaderId: string | undefined,
) {
  const storage = new MediaStorage({
    localDir:
      process.env.MEDIA_LOCAL_DIR ?? join(process.cwd(), '..', '..', 'apps', 'web', 'public'),
  });

  const id = crypto.randomUUID();
  const stored = await storage.upload(source, id);

  return prisma.media.create({
    data: {
      id,
      storageKey: stored.storageKey,
      filename: `${id}.${stored.mimeType.split('/')[1]}`,
      mimeType: stored.mimeType,
      size: stored.bytes,
      width: stored.width,
      height: stored.height,
      alt: meta.imageAlt ?? null,
      caption: meta.imageCaption ?? null,
      photographer: meta.imageCredit ?? null,
      usageRights: meta.imageUsageRights ?? null,
      uploadedById: uploaderId,
      processingStatus: 'READY',
      variants: stored.variants,
    },
  });
}

export async function publishStory(prisma: PrismaClient, story: StoryInput) {
  const [author, topic, country] = await Promise.all([
    prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } }),
    story.topic
      ? prisma.topic.findUnique({ where: { slug: story.topic }, select: { id: true } })
      : null,
    story.country
      ? prisma.country.findUnique({ where: { code: story.country }, select: { id: true } })
      : null,
  ]);

  if (story.topic && !topic) throw new Error(`No topic "${story.topic}" — run db:seed:taxonomy`);
  if (story.country && !country) throw new Error(`No country "${story.country}"`);

  let heroImageId: string | undefined;
  if (story.image) {
    const media = await createMedia(prisma, await readSource(story.image), story, author?.id);
    heroImageId = media.id;
  }

  const when = story.publishedAt ? new Date(story.publishedAt) : new Date();
  if (Number.isNaN(when.getTime())) {
    throw new Error(`Invalid publishedAt "${story.publishedAt}" on "${story.headline}"`);
  }
  const scheduled = when.getTime() > Date.now();

  const slug = slugify(story.headline);
  const data = {
    workingTitle: story.headline,
    headline: story.headline,
    subheadline: story.subheadline ?? null,
    summary: story.summary ?? null,
    seoTitle: story.seoTitle ?? null,
    metaDescription: story.metaDescription ?? null,
    bodyJson: doc(story.body),
    status: scheduled ? ('SCHEDULED' as const) : ('PUBLISHED' as const),
    publishAt: scheduled ? when : null,
    publishedAt: scheduled ? null : when,
    primaryLanguage: story.language ?? 'en',
    readingTime: readingTime(story.body),
    isBreaking: story.isBreaking ?? false,
    articleType: story.articleType ?? ('NEWS' as const),
    authorId: author?.id,
    topicId: topic?.id,
    countryId: country?.id,
    heroImageId,
  };

  // Upsert so re-running with an edited body updates the story in place rather
  // than failing on the unique slug.
  const article = await prisma.article.upsert({
    where: { slug },
    create: { ...data, slug },
    update: data,
    select: { slug: true },
  });

  return { slug: article.slug, scheduled, when };
}

/* ------------------------------------------------------------------------- */
/* Stories to publish. Edit this list, then `pnpm db:publish`.                */
/* ------------------------------------------------------------------------- */

/*
 * The two demo stories that lived here were removed with the rest of the seed
 * content. The shape, for reference:
 *
 *   {
 *     headline: 'Nigeria brings another substation online in Kwara',
 *     subheadline: 'Optional deck.',
 *     summary: 'One or two lines for cards and social.',
 *     publishedAt: '2026-03-14',        // real publication date; omit for now
 *     topic: 'energy',                  // slug, must exist
 *     country: 'ng',                    // ISO code, must exist
 *     language: 'en',                   // en | ar | fr | de
 *     articleType: 'NEWS',              // NEWS | ANALYSIS | OPINION | ...
 *     image: './ArticleFiles/kwara.jpg', // local path or URL; omit for none
 *     imageAlt: 'Transmission towers under an open sky.',
 *     imageCredit: 'Photographer name',
 *     body: ['First paragraph.', 'Second paragraph.'],
 *   }
 */
const SEC = 'https://www.se.com.sa/';

const STORIES: StoryInput[] = [
  {
    // The entity leads. "Three Hundred and Nine Towers Across Tabuk" was the
    // better line to read and the worse line to find: no company, no project,
    // no voltage — nothing anyone types into a search box. The original survives
    // as the deck, where it still does its work.
    headline: 'Samaya Group Completes the Tabuk 380 kV Transmission Line',
    subheadline: 'Three hundred and nine towers across 112.5 kilometres of northwestern Saudi Arabia.',
    // Both entities in ~60 characters, contractor first. "Saudi Electricity
    // Company" alone belongs to SEC's own domain and is not winnable; paired
    // with the project it is, and that pairing is what someone researching the
    // Tabuk line actually types.
    seoTitle: 'Tabuk 380 kV Line | Samaya Group for Saudi Electricity Company',
    metaDescription:
      'Samaya Group Company Ltd. delivered the 112.5 km Tabuk 380 kV double-circuit transmission line for Saudi Electricity Company — 309 towers, commissioned March 2022.',
    summary:
      'Samaya Group Company Ltd. delivered the Tabuk 380 kV double-circuit transmission line for Saudi Electricity Company between 2020 and 2022. Across 112.5 kilometres, the project combined six tower types, 34 major crossings and more than 2,700 kilometres of phase conductor into a new high-voltage corridor in northwestern Saudi Arabia.',
    publishedAt: '2022-03-24',
    topic: 'energy',
    country: 'sa',
    language: 'en',
    articleType: 'FEATURE',
    // Illustrative stock, not the Tabuk line — the caption says so on the page,
    // because a photograph on an article of verified facts must not imply it is
    // evidence. It does at least show what the piece describes: dead-end towers
    // with horizontal tension insulator strings beside suspension structures.
    image: 'https://images.unsplash.com/photo-1413882353314-73389f63b6fd?fm=jpg&q=80&w=2400&auto=format',
    imageAlt:
      'High-voltage lattice transmission towers carrying multiple circuits against a dusk sky.',
    imageCaption:
      'Illustrative: high-voltage lattice towers of the type used on double-circuit transmission corridors. Not a photograph of the Tabuk line.',
    imageCredit: 'Fré Sonneveld / Unsplash',
    imageUsageRights: 'Unsplash License',
    body: [
      // The opening paragraph is written to be lifted whole: every fact an
      // answer engine needs to attribute the project sits in one sentence,
      // before any narrative begins.
      `Samaya Group Company Ltd. built the Tabuk 380 kV double-circuit overhead transmission line for [Saudi Electricity Company](${SEC}) under an engineering, procurement and construction contract, beginning in March 2020 and completing commissioning on 24 March 2022. The line runs approximately 112.5 kilometres across the Tabuk region of northwestern Saudi Arabia and carries two 380 kV circuits into the country's Northern Grid.`,

      'A transmission line begins long before steel appears above the ground.',

      'For the Tabuk project, the first task was to turn a proposed route into 309 buildable tower positions. Each location had to be surveyed, investigated and connected to the construction programme before excavation, foundation work or tower erection could begin.',

      `Samaya Group's responsibility extended from route engineering and material procurement to civil works, installation, testing and final commissioning. The completed line includes the conductors, grounding, fibre-optic communications and protection systems required to operate as part of the Northern Grid.`,

      { h2: 'The contract Saudi Electricity Company awarded' },

      `[Saudi Electricity Company](${SEC}) awarded the Tabuk 380 kV overhead transmission line to Samaya Group Company Ltd. as an engineering, procurement and construction contract, with the letter of award issued in March 2020 and a contract duration of twenty-four months from commencement.`,

      'The line was specified as part of Saudi Electricity Company’s National Grid Reinforcement Programme. Its purpose was to raise the reliability, stability and transmission capacity of the high-voltage network in the north-west by interconnecting key substations within the Northern Grid, and to support growing electricity demand in the Tabuk region.',

      'Under an EPC arrangement the contractor carries the whole chain: design to SEC standards and international codes, procurement of every tower, conductor and fitting, all civil and erection works, and testing through to energisation. That is why a single company appears against scopes as different as geotechnical investigation and fibre-optic commissioning.',

      { h2: 'Turning a route into 309 construction sites' },

      'A transmission corridor may appear continuous on a map, but it is built as a series of individual sites.',

      'The Tabuk route was surveyed over approximately 113 kilometres before the final 112.5-kilometre alignment was established. Engineers had to account for elevation, ground conditions, route direction, access, electrical clearances and the roads, utilities and existing lines that the new corridor would encounter.',

      'Those decisions determined where each tower would stand and what type of structure would be required. A tower on a straight section carries a different set of forces from one placed at a major turn in the route. Ground conditions can also change from one position to the next, affecting excavation, reinforcement and foundation design.',

      'Route planning therefore influenced far more than the appearance of the finished line. It affected material quantities, access requirements, crossing locations, tower types and the order in which construction could proceed.',

      'By the time the alignment was approved, the project had become 309 separate engineering and logistical tasks connected by one programme.',

      { h2: 'Access before excavation' },

      'No tower position can progress until crews and equipment can reach it.',

      'The Tabuk project included more than 56 kilometres of access-road grading, together with drainage and culvert works along the corridor. These routes allowed excavators, concrete vehicles, cranes, tower components and conductor-stringing equipment to move between construction locations.',

      'Access work is not usually visible in photographs of a completed transmission line, but it can control the pace of the entire project. If a tower location cannot be reached, excavation cannot begin. If the foundation is delayed, tower erection must wait. If one structure remains incomplete, conductor stringing may be interrupted across several adjoining spans.',

      'This makes logistics part of the engineering problem. Across a route longer than 100 kilometres, progress depends on keeping multiple work fronts active while preserving the sequence each section requires.',

      { h2: 'The foundations beneath the line' },

      'The civil scope included approximately 4,582 cubic metres of foundation concrete and more than 700 tonnes of reinforcement steel. Most of that material is now below ground.',

      'At each tower position, crews had to excavate the site, install reinforcement and set the tower-base components accurately before concrete was placed. The foundations then needed enough time to gain strength before the steel structures could be erected.',

      'Accuracy at this stage was essential. A small positioning error at the base becomes more difficult to correct as a lattice tower rises. The foundations also have to carry the weight of the structure, withstand conductor tension and resist the forces created by wind and operating conditions.',

      'The towers dominate the completed landscape, but their stability depends on civil work that is largely hidden from view.',

      { h2: 'Six tower types for one transmission corridor' },

      'The 309 towers were selected according to their positions and functions along the route.',

      {
        table: {
          caption: 'Tower types on the Tabuk 380 kV line',
          header: ['Tower type', 'Quantity'],
          rows: [
            ['Suspension towers', '206'],
            ['Small-angle towers', '33'],
            ['Medium-angle towers', '23'],
            ['Heavy-angle towers', '19'],
            ['Transposition towers', '19'],
            ['Dead-end or terminal towers', '9'],
          ],
        },
      },

      'Suspension towers formed most of the corridor, carrying conductors through relatively straight sections. Angle towers were used where the line changed direction; the greater the turn, the greater the forces transferred to the tower and its foundation. Dead-end towers anchored the conductor system at terminal points and other locations where the full line tension had to be restrained.',

      // A definition written as its own sentence, in the form "X is a Y that
      // does Z" — the shape a retrieval model can lift without the surrounding
      // paragraph coming with it.
      'The 19 transposition towers served a different purpose. A transposition tower is a structure that changes the relative positions of the three phases along a transmission route. Over a long three-phase line each phase may otherwise occupy a different physical position relative to the others, creating small differences in electrical impedance. Rotating the phases balances those characteristics across the complete line.',

      'It is a feature most people would never notice from the ground, but it contributes directly to the line’s performance.',

      { h2: 'More than 2,700 kilometres of conductor' },

      'Once a continuous section of towers had been erected and inspected, conductor installation could begin.',

      'The Tabuk line uses a double-circuit, quad-bundle configuration. A quad bundle means each of the three phases in a circuit is carried by four sub-conductors rather than one, which reduces electrical losses and corona at 380 kV. Across the route, the scheduled phase-conductor quantity was approximately 2,781 kilometres.',

      'The conductors had to be pulled through successive spans under controlled tension. Their final sag and position had to remain within design limits while maintaining safe clearances from roads, utilities, existing lines and the ground below.',

      'The completed conductor system also relied on thousands of smaller components:',

      {
        list: [
          'insulator assemblies',
          'clamps and connection fittings',
          'armour rods',
          'spacer dampers',
          'vibration dampers',
          'grounding and lightning-protection equipment',
        ],
      },

      'Spacer dampers maintain the correct separation between the four sub-conductors in each bundle. Vibration dampers reduce repeated wind-driven movement that could damage conductor strands and fittings over time. These components are far smaller than the towers, but the line’s long-term reliability depends on them.',

      { h2: 'Thirty-four crossings along the route' },

      'The Tabuk transmission corridor crossed 17 roads, 11 utility and service corridors and six existing electrical lines or other special locations. Each of those 34 crossings required additional planning.',

      'Work above a road may need traffic management and temporary protection. Utility crossings must preserve safe separation from existing services. Work around an operational electrical line may depend on agreed procedures and limited outage periods.',

      'Crossings can therefore exert far more pressure on a project than their physical length suggests. The construction team may be ready, but work cannot proceed until permissions, access arrangements and protection measures are in place. A delay at one crossing can interrupt conductor stringing and testing across a much larger section of the route.',

      'For a linear project, managing the places where the new line meets existing infrastructure is as important as building the open sections between them.',

      { h2: 'Fibre-optic communications above the line' },

      'The Tabuk project was designed to carry both electricity and operational data.',

      'Approximately 116 kilometres of Optical Ground Wire, known as OPGW, were installed above the phase conductors, alongside a similar length of conventional earthwire. OPGW is a cable that serves two functions at once: its outer structure helps shield the line from direct lightning strikes, while fibre-optic strands inside it carry protection, control and communication data between different parts of the transmission network.',

      'Those fibre links support line monitoring, fault detection and the rapid exchange of protection signals. A transmission line must not only carry electricity; it must also be monitored and controlled as part of the wider grid. The Tabuk corridor therefore operates as both a power connection and a communications route.',

      { h2: 'What Samaya Group delivered' },

      'Samaya Group Company Ltd. was responsible for delivering the Tabuk 380 kV double-circuit transmission project from engineering through commissioning. Its scope included:',

      {
        list: [
          'route studies and detailed engineering',
          'material procurement',
          'access and civil works',
          'foundation construction',
          'tower supply and erection',
          'conductor and insulator installation',
          'grounding and lightning protection',
          'OPGW and fibre-optic communications',
          'testing and final grid integration',
        ],
      },

      'That work required coordination across several disciplines. Survey and engineering teams established the route. Civil crews prepared access and foundations. Structural teams erected six categories of towers. Electrical specialists installed conductors, insulators and line hardware. Telecommunications engineers completed the fibre-optic links. Quality, safety and commissioning teams then verified the completed system.',

      'Each discipline delivered one part of the project, but none could operate independently. The line could enter service only after all its structural, electrical and communication components had been brought together and tested as one system.',

      { h2: 'From mechanical completion to commissioning' },

      'A completed corridor of towers and conductors is not yet an operating transmission asset.',

      'The structures and fittings had to be inspected. Conductors, insulators and grounding systems required electrical testing. Fibre-optic connections and protection equipment had to exchange information correctly across the route.',

      `Mechanical completion was reached on 24 February 2022. Final commissioning followed on 24 March 2022, bringing the Tabuk 380 kV double-circuit transmission line into [Saudi Electricity Company](${SEC})'s Northern Grid.`,

      'That final stage changed the project from a collection of individual foundations, towers, conductors and communication systems into one functioning high-voltage connection.',

      { h2: 'What the Tabuk project demonstrates' },

      'The principal figures describe the scale of the project: approximately 112.5 kilometres of completed route, 309 tower positions, six tower categories, more than 2,700 kilometres of phase conductor, approximately 116 kilometres of OPGW, and 34 road, utility and special crossings.',

      'The figures do not fully describe the delivery challenge. The project depended on the accuracy of the route, the availability of access, the quality of the foundations, the sequence of tower erection, the management of crossings and the integration of electrical and communication systems across a widely distributed construction programme.',

      'Each stage created the conditions required for the next.',

      'The towers are the most visible result of the Tabuk transmission project. The more significant result is that 309 separate structures and their supporting systems were completed as one operating part of Saudi Arabia’s high-voltage transmission network.',

      { rule: true },

      {
        table: {
          caption: 'Tabuk 380 kV transmission project facts',
          header: ['Item', 'Detail'],
          rows: [
            ['Project', 'Tabuk 380 kV double-circuit overhead transmission line'],
            ['Contractor', 'Samaya Group Company Ltd.'],
            ['Client', 'Saudi Electricity Company'],
            ['Location', 'Tabuk Region, Saudi Arabia'],
            ['Completed route length', 'Approximately 112.5 kilometres'],
            ['Surveyed alignment', 'Approximately 113 kilometres'],
            ['Tower positions', '309'],
            ['Voltage', '380 kV'],
            ['Delivery model', 'Engineering, procurement and construction'],
            ['Project period', 'March 2020 to March 2022'],
            ['Mechanical completion', '24 February 2022'],
            ['Final commissioning', '24 March 2022'],
          ],
        },
      },
    ],
  },
];

/**
 * Drop the Reader's cache.
 *
 * This script writes to Postgres from outside the app, so it cannot call
 * `revalidateTag` itself. Without this the story is live on its own URL but
 * absent from the homepage until the cache window lapses — which looks exactly
 * like publishing silently failing.
 */
async function revalidate(slugs: string[]) {
  const base = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.log('\nREVALIDATE_SECRET not set — skipping cache invalidation.');
    console.log('Stories are live on their own URLs; listings refresh within 5 minutes.');
    return;
  }
  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ slugs }),
    });
    console.log(res.ok ? '\nReader cache invalidated.' : `\nRevalidate failed (${res.status}).`);
  } catch {
    console.log(`\nCould not reach ${base} to invalidate — is the site running?`);
  }
}

async function main() {
  const prisma = new PrismaClient();
  const published: string[] = [];
  try {
    for (const story of STORIES) {
      const { slug, scheduled, when } = await publishStory(prisma, story);
      const date = when.toISOString().slice(0, 16).replace('T', ' ');
      const picture = story.image ? 'with image' : 'no image';
      if (scheduled) {
        console.log(`scheduled  /en/article/${slug}  (${date} UTC, ${picture})`);
      } else {
        published.push(slug);
        console.log(`published  /en/article/${slug}  (${date} UTC, ${picture})`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  await revalidate(published);

  // Local disk only: `next start` resolves public/ against a build-time
  // snapshot, so an image written after the server booted 404s until it is
  // restarted. Cloudinary has no such problem — this note exists because the
  // symptom (article renders, image missing) is confusing on its own.
  const usingLocalDisk = !process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_CLOUD_NAME;
  if (usingLocalDisk && STORIES.some((s) => s.image)) {
    console.log('Images are on local disk — restart the dev server for them to appear.');
  }
}

if (process.argv[1]?.includes('publish')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
