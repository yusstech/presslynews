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
/**
 * Client sites, linked where each client is named.
 *
 * Checked before use: `se.com.sa` and `rea.gov.ng` answer 200; `tcn.org.ng`
 * answers 406 to a bare curl and 200 to a browser, which is a WAF rule rather
 * than an outage. `moe.gov.sy` is HTTP only — its HTTPS certificate has
 * expired, so linking the https form would send readers to a warning page.
 * `moenergy.gov.sa` could not be reached from the machine that published this,
 * most likely geo-blocking, so it is linked on the client's word rather than a
 * verified fetch.
 */
const SEC = 'https://www.se.com.sa/';
const MOE_SA = 'https://www.moenergy.gov.sa/en';
const PETDE_SY = 'http://moe.gov.sy/';
const REA_NG = 'https://rea.gov.ng/';
const TCN_NG = 'https://www.tcn.org.ng/';

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
    // Hero already uploaded (Fré Sonneveld / Unsplash, photo-1413882353314).
    // `image` is omitted deliberately: every run of this script uploads afresh
    // and mints a new Media row, so leaving it set would orphan the old one on
    // Cloudinary each time an unrelated story is published. With it absent,
    // `heroImageId` stays undefined and Prisma leaves the existing hero alone.
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

  /* --------------------------------------------------------------------- */

  {
    headline: 'Samaya Group Completes the Al-Jawf 380 kV Transmission Line',
    subheadline: 'Two hundred and seventy-nine towers across 107 kilometres of the Tabarjal area.',
    seoTitle: 'Al-Jawf 380 kV Line | Samaya Group for Saudi Ministry of Energy',
    metaDescription:
      'Samaya Group Company Ltd. delivered the 107 km Al-Jawf 380 kV double-circuit transmission line for Saudi Arabia’s Ministry of Energy — 279 towers, completed September 2023.',
    summary:
      'Samaya Group Company Ltd. delivered the 107-kilometre Al-Jawf 380 kV double-circuit transmission line for Saudi Arabia’s Ministry of Energy between 2021 and 2023, linking hundreds of separate work locations into one high-voltage corridor across the Tabarjal area.',
    // Project Completion Confirmation Letter, ref MOE/TRANSMISSION/2023/0930.
    publishedAt: '2023-09-30',
    topic: 'energy',
    country: 'sa',
    language: 'en',
    articleType: 'FEATURE',
    image: 'https://images.unsplash.com/photo-1606901900840-f3dba75bcd47?fm=jpg&q=80&w=2400&auto=format',
    imageAlt: 'A tall lattice transmission tower carrying multiple circuits against a bright sky.',
    imageCaption:
      'Illustrative: a multi-circuit lattice transmission tower. Not a photograph of the Al-Jawf line.',
    imageCredit: 'Yuan Yang / Unsplash',
    imageUsageRights: 'Unsplash License',
    body: [
      `Samaya Group Company Ltd. built the Al-Jawf 380 kV double-circuit overhead transmission line for [Saudi Arabia’s Ministry of Energy](${MOE_SA}) under an engineering, procurement and construction contract, beginning in August 2021 and completing in September 2023. The line runs approximately 107 kilometres across 279 tower positions in the Tabarjal area of the Al-Jawf region.`,

      'The Al-Jawf transmission project was built across 279 tower positions spread over approximately 107 kilometres.',

      'Each location had to be surveyed, reached and prepared before construction could move forward. Foundations came first, followed by the steel structures, conductors, earthwire, fibre-optic systems and protection equipment needed to turn a series of individual sites into one operating transmission line.',

      { h2: 'The contract the Ministry of Energy awarded' },

      `The [Ministry of Energy](${MOE_SA}) issued its letter of award on 1 August 2021, and the contract took effect on 12 August. It covered engineering, procurement and construction in full: detailed design, supply and transportation of materials, civil works, tower manufacture and erection, conductor tensioning, OPGW and fibre-optic installation, protection and communication systems, testing, and connection to the national grid.`,

      'A single contractor carrying that whole chain is what allows scopes as different as topographical survey and fibre-optic commissioning to appear against one name.',

      { h2: 'Establishing the route across Al-Jawf' },

      'A transmission line begins with the route. Before any tower can be erected, engineers must determine where the line should pass, where each structure should stand and how construction teams will reach the individual sites.',

      'For the Al-Jawf 380 kV transmission project, that required detailed engineering, topographical surveying and route planning across the Tabarjal area. The alignment had to account for ground conditions, changes in direction, existing roads and services, electrical clearances and the practical movement of crews, materials and heavy equipment.',

      'These early decisions shaped almost every stage that followed. A straighter section could use a suspension tower. A change in direction required a stronger angle structure capable of resisting additional mechanical forces. Ground conditions influenced the foundation design, while access determined whether excavation equipment, concrete vehicles, cranes and tower components could reach the site.',

      'By the time construction began, the 107-kilometre corridor had already been divided into hundreds of individual engineering and logistical decisions.',

      { h2: 'Distance was part of the engineering problem' },

      'The Al-Jawf line was not built from one central construction site. Work progressed across several locations at the same time.',

      'At one point along the route, crews could be preparing a foundation. Farther ahead, another team might be assembling a tower. On a completed section, conductor stringing could already be under way.',

      'That created a strict sequence. Access had to be available before excavation could begin. Foundations had to be completed and sufficiently cured before tower erection. A continuous section of structures had to be ready before conductors could be installed through it. Testing could only begin after the electrical, communication and protection systems had been completed.',

      'On a project extending more than 100 kilometres, a delay rarely remains isolated. A late foundation affects tower erection. One incomplete tower can interrupt work across several spans. A delayed crossing can hold up conductor installation and testing across an entire section.',

      'Keeping the route moving therefore depended on coordination as much as construction.',

      { h2: 'What supported the 279 towers' },

      'The towers are the most visible part of the line, but their performance depends on the work beneath them.',

      'Each structure required excavation, reinforcement, concrete and accurately positioned tower-base components. Those foundations had to carry the weight of the steelwork while resisting the forces transferred through the conductors.',

      'The requirements were not identical at every location. A suspension tower on a straight section experiences different loads from an angle or terminal structure. Foundation design had to respond to the tower type, the conductor forces and the conditions at the site.',

      'Accuracy was essential. Small errors at foundation level become more difficult to correct as the steel structure rises. The base positions therefore had to be surveyed and checked before erection could proceed.',

      { h2: 'Building the Al-Jawf tower corridor' },

      'The 279 towers formed the physical route of the project, and different structures were used for different parts of the alignment.',

      'Suspension towers carried the conductors through straighter sections of the route. Angle towers were used where the line changed direction and the structures had to resist the pull of conductors approaching from different sides. Terminal or dead-end towers anchored the conductor system at the ends of the line and at other positions where greater mechanical restraint was needed.',

      'Together, these structures allowed the line to follow the approved alignment while maintaining the clearances and stability required for a 380 kV system.',

      'As more towers were completed and inspected, the project gradually changed from a series of separate construction sites into a continuous transmission corridor.',

      { h2: 'Installing the conductor system' },

      'The Al-Jawf line carries two high-voltage electrical circuits along the same route. Conductors were installed across successive tower spans under controlled tension, and their final position had to meet design requirements for sag, clearance and mechanical performance.',

      'The conductor system also relied on thousands of smaller components:',

      {
        list: [
          'insulator assemblies',
          'conductor clamps',
          'connection fittings',
          'spacers',
          'vibration-control equipment',
          'earthing systems',
          'lightning-protection components',
        ],
      },

      'Insulators support the conductors while separating the live electrical system from the steel towers. Spacers maintain the required arrangement between bundled conductors. Vibration dampers reduce repeated wind-driven movement that could damage cables and fittings over time.',

      'Individually, these components are far less visible than the towers. Collectively, they are essential to the line’s reliability.',

      { h2: 'Fibre-optic communications along the route' },

      'The Al-Jawf transmission corridor was built to carry both electricity and operational data.',

      'Optical Ground Wire, commonly known as OPGW, runs above the phase conductors. OPGW is a cable that does two jobs at once: its outer structure performs the shielding role of a conventional earthwire, helping protect the line from direct lightning strikes, while fibre-optic strands inside it carry protection, control and communication data across the network.',

      'These fibre links support:',

      {
        list: [
          'system monitoring',
          'protection signalling',
          'fault detection',
          'operational data exchange',
          'communication between different parts of the grid',
        ],
      },

      'A modern high-voltage line must do more than move electricity. It must be monitored, protected and controlled as part of a wider system. The OPGW and associated communications equipment allowed the Al-Jawf line to function as part of Saudi Arabia’s national transmission network rather than as an isolated physical connection.',

      { h2: 'What Samaya Group delivered' },

      'Samaya Group Company Ltd. was responsible for the engineering, procurement and construction of the Al-Jawf 380 kV double-circuit transmission line. Its scope covered:',

      {
        list: [
          'detailed engineering',
          'route and topographical surveys',
          'material procurement',
          'civil and foundation works',
          'tower supply and erection',
          'conductor and insulator installation',
          'OPGW and fibre-optic systems',
          'protection and communication equipment',
          'testing and commissioning',
          'final integration with the grid',
        ],
      },

      'Delivering that scope required several disciplines to work across the same programme. Surveyors established the route and tower locations. Civil crews prepared access and foundations. Structural teams erected the towers. Electrical specialists installed the conductor system. Telecommunications engineers completed the fibre and protection links. Quality, safety and commissioning teams verified the completed work.',

      'Each group delivered a different part of the project, but the line could only enter service when those parts operated together.',

      { h2: 'Testing and grid integration' },

      'Completing the physical line was not the final stage. The structures, conductors, insulators, grounding systems, fibre links and protection equipment all had to be inspected and tested before the system could enter operation.',

      'Mechanical checks confirmed that towers and fittings had been installed correctly. Electrical testing assessed the conductors, insulation and earthing arrangements. Communication and protection testing confirmed that data could move correctly across the route and that the line could operate as part of the wider network.',

      'By September 2023, the 279 tower positions had become one completed 380 kV double-circuit transmission corridor connected to Saudi Arabia’s national electricity network.',

      { h2: 'Al-Jawf’s place in Saudi Arabia’s energy system' },

      'Al-Jawf has become an increasingly important region within Saudi Arabia’s wider energy landscape. The region hosts major generation projects, including the Sakaka solar plant and the Dumat Al-Jandal wind farm, which form part of a broader shift in how electricity is produced across the Kingdom.',

      'Generation, however, is only one side of the system. Electricity must also be moved between power plants, substations and areas of demand, and that requires high-capacity transmission infrastructure capable of carrying large volumes of power over long distances.',

      'The Al-Jawf project added approximately 107 kilometres of 380 kV transmission infrastructure to that wider network. Its role was not limited to the towers and conductors visible along the route; it also included the protection, communication and control systems needed for reliable operation across the national grid.',

      { h2: 'What the Al-Jawf project demonstrates' },

      'The project can be described through a few principal figures: approximately 107 kilometres of route, 279 tower positions, two 380 kV circuits, high-voltage conductors and insulator systems, OPGW and fibre-optic communications, protection and monitoring equipment, and testing, commissioning and grid integration.',

      'Those figures describe the scale, but not the full delivery challenge. The project depended on route selection, access, foundation accuracy, material logistics, tower sequencing, conductor installation and communication-system integration across a widely distributed work front.',

      'Each stage created the conditions required for the next.',

      'The most visible result is the line of towers across Al-Jawf. The more significant result is that 279 separate structures and their supporting systems were completed as one operating part of Saudi Arabia’s high-voltage transmission network.',

      { rule: true },

      {
        table: {
          caption: 'Al-Jawf 380 kV transmission project facts',
          header: ['Item', 'Detail'],
          rows: [
            ['Project', 'Al-Jawf 380 kV double-circuit overhead transmission line'],
            ['Contractor', 'Samaya Group Company Ltd.'],
            ['Client', 'Ministry of Energy, Kingdom of Saudi Arabia'],
            ['Location', 'Al-Jawf Region, Tabarjal, Saudi Arabia'],
            ['Route length', 'Approximately 107 kilometres'],
            ['Tower positions', '279'],
            ['Voltage', '380 kV'],
            ['Delivery model', 'Engineering, procurement and construction'],
            ['Letter of award', '1 August 2021'],
            ['Project period', 'August 2021 to September 2023'],
          ],
        },
      },
    ],
  },

  /* --------------------------------------------------------------------- */

  {
    headline: 'ICCO Completes the Rural Damascus–Daraa 400 kV Transmission Line',
    subheadline: 'What lay beneath 321 towers across southern Syria.',
    seoTitle: 'Rural Damascus–Daraa 400 kV Line | ICCO for PETDE Syria',
    metaDescription:
      'International Consolidated Contractors Offshore SAL delivered the 107 km Rural Damascus–Daraa 400 kV double-circuit transmission line for PETDE — 321 towers, handed over February 2021.',
    summary:
      'International Consolidated Contractors Offshore SAL delivered the 107-kilometre Rural Damascus–Daraa 400 kV double-circuit transmission line between 2018 and 2021. Across 321 tower positions, the project brought together route engineering, access works, foundations, high-voltage conductors, fibre-optic communications and final grid integration across southern Syria.',
    // Final handover, following mechanical completion on 26 January 2021.
    publishedAt: '2021-02-18',
    topic: 'energy',
    country: 'sy',
    language: 'en',
    articleType: 'FEATURE',
    image: 'https://images.unsplash.com/photo-1552772588-12592fc15a64?fm=jpg&q=80&w=2400&auto=format',
    imageAlt: 'A lattice transmission tower on open ground carrying conductors across a hillside.',
    imageCaption:
      'Illustrative: a double-circuit lattice transmission tower on open ground. Not a photograph of the Rural Damascus–Daraa line.',
    imageCredit: 'Thomas Despeyroux / Unsplash',
    imageUsageRights: 'Unsplash License',
    body: [
      `International Consolidated Contractors Offshore SAL built the Rural Damascus–Daraa 400 kV double-circuit overhead transmission line for Syria’s [Public Establishment for Transmission and Distribution of Electricity](${PETDE_SY}), under a supply and execution contract referred in July 2018. The line runs approximately 107 kilometres across 321 tower positions in the Rif Damascus and Daraa governorates, reaching mechanical completion in January 2021 and final handover on 18 February 2021.`,

      'The Rural Damascus–Daraa transmission project was built from the ground up.',

      'Before the steel towers could rise across the route, each of the 321 proposed positions had to be surveyed, investigated and prepared for construction. Access had to be created. Excavations had to be completed. Foundations had to be designed around the loads imposed by different tower types and the conditions found at each location.',

      'Only after that work could the structures, conductors and communication systems begin to form one continuous 400 kV transmission corridor.',

      { h2: 'A transmission route made up of 321 sites' },

      'A 107-kilometre transmission line may appear as a single project on a map, but it is constructed as hundreds of separate work locations. Each tower position had to fit within the wider electrical design while responding to its own local conditions.',

      'The route had to account for:',

      {
        list: [
          'changes in direction',
          'ground conditions',
          'road and service crossings',
          'access for machinery and materials',
          'electrical clearances',
          'conductor span lengths',
          'tower loading and foundation requirements',
        ],
      },

      'The alignment included 321 tower positions across approximately 107 kilometres. That produces an average span of about 334 metres, although the actual distance between structures varied according to terrain, direction changes, crossings and engineering requirements.',

      'Route planning shaped nearly every part of the project that followed. It determined where heavier structures were needed, how construction teams would move along the corridor and which sections could progress into tower erection and conductor installation.',

      { h2: 'Ground investigation before foundation work' },

      'A transmission foundation cannot be designed properly without understanding the ground beneath it. The project included ground investigations across the proposed tower positions, together with topographical surveying along the full route.',

      'This was necessary because a long transmission corridor does not pass through one uniform type of ground. Excavation conditions may change from one position to the next. Some locations may require deeper or heavier foundations. Others may need additional treatment to achieve the required structural or electrical performance.',

      'The civil scope included substantial quantities of ordinary excavation and rock excavation, together with concrete, reinforcement steel, tower-base construction, backfilling and compaction. These activities represented far more than site preparation: they established the structural base on which the entire line depended.',

      { h2: 'The work below ground' },

      'Much of the construction effort is now hidden beneath the completed towers.',

      {
        table: {
          caption: 'Civil quantities across the route',
          header: ['Item', 'Quantity'],
          rows: [
            ['Ordinary excavation', 'Approximately 38,000 m³'],
            ['Rock excavation', 'Approximately 4,200 m³'],
            ['Plain concrete', 'More than 1,800 m³'],
            ['Reinforced concrete', '16,800 m³'],
            ['Reinforcement steel', '2,550 tonnes'],
            ['Backfilling and compaction', '32,000 m³'],
            ['Above-ground base necks', '1,284 (four per tower)'],
          ],
        },
      },

      'At each position, reinforcement had to be installed and tower-base components aligned accurately before concrete placement.',

      'That accuracy was essential. A small error at foundation level becomes more difficult to correct once the lattice structure is assembled above it. The foundation must also resist the weight of the tower, the pull of the conductors and the forces created by wind and operating conditions.',

      'By the time the towers became visible, some of the project’s most important work had already been completed.',

      { h2: 'Four tower types across southern Syria' },

      'The 321 towers were selected according to their positions and functions along the route.',

      {
        table: {
          caption: 'Tower types on the Rural Damascus–Daraa line',
          header: ['Tower type', 'Quantity'],
          rows: [
            ['Straight suspension towers', '230'],
            ['Medium-corner towers', '70'],
            ['Heavy-tension towers', '17'],
            ['Terminal towers', '4'],
          ],
        },
      },

      'Suspension towers formed most of the line, carrying conductors through relatively straight sections. Corner towers were used where the alignment changed direction; these structures had to resist greater transverse forces created by conductors pulling from different angles.',

      'Heavy-tension towers provided additional restraint at positions carrying higher mechanical loads. Terminal towers anchored the conductor system at the line ends, where the full tension of the circuits had to be contained.',

      'The distribution of tower types allowed the route to follow its approved alignment while maintaining the structural stability and electrical clearances required for a 400 kV system.',

      { h2: 'Access as part of construction' },

      'No tower position can progress without a route for people, materials and equipment to reach it. The project included approximately 42 kilometres of temporary and permanent access-road work.',

      'Working platforms were also established around tower positions to provide space for excavation, reinforcement, concrete placement, steel assembly and lifting operations. Drainage works were included at selected locations, while areas used during construction were prepared for rehabilitation after the main work was completed.',

      'These activities are less visible than towers and conductors, but they can control the programme. An inaccessible tower position cannot move into excavation. A delayed foundation prevents tower erection. One incomplete structure can interrupt conductor stringing across several adjoining spans.',

      'On a 107-kilometre route, access is not simply a logistical convenience. It is part of the construction strategy.',

      { h2: 'Building the conductor system' },

      'Once sufficient sections of the tower corridor had been completed and inspected, conductor installation could begin.',

      'The line uses two 400 kV circuits, each made up of three electrical phases. Each phase was carried by a bundle of four sub-conductors, producing 24 conductor paths across the route. The project included approximately 2,568 kilometres of phase conductor.',

      'Installing that quantity required controlled pulling and tensioning across successive tower spans. The conductors had to achieve their required sag while maintaining safe clearances from roads, services, the ground and other infrastructure.',

      'The conductor system also included:',

      {
        list: [
          '1,380 suspension-insulator strings',
          '546 tension and corner-insulator strings',
          '8,200 bundle spacers',
          '5,400 vibration dampers',
          '642 corona-ring and arcing-horn assemblies',
        ],
      },

      'Bundle spacers maintain separation between the four sub-conductors within each phase. Vibration dampers reduce repeated wind-driven movement that could weaken conductor strands or fittings over time. Insulator assemblies carry the conductors while separating the live system from the steel towers.',

      'These smaller components are easy to overlook, but the long-term reliability of the line depends on them.',

      { h2: 'Earthing at every tower position' },

      'Every one of the 321 structures required a reliable connection to earth. Tower earthing provides a controlled path for lightning and fault currents to enter the ground; if the resistance is too high, electrical stress can build across the structure and insulation system.',

      'The project included standard earthing systems and resistance testing at all tower positions. Eighty-four towers required additional counterpoise conductors and enhanced earthing arrangements.',

      'That indicates the standard design was not sufficient at every location along the route. The need for additional treatment could only be confirmed by testing the conditions found at the individual tower positions, which made earthing another area where route-wide assumptions had to give way to location-specific engineering.',

      { h2: 'Fibre-optic communications along the line' },

      'The Rural Damascus–Daraa transmission corridor carries more than electrical power. Above the phase conductors run approximately 107 kilometres of conventional earthwire and a similar length of Optical Ground Wire, or OPGW.',

      'OPGW performs two functions. Its outer structure helps shield the line from direct lightning strikes, while fibre-optic strands within the cable carry protection, control and communication data between different parts of the network.',

      'The system included fibre joint boxes, splicing, terminations and optical testing along the route. These communication links allow protection systems to exchange information quickly and enable the line to be monitored as part of the wider electricity network.',

      'A modern transmission asset must therefore combine structural, electrical and digital infrastructure within one operating system.',

      { h2: 'What ICCO delivered' },

      'International Consolidated Contractors Offshore SAL was responsible for the design, supply and execution of the line. Its scope included:',

      {
        list: [
          'route and topographical engineering',
          'ground investigation',
          'access-road and platform construction',
          'excavation and reinforced-concrete foundations',
          'tower supply and erection',
          'conductor and insulator installation',
          'earthing and lightning protection',
          'OPGW and fibre-optic communications',
          'testing and grid connection',
        ],
      },

      'Survey and geotechnical teams established the tower positions and ground conditions. Civil crews prepared access and foundations. Structural teams erected the towers. Electrical specialists installed the conductors, insulators and earthing systems. Telecommunications engineers completed the fibre links. Quality, safety and commissioning teams verified the completed installation.',

      'Each team delivered a different part of the project, but the line could only enter service when those parts operated together.',

      { h2: 'Testing the completed 400 kV system' },

      'The final stage extended beyond checking whether every tower was standing. The full route had to be inspected and tested as one system.',

      'Concrete and material testing formed part of the quality process during construction. Tower alignment and structural installation had to be verified. Conductors, insulators and earthing systems required electrical checks. The OPGW and fibre-optic links also had to be tested to confirm that protection and communication data could move correctly along the route.',

      'Mechanical completion was reached on 26 January 2021. Final handover followed on 18 February 2021 after testing, grid connection and the completion of the project’s operating systems.',

      'That process transformed 321 individual construction locations into one functioning high-voltage transmission corridor across southern Syria.',

      { h2: 'What the Rural Damascus–Daraa project demonstrates' },

      'The principal figures describe the project’s scale: approximately 107 kilometres of route, 321 tower positions, two 400 kV circuits, more than 2,500 kilometres of phase conductor, approximately 107 kilometres of OPGW, extensive excavation, reinforced concrete and access works, and enhanced earthing at 84 tower positions.',

      'The figures also show why transmission construction cannot be understood from route length and tower count alone. Ground conditions affect excavation, foundations and earthing. Access determines whether construction can reach the individual sites. Tower type influences structural loading. Conductor installation depends on a continuous sequence of completed structures. Communications and protection systems must operate alongside the electrical line before the asset can enter service.',

      'The completed towers are the most visible result of the project. The work beneath and between them is what made the line possible.',

      { rule: true },

      {
        table: {
          caption: 'Rural Damascus–Daraa 400 kV transmission project facts',
          header: ['Item', 'Detail'],
          rows: [
            ['Project', 'Rural Damascus–Daraa 400 kV double-circuit overhead transmission line'],
            ['Contractor', 'International Consolidated Contractors Offshore SAL'],
            ['Client', 'Public Establishment for Transmission and Distribution of Electricity'],
            ['Location', 'Rif Damascus and Daraa governorates, southern Syria'],
            ['Route length', 'Approximately 107 kilometres'],
            ['Tower positions', '321'],
            ['Voltage', '400 kV'],
            ['Delivery model', 'Supply and execution'],
            ['Contract period', 'August 2018 to February 2021'],
            ['Mechanical completion', '26 January 2021'],
            ['Final handover', '18 February 2021'],
          ],
        },
      },
    ],
  },

  /* --------------------------------------------------------------------- */

  {
    headline: 'ICCO Delivers the Kwara 330 kV Transmission Substation',
    subheadline: 'Two 150 MVA transformers, six 330 kV bays and a variable reactor on one greenfield site.',
    seoTitle: 'Kwara 330/132/33 kV Substation | ICCO for Nigeria’s REA',
    metaDescription:
      'International Consolidated Contractors Offshore SAL delivered a greenfield 330/132/33 kV transmission substation in Kwara State for Nigeria’s Rural Electrification Agency, commissioned 9 January 2025.',
    summary:
      'International Consolidated Contractors Offshore SAL delivered a new 330/132/33 kV transmission substation in Kwara State for Nigeria’s Rural Electrification Agency. At its centre are two 150 MVA transformers, six 330 kV bays, a variable line reactor and the control systems that allow electricity to move safely through the site.',
    // "Completed and commissioned on 09 January 2025" — REA completion
    // certificate, ref REA/KSS/RCA/NREAG46133673-25-09.
    publishedAt: '2025-01-09',
    topic: 'energy',
    country: 'ng',
    language: 'en',
    articleType: 'FEATURE',
    image: 'https://images.unsplash.com/photo-1509390673020-a5b2450e33f1?fm=jpg&q=80&w=2400&auto=format',
    imageAlt:
      'A high-voltage substation switchyard with steel gantries, busbars, disconnectors and surge arresters.',
    imageCaption:
      'Illustrative: a high-voltage switchyard of the type described here. Not a photograph of the Kwara substation.',
    imageCredit: 'American Public Power Association / Unsplash',
    imageUsageRights: 'Unsplash License',
    body: [
      `International Consolidated Contractors Offshore SAL designed and built a greenfield 330/132/33 kV transmission substation at Kwara State, Nigeria, for the [Rural Electrification Agency](${REA_NG}). The facility was completed and commissioned on 9 January 2025, with two 150 MVA power transformers, four 330 kV line bays, two 330 kV transformer bays and a 25–62 MVAr variable line reactor.`,

      'Electricity enters the Kwara substation at 330 kilovolts.',

      'Before it can continue through lower-voltage networks, it passes through a chain of equipment designed to transform, measure, switch, protect and control it.',

      'Four line bays provide the main entry and exit points. Two transformer bays connect the incoming high-voltage system to a pair of 150 MVA power transformers. A variable reactor manages voltage conditions on the network. Around them, circuit breakers, disconnectors, protection relays, fibre links, batteries and control systems remain ready to respond whenever operating conditions change.',

      'The result is not simply a collection of large electrical equipment. It is one coordinated system.',

      { h2: 'Power enters through the line bays' },

      'A transmission substation needs controlled points through which electricity can enter and leave. At Kwara, that function is handled by four 330 kV line bays.',

      'Each bay brings together the equipment needed to manage one high-voltage connection. Circuit breakers can interrupt current when a fault occurs or when a section must be taken out of service. Disconnectors provide physical isolation for maintenance. Current and voltage transformers supply measurements to the metering and protection systems.',

      'The bays allow operators to control individual connections without unnecessarily removing the entire substation from service. That separation is essential in a transmission network: a problem affecting one line should be isolated quickly and precisely, while unaffected equipment remains available wherever possible.',

      'The line bays feed into the wider busbar arrangement, which provides the common electrical connection through which power is directed towards the transformers and other parts of the site.',

      { h2: 'Two transformers change the role of the electricity' },

      'At the centre of the facility are two 150 MVA, 330/132/33 kV power transformers, together providing 300 MVA of installed transformation capacity.',

      'Their task is to receive electricity at the transmission level and reduce it to voltages suitable for onward movement through other parts of the network. This is where the substation changes the role of the electricity: at 330 kV, power can be moved efficiently over long distances; at 132 kV and 33 kV, it can be directed into networks operating closer to regional and local demand.',

      'Using two transformers also gives operators greater flexibility than relying on a single unit. Loading can be shared, maintenance can be planned around available equipment, and the system has more options when one transformer is unavailable.',

      'The transformers are connected through two dedicated 330 kV transformer bays, each equipped with the switching, measurement and protection devices required to control the connection safely.',

      { h2: 'The equipment built to interrupt power' },

      'Most of the time, the substation’s high-voltage equipment allows electricity to flow. Its most important moments may come when that flow must be stopped.',

      'Circuit breakers are designed to interrupt large fault currents within fractions of a second. Protection systems identify abnormal conditions and determine which breaker should operate. Disconnectors then provide visible isolation once the current has been interrupted. Surge arresters protect equipment from sudden voltage increases. Instrument transformers provide the measurements used by relays, control systems and meters. Busbars distribute power between the connected lines, transformers and reactor.',

      'None of these devices works in isolation. A breaker is only useful if the protection system sends the correct command. A relay can only make the correct decision if its measurements are accurate. Operators can only understand the event if the communications and recording systems preserve what happened.',

      'The reliability of the substation therefore depends on coordination between equipment that performs very different functions.',

      { h2: 'A reactor that responds to changing voltage' },

      'The Kwara substation includes a 330 kV variable line reactor rated between 25 and 62 MVAr. Its role is different from that of the power transformers.',

      'Long transmission lines can generate excess reactive power, particularly when they are lightly loaded, which can push system voltage above the desired operating range. The reactor absorbs part of that reactive power.',

      'Because it is variable, its level of compensation can be adjusted as network conditions change. That gives operators greater control than a fixed reactor would provide. At one point in the day, the line may be carrying a high load; at another, demand may fall while the line remains energised. The reactor allows the network to respond to those changes without treating every operating condition as though it were the same.',

      'Its dedicated 330 kV bay gives it the switching, isolation and protection needed to operate as an integrated part of the substation.',

      { h2: 'The control room sees what the equipment is doing' },

      'The largest objects on the site are outside. The decisions that control them are made through the substation automation and control systems.',

      'The Kwara facility includes a complete Substation Automation System, SCADA, protection, metering, disturbance recording and telecommunications infrastructure.',

      'SCADA gives operators a live view of the substation. It displays breaker positions, transformer loading, voltage measurements, alarms and other operating information, and it allows authorised commands to be issued remotely or from the control room.',

      'Protection relays monitor the electrical system continuously. When a fault is detected, they analyse the measurements and determine which equipment should be disconnected. Disturbance recorders capture detailed information around unusual events, which engineers can later use to understand the sequence, verify that the protection systems responded correctly and identify any required adjustments.',

      'Telecommunications systems connect the Kwara substation to other facilities and network-control centres, allowing data and protection signals to move beyond the site.',

      'The steel structures and transformers make the substation physically possible. The automation systems make it observable and controllable.',

      { h2: 'What happens when normal power is lost' },

      'A substation cannot depend entirely on the electricity passing through it. Its control, protection and communication systems must continue working during faults and other disturbances.',

      'The Kwara facility therefore includes auxiliary AC and DC systems, battery banks and battery chargers. The battery-backed DC supply keeps essential equipment available when the normal station supply is interrupted: protection relays remain active, breakers can still receive trip commands, and alarms and communication systems continue to operate.',

      'These systems are rarely noticed during normal operation. Their importance becomes clear when normal operation fails.',

      'Lighting, fire detection and fire-protection systems provide additional support for personnel and equipment across the site. The substation’s resilience therefore depends not only on the main transformers and high-voltage switchgear, but also on the smaller systems designed to remain available in an emergency.',

      { h2: 'The physical site beneath the electrical system' },

      'The Kwara project was developed as a greenfield substation, so the electrical installation had to be supported by a complete new physical site. That included:',

      {
        list: [
          'equipment and transformer foundations',
          'steel support structures',
          'a control building',
          'internal roads',
          'drainage',
          'cable trenches and ducts',
          'perimeter fencing',
          'earthing and lightning protection',
        ],
      },

      'Cable trenches provide organised routes for protection, control and communication cables, keeping the wiring accessible while separating it from the high-voltage equipment above. The site-wide earthing grid provides a path for fault current and helps maintain safer voltage conditions around equipment and areas where personnel work.',

      'Drainage protects foundations, roads and cable systems from water accumulation. The control building provides a secure environment for relays, automation equipment, communications systems, batteries and operating personnel.',

      'These elements do not transform or switch electricity, but the substation could not operate safely without them.',

      { h2: 'Bringing every system into operation' },

      'Commissioning a transmission substation is not one final test. It is a sequence of checks carried out across individual equipment and then across the complete installation.',

      'Major components undergo factory acceptance testing before delivery. After installation, site acceptance testing confirms that the equipment has been assembled, wired and configured correctly. Transformers, breakers, disconnectors, instrument transformers, protection relays, batteries, communication links and control systems must all be tested.',

      'The protection settings must match the network design. Breaker commands must reach the correct equipment. SCADA displays must reflect the actual condition of the site. Fibre and telecommunications links must carry data correctly. Alarms must appear when expected.',

      'Only after these individual checks are complete can the facility be tested as one operating substation.',

      { h2: 'The test that begins after commissioning' },

      'A commissioning date proves that a facility was ready to enter service. Continued operation is a different test.',

      'From here, the Kwara substation moves beyond installation and energisation into routine network service. Its equipment must now respond repeatedly to changing load, switching instructions, voltage conditions and maintenance requirements.',

      'The transformers must carry power within their operating limits. The reactor must respond to network conditions. Protection systems must remain available without operating unnecessarily. SCADA and telecommunications must continue to provide accurate information.',

      'That is the more meaningful measure of a completed substation: not whether each item could operate once during commissioning, but whether transformers, breakers, relays, batteries, fibre links and control systems continue to behave as one facility every day the network calls on them.',

      { rule: true },

      {
        table: {
          caption: 'Inside the Kwara substation',
          header: ['System', 'Installed capacity or equipment'],
          rows: [
            ['Main facility', 'One 330/132/33 kV greenfield transmission substation'],
            ['Power transformation', 'Two 150 MVA transformers'],
            ['Total transformation capacity', '300 MVA'],
            ['Incoming and outgoing connections', 'Four 330 kV line bays'],
            ['Transformer connections', 'Two 330 kV transformer bays'],
            ['Voltage management', 'One variable 25–62 MVAr line reactor'],
            ['Operational intelligence', 'Substation Automation System and SCADA'],
            ['Protection and monitoring', 'Protection, control, metering and disturbance recording'],
            ['Communications', 'Integrated telecommunications systems'],
            ['Supporting systems', 'AC/DC supplies, batteries, lighting and fire protection'],
            ['Contractor', 'International Consolidated Contractors Offshore SAL'],
            ['Client', 'Rural Electrification Agency'],
            ['Commissioned', '9 January 2025'],
          ],
        },
      },
    ],
  },

  /* --------------------------------------------------------------------- */

  {
    headline: 'ICCO Delivers the Nnewi 800 MVA Transmission Substation',
    subheadline: 'Four transformers, three switchyards and a digital control architecture on one site in Anambra State.',
    seoTitle: 'Nnewi 330/132/33 kV Substation | ICCO for TCN Nigeria',
    metaDescription:
      'International Consolidated Contractors Offshore SAL delivered the Nnewi 330/132/33 kV transmission substation for the Transmission Company of Nigeria — 800 MVA across four transformers, in operation June 2023.',
    summary:
      'International Consolidated Contractors Offshore SAL delivered the Nnewi 330/132/33 kV transmission substation for the Transmission Company of Nigeria, combining four power transformers, three switchyards, reactor facilities and a fully automated control system at one site in Anambra State.',
    // Contract awarded 17 May 2021 (TCN/GM(P)/NOA/0331-021/17-05-2021) with a
    // 24-month period; commercial operation 1 June 2023.
    publishedAt: '2023-06-01',
    topic: 'energy',
    country: 'ng',
    language: 'en',
    articleType: 'FEATURE',
    image: 'https://images.unsplash.com/photo-1509390144018-eeaf65052242?fm=jpg&q=80&w=2400&auto=format',
    imageAlt:
      'A large oil-filled power transformer with bushings, radiator bank and marshalling cabinets at a substation.',
    imageCaption:
      'Illustrative: a high-voltage power transformer of the type installed at sites like this. Not a photograph of the Nnewi substation.',
    imageCredit: 'American Public Power Association / Unsplash',
    imageUsageRights: 'Unsplash License',
    body: [
      `International Consolidated Contractors Offshore SAL designed and built the Nnewi 330/132/33 kV transmission substation in Anambra State for the [Transmission Company of Nigeria](${TCN_NG}), under a contract awarded in May 2021. The facility entered commercial operation on 1 June 2023 with four power transformers totalling 800 MVA, switchyards at three voltage levels, fixed and variable reactor facilities and a fully automated control system.`,

      'The defining feature of the Nnewi transmission substation is not a single transformer or switchyard. It is the number of options built into the facility.',

      'Electricity can enter through multiple 330 kV line bays. It can be transformed through two 300 MVA autotransformers and two 100 MVA power transformers. It can be directed through 330 kV, 132 kV and 33 kV switchyards. Voltage conditions can be managed through fixed and variable reactor facilities. Protection, automation and telecommunications systems monitor the entire arrangement.',

      'The result is a substation designed around capacity, flexibility and control.',

      { h2: 'Four transformers, two different duties' },

      'The Nnewi substation contains four major power transformers. Two are rated at 300 MVA, 330/132/33 kV. The other two are rated at 100 MVA, 132/33 kV. Together, they provide 800 MVA of installed transformation capacity.',

      'The larger 300 MVA units receive power from the 330 kV transmission level and reduce it for movement through the 132 kV and 33 kV networks. The two 100 MVA transformers operate between 132 kV and 33 kV, adding further capacity for power to move from the regional transmission system into lower-voltage networks.',

      'This arrangement gives the substation more than one transformation path. Rather than depending on a single pair of units to perform every function, the facility can manage different voltage transitions through equipment designed for separate roles.',

      'That matters during periods of high demand, planned maintenance or equipment unavailability, when operators have more options for managing load and organising the flow of electricity through the station.',

      'The transformers are equipped with cooling systems, on-load tap changers, protection, control and auxiliary systems. On-load tap changers allow transformer voltage ratios to be adjusted while the units remain energised, which helps operators maintain the required output voltage as network conditions change.',

      { h2: 'Three switchyards on one site' },

      'The Nnewi project includes complete switchyards at 330 kV, 132 kV and 33 kV. Each performs the same broad function at a different level of the electricity network: it receives connections, directs power and allows individual lines or equipment to be isolated.',

      {
        table: {
          caption: 'Switchyard configuration by voltage level',
          header: ['Switchyard', 'Bays'],
          rows: [
            ['330 kV', '10 line bays, 2 transformer bays, 1 shunt-reactor bay (75 MVAr), 2 variable line-reactor facilities (25–62 MVAr)'],
            ['132 kV', '8 line bays, 4 transformer bays, 2 bus-sectionalising bays'],
            ['33 kV', '6 line bays, 2 transformer bays, 1 bus-coupler bay'],
          ],
        },
      },

      'The ten 330 kV line bays give the station multiple high-voltage connection points, and the transformer bays connect the two 300 MVA autotransformers to the 330 kV system.',

      'At 132 kV, the sectionalising bays allow the busbar to be divided into separate operating sections. This gives operators greater flexibility when carrying out maintenance or responding to a fault: one part of the switchyard can be isolated while another section remains available. At 33 kV, the bus coupler allows separate busbar sections to be connected or divided as required.',

      'Across all three voltage levels, the switchyards give the facility a wide range of possible operating configurations.',

      { h2: 'Why the bays matter' },

      'A substation bay is more than a physical space between steel structures. It is a controlled connection containing the equipment needed to switch, isolate, measure and protect a line, transformer or reactor.',

      'The project included disconnect switches, grounding switches, post insulators, surge arresters and instrument transformers across the 330 kV, 132 kV and 33 kV systems.',

      'Circuit breakers interrupt current when a fault occurs or equipment must be removed from service. Disconnect switches provide visible isolation after the breaker has interrupted the current. Grounding switches connect isolated equipment safely to earth during maintenance. Current and voltage transformers provide measurements to protection relays, meters and control systems. Surge arresters protect equipment against sudden voltage increases caused by lightning or switching events.',

      'A large substation can only operate safely when these devices respond in the correct order. The bay layout gives each connection its own switching and protection arrangement, allowing faults to be isolated without unnecessarily removing unaffected equipment from service.',

      { h2: 'Voltage control beyond the transformers' },

      'The Nnewi substation includes both fixed and variable reactor facilities. A 75 MVAr shunt reactor provides a fixed level of reactive-power absorption, and two variable line reactors can operate between 25 and 62 MVAr.',

      'High-voltage transmission lines can generate excess reactive power, particularly when they are lightly loaded, which can raise voltage beyond the desired operating range. Reactors absorb part of that reactive power.',

      'The variable units can adjust their response as network conditions change, giving operators more precise control than a fixed reactor alone. This becomes especially useful in a station connected to several transmission circuits, where the amount of voltage support required may differ according to which lines are energised, how heavily they are loaded and how power is moving through the wider network.',

      { h2: 'Connecting Nnewi to the existing grid' },

      'The project also included 330 kV line-in, line-out connection works.',

      'A line-in, line-out arrangement — often shortened to LILO — allows an existing transmission line to be brought into a new substation and then returned to the wider route. Instead of constructing an entirely separate long-distance line, the existing circuit is diverted through the new facility.',

      'The Nnewi connection works included line-entry gantries, transmission-line structures, terminations, Optical Ground Wire interfaces and other associated equipment. The gantries provide the physical transition between the overhead line and the substation equipment. The line terminations connect the incoming conductors to the switchyard. OPGW interfaces carry the fibre-optic communication channels associated with the transmission line into the station’s protection and telecommunications systems.',

      'This connection work placed the Nnewi substation within the operating network rather than leaving it as a standalone installation.',

      { h2: 'A digital substation architecture' },

      'The physical equipment at Nnewi is supported by an integrated Substation Automation System. The project included:',

      {
        list: [
          'SCADA',
          'remote terminal units',
          'protection systems',
          'control and metering',
          'an IEC 61850 communication network',
          'telecommunications systems',
          'an interface with the National Control Centre',
        ],
      },

      'IEC 61850 provides a standard framework for communication between intelligent electronic devices within a substation. Protection relays, bay-control units, meters and other equipment can exchange information over the station network rather than depending entirely on conventional point-to-point wiring.',

      'SCADA gives operators a view of the site’s operating condition. It displays breaker and disconnector positions, transformer loading, voltage measurements, alarms and other information, and it allows authorised control commands to be issued from the station or a remote control centre.',

      'The National Control Centre interface extends that visibility beyond Nnewi, allowing the facility to be monitored as part of the wider transmission system.',

      { h2: 'Protection begins with system studies' },

      'Protection settings cannot be selected in isolation. They depend on how current and voltage are expected to behave across the network during normal operation and during faults.',

      'The project included power-system studies covering load flow, short-circuit conditions, grid-code compliance, protection coordination, relay settings and fault levels.',

      'Load-flow studies examine how electricity is expected to move through the system under different operating arrangements. Short-circuit studies calculate the current that could flow during faults, helping engineers select equipment ratings and protection settings. Protection-coordination studies determine how relays and breakers should operate in sequence, with the objective of isolating the smallest affected section while keeping the rest of the network available.',

      'These studies turn a collection of protection devices into a coordinated defence system.',

      { h2: 'The systems that remain active during a fault' },

      'The substation includes complete auxiliary AC and DC systems, covering station-service transformers, uninterruptible power supplies, battery banks, battery chargers, diesel generators, HVAC systems and other supporting facilities.',

      'Battery-backed DC power is essential because breakers, relays, alarms and communication equipment must continue working during a fault or loss of normal station supply. The uninterruptible power system supports sensitive equipment that cannot tolerate interruption, and diesel generators provide another level of backup for essential station services.',

      'HVAC systems maintain operating conditions inside control, relay and battery rooms, where heat, dust and humidity can affect equipment performance.',

      'These auxiliary systems are rarely the largest items on site, but they allow the substation to remain controllable when the external network is under stress.',

      { h2: 'Protection beyond the electrical fault' },

      'The Nnewi facility also includes security, fire-detection and equipment-protection systems. CCTV and access control help manage movement around the site, while fire-detection and firefighting installations address risks within the control buildings and around major electrical equipment.',

      'The transformers and reactors are supported by explosion-prevention and fire-protection systems. Large transformers contain substantial volumes of insulating oil, and under severe internal fault conditions rapid pressure increases can create the risk of tank rupture and fire. Explosion-prevention systems are designed to detect and respond to those conditions before they escalate.',

      'Oil-containment facilities, drainage, perimeter fencing and lightning protection form part of the wider site-safety arrangement. The protection philosophy therefore extends beyond electrical relays: it includes people, equipment, buildings and the physical environment of the station.',

      { h2: 'Building the site around the equipment' },

      'The Nnewi substation was developed with the complete civil and structural infrastructure required for operation, including reinforced-concrete foundations, control buildings, cable trenches and ducts, internal roads, drainage, transformer bund walls, oil-containment facilities, earthing grids, perimeter fencing, and steel gantries and busbar supports.',

      'The foundations had to support transformers, switchgear, reactors and steel structures with different loading requirements. Cable trenches created organised routes for protection, control, metering and communication cables. Transformer bund walls and oil-containment facilities were designed to control the spread of insulating oil in the event of leakage or equipment failure. The earthing grid provided a controlled path for fault current while helping maintain safer voltage conditions across areas accessible to personnel.',

      'Every major electrical system depended on this physical infrastructure being completed accurately before installation and testing could progress.',

      { h2: 'From individual equipment to one operating station' },

      'International Consolidated Contractors Offshore SAL was responsible for bringing the complete facility into operation. The work covered engineering, procurement, civil construction, transformer installation, switchyards, reactor facilities, line connections, automation, protection, telecommunications, security systems and auxiliary services.',

      'Factory acceptance tests were carried out before major equipment was delivered. Site acceptance testing then confirmed that installed equipment, wiring, protection settings and communication systems operated correctly within the completed arrangement. Pre-commissioning checks were followed by commissioning, reliability testing, operator training and preparation of as-built documentation.',

      'On 1 June 2023, the Nnewi 330/132/33 kV transmission substation entered commercial operation.',

      'That date matters less than what follows it. The final test of a substation begins after commissioning: the station must continue to switch lines, transform power, manage voltage and respond to faults through different network conditions over time.',

      'At Nnewi, that responsibility is shared across four transformers, three switchyards, multiple reactor facilities and a digital control architecture designed to make them function as one grid node.',

      { rule: true },

      {
        table: {
          caption: 'Nnewi substation system map',
          header: ['System', 'Installed equipment'],
          rows: [
            ['Main facility', '330/132/33 kV transmission substation'],
            ['330/132/33 kV transformation', 'Two 300 MVA autotransformers'],
            ['132/33 kV transformation', 'Two 100 MVA power transformers'],
            ['Total transformation capacity', '800 MVA'],
            ['330 kV switchyard', '10 line bays, 2 transformer bays'],
            ['132 kV switchyard', '8 line bays, 4 transformer bays, 2 bus-sectionalising bays'],
            ['33 kV switchyard', '6 line bays, 2 transformer bays, 1 bus-coupler bay'],
            ['Fixed voltage control', 'One 75 MVAr shunt reactor'],
            ['Variable voltage control', 'Two 25–62 MVAr line-reactor facilities'],
            ['Grid connection', '330 kV line-in, line-out connection works'],
            ['Automation', 'SAS, SCADA, RTUs and IEC 61850 network'],
            ['Contractor', 'International Consolidated Contractors Offshore SAL'],
            ['Client', 'Transmission Company of Nigeria'],
            ['Location', 'Nnewi, Anambra State, Nigeria'],
            ['Commercial operation', '1 June 2023'],
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
