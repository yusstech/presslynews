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
  /**
   * Local file path or https URL. Omit for a story with no picture.
   *
   * Ignored when the story already has a hero image — re-running this script to
   * edit a body is routine, and re-ingesting the source every time would upload
   * a fresh copy to Cloudinary and orphan the previous one on each run. Set
   * `replaceImage` to actually swap the picture.
   */
  image?: string;
  /** Re-ingest `image` even though the story already has a hero. */
  replaceImage?: boolean;
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
      // Apostrophes vanish rather than separate: "Nigeria's Grid" is
      // "nigerias-grid", not "nigeria-s-grid". Both straight and typographic,
      // since headlines are written with the latter.
      .replace(/['’]/g, '')
      // NFKD splits an accented letter into its base plus a combining mark. The
      // base is what we want; the mark is not a letter, so without this the
      // next rule turns it into a separator and "Réseau" becomes "re-seau".
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70)
      // A trailing hyphen can reappear after the slice.
      .replace(/-$/, '') || `story-${Date.now()}`
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

  const slug = slugify(story.headline);
  const existing = await prisma.article.findUnique({
    where: { slug },
    select: { heroImageId: true },
  });

  // Keep the hero the story already has. Editing a published body means running
  // this script again, and ingesting the source each time would upload a
  // duplicate to Cloudinary and leave the previous Media row orphaned — once
  // per re-run, silently.
  let heroImageId = existing?.heroImageId ?? undefined;
  if (story.image && (!heroImageId || story.replaceImage)) {
    const media = await createMedia(prisma, await readSource(story.image), story, author?.id);
    heroImageId = media.id;
  }

  const when = story.publishedAt ? new Date(story.publishedAt) : new Date();
  if (Number.isNaN(when.getTime())) {
    throw new Error(`Invalid publishedAt "${story.publishedAt}" on "${story.headline}"`);
  }
  const scheduled = when.getTime() > Date.now();

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
 * Checked before use: `rea.gov.ng` answers 200; `tcn.org.ng` answers 406 to a
 * bare curl and 200 to a browser, which is a WAF rule rather than an outage.
 */
const REA_NG = 'https://rea.gov.ng/';
const TCN_NG = 'https://www.tcn.org.ng/';

/**
 * Sources for the two market analyses below.
 *
 * Unlike the project records — which come from notarised completion
 * certificates the client holds — these pieces are assembled from public
 * reporting, so every figure in them is attributed in the body and linked here.
 * Where a number reaches us through a trade publication rather than the
 * institution itself, the text says so; that distinction is the difference
 * between analysis and assertion.
 *
 * Checked before use: `worldbank.org`, `jica.go.jp` and `cbn.gov.ng` all
 * answer 200.
 *
 * `afdb.org` and `imf.org` answer 403 — or, for the IMF, a 308 loop — to curl
 * even with a browser user-agent. That is a WAF or geo rule rather than an
 * outage, the same behaviour `tcn.org.ng` shows above; both resolve normally in
 * a browser. They are linked on that basis rather than on a verified fetch from
 * this machine, which is worth knowing before anyone "fixes" a supposedly dead
 * link.
 */
const WORLD_BANK = 'https://www.worldbank.org/';
const IMF = 'https://www.imf.org/';
const CBN = 'https://www.cbn.gov.ng/';
const AFDB = 'https://www.afdb.org/';
const JICA = 'https://www.jica.go.jp/english/';

const STORIES: StoryInput[] = [
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
      `International Consolidated Contractors Offshore SAL designed and built a [greenfield](/en/glossary#greenfield) 330/132/33 kV transmission substation at Kwara State, Nigeria, for the [Rural Electrification Agency](${REA_NG}). The facility was completed and commissioned on 9 January 2025, with two 150 MVA power transformers, four 330 kV line bays, two 330 kV transformer bays and a 25–62 MVAr variable line reactor.`,

      'Electricity enters the Kwara substation at 330 kilovolts.',

      'Before it can continue through lower-voltage networks, it passes through a chain of equipment designed to transform, measure, switch, protect and control it.',

      'Four [line bays](/en/glossary#bay) provide the main entry and exit points. Two transformer bays connect the incoming high-voltage system to a pair of 150 MVA power transformers. A variable reactor manages voltage conditions on the network. Around them, circuit breakers, disconnectors, [protection relays](/en/glossary#protection-relay), fibre links, batteries and control systems remain ready to respond whenever operating conditions change.',

      'The result is not simply a collection of large electrical equipment. It is one coordinated system.',

      { h2: 'Power enters through the line bays' },

      'A transmission substation needs controlled points through which electricity can enter and leave. At Kwara, that function is handled by four 330 kV line bays.',

      'Each bay brings together the equipment needed to manage one high-voltage connection. Circuit breakers can interrupt current when a fault occurs or when a section must be taken out of service. Disconnectors provide physical isolation for maintenance. Current and voltage transformers supply measurements to the metering and protection systems.',

      'The bays allow operators to control individual connections without unnecessarily removing the entire substation from service. That separation is essential in a transmission network: a problem affecting one line should be isolated quickly and precisely, while unaffected equipment remains available wherever possible.',

      'The line bays feed into the wider [busbar](/en/glossary#busbar) arrangement, which provides the common electrical connection through which power is directed towards the transformers and other parts of the site.',

      { h2: 'Two transformers change the role of the electricity' },

      'At the centre of the facility are two 150 MVA, 330/132/33 kV [power transformers](/en/glossary#power-transformer), together providing 300 MVA of installed transformation capacity.',

      'Their task is to receive electricity at the transmission level and reduce it to voltages suitable for onward movement through other parts of the network. This is where the substation changes the role of the electricity: at 330 kV, power can be moved efficiently over long distances; at 132 kV and 33 kV, it can be directed into networks operating closer to regional and local demand.',

      'Using two transformers also gives operators greater flexibility than relying on a single unit. Loading can be shared, maintenance can be planned around available equipment, and the system has more options when one transformer is unavailable.',

      'The transformers are connected through two dedicated 330 kV transformer bays, each equipped with the switching, measurement and protection devices required to control the connection safely.',

      { h2: 'The equipment built to interrupt power' },

      'Most of the time, the substation’s high-voltage equipment allows electricity to flow. Its most important moments may come when that flow must be stopped.',

      '[Circuit breakers](/en/glossary#circuit-breaker) are designed to interrupt large fault currents within fractions of a second. Protection systems identify abnormal conditions and determine which breaker should operate. [Disconnectors](/en/glossary#disconnector) then provide visible isolation once the current has been interrupted. [Surge arresters](/en/glossary#surge-arrester) protect equipment from sudden voltage increases. [Instrument transformers](/en/glossary#instrument-transformer) provide the measurements used by relays, control systems and meters. Busbars distribute power between the connected lines, transformers and reactor.',

      'None of these devices works in isolation. A breaker is only useful if the protection system sends the correct command. A relay can only make the correct decision if its measurements are accurate. Operators can only understand the event if the communications and recording systems preserve what happened.',

      'The reliability of the substation therefore depends on coordination between equipment that performs very different functions.',

      { h2: 'A reactor that responds to changing voltage' },

      'The Kwara substation includes a 330 kV [variable line reactor](/en/glossary#variable-line-reactor) rated between 25 and 62 MVAr. Its role is different from that of the power transformers.',

      'Long transmission lines can generate excess [reactive power](/en/glossary#reactive-power), particularly when they are lightly loaded, which can push system voltage above the desired operating range. The reactor absorbs part of that reactive power.',

      'Because it is variable, its level of compensation can be adjusted as network conditions change. That gives operators greater control than a fixed reactor would provide. At one point in the day, the line may be carrying a high load; at another, demand may fall while the line remains energised. The reactor allows the network to respond to those changes without treating every operating condition as though it were the same.',

      'Its dedicated 330 kV bay gives it the switching, isolation and protection needed to operate as an integrated part of the substation.',

      { h2: 'The control room sees what the equipment is doing' },

      'The largest objects on the site are outside. The decisions that control them are made through the substation automation and control systems.',

      'The Kwara facility includes a complete [Substation Automation System](/en/glossary#substation-automation-system), [SCADA](/en/glossary#scada), protection, metering, disturbance recording and telecommunications infrastructure.',

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

      'Electricity can enter through multiple 330 kV line bays. It can be transformed through two 300 MVA [autotransformers](/en/glossary#autotransformer) and two 100 MVA power transformers. It can be directed through 330 kV, 132 kV and 33 kV [switchyards](/en/glossary#switchyard). Voltage conditions can be managed through fixed and variable reactor facilities. Protection, automation and telecommunications systems monitor the entire arrangement.',

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

      'At 132 kV, the [sectionalising bays](/en/glossary#sectionalising-bay) allow the [busbar](/en/glossary#busbar) to be divided into separate operating sections. This gives operators greater flexibility when carrying out maintenance or responding to a fault: one part of the switchyard can be isolated while another section remains available. At 33 kV, the bus coupler allows separate busbar sections to be connected or divided as required.',

      'Across all three voltage levels, the switchyards give the facility a wide range of possible operating configurations.',

      { h2: 'Why the bays matter' },

      'A substation [bay](/en/glossary#bay) is more than a physical space between steel structures. It is a controlled connection containing the equipment needed to switch, isolate, measure and protect a line, transformer or reactor.',

      'The project included disconnect switches, grounding switches, post insulators, surge arresters and instrument transformers across the 330 kV, 132 kV and 33 kV systems.',

      'Circuit breakers interrupt current when a fault occurs or equipment must be removed from service. Disconnect switches provide visible isolation after the breaker has interrupted the current. Grounding switches connect isolated equipment safely to earth during maintenance. Current and voltage transformers provide measurements to protection relays, meters and control systems. Surge arresters protect equipment against sudden voltage increases caused by lightning or switching events.',

      'A large substation can only operate safely when these devices respond in the correct order. The bay layout gives each connection its own switching and protection arrangement, allowing faults to be isolated without unnecessarily removing unaffected equipment from service.',

      { h2: 'Voltage control beyond the transformers' },

      'The Nnewi substation includes both fixed and variable reactor facilities. A 75 MVAr [shunt reactor](/en/glossary#shunt-reactor) provides a fixed level of reactive-power absorption, and two variable line reactors can operate between 25 and 62 MVAr.',

      'High-voltage transmission lines can generate excess reactive power, particularly when they are lightly loaded, which can raise voltage beyond the desired operating range. Reactors absorb part of that reactive power.',

      'The variable units can adjust their response as network conditions change, giving operators more precise control than a fixed reactor alone. This becomes especially useful in a station connected to several transmission circuits, where the amount of voltage support required may differ according to which lines are energised, how heavily they are loaded and how power is moving through the wider network.',

      { h2: 'Connecting Nnewi to the existing grid' },

      'The project also included 330 kV line-in, line-out connection works.',

      'A line-in, line-out arrangement — often shortened to [LILO](/en/glossary#lilo) — allows an existing transmission line to be brought into a new substation and then returned to the wider route. Instead of constructing an entirely separate long-distance line, the existing circuit is diverted through the new facility.',

      'The Nnewi connection works included line-entry [gantries](/en/glossary#gantry), transmission-line structures, terminations, Optical Ground Wire interfaces and other associated equipment. The gantries provide the physical transition between the overhead line and the substation equipment. The line terminations connect the incoming conductors to the switchyard. OPGW interfaces carry the fibre-optic communication channels associated with the transmission line into the station’s protection and telecommunications systems.',

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

      '[SCADA](/en/glossary#scada) gives operators a view of the site’s operating condition. It displays breaker and disconnector positions, transformer loading, voltage measurements, alarms and other information, and it allows authorised control commands to be issued from the station or a remote control centre.',

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

      'The Nnewi substation was developed with the complete civil and structural infrastructure required for operation, including reinforced-concrete foundations, control buildings, cable trenches and ducts, internal roads, drainage, transformer [bund walls](/en/glossary#bund-wall), oil-containment facilities, [earthing grids](/en/glossary#earthing-grid), perimeter fencing, and steel gantries and busbar supports.',

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

  /* ------------------------------------------------------ market analyses --
   * The two records above document work this client completed. What follows
   * describes the network that work sits inside — the same country, from
   * public reporting rather than from certificates.
   * ---------------------------------------------------------------------- */

  {
    headline: 'Nigeria’s Grid Can Now Carry More Power Than the Country Generates',
    subheadline: 'Wheeling capacity has reached 8,700 MW. Peak generation is still under 6,000.',
    seoTitle: 'Nigeria Grid Capacity 2026 | TCN Reaches 8,700 MW Wheeling',
    metaDescription:
      'The Transmission Company of Nigeria has raised wheeling capacity from about 7,000 MW to 8,700 MW, while record peak generation stands at 5,801.84 MW — moving the constraint off the grid.',
    summary:
      'The Transmission Company of Nigeria says its wheeling capacity has reached 8,700 megawatts, up from around 7,000, after commissioning 82 transformers between January 2024 and November 2025. Record peak generation over the same period was 5,801.84 MW — meaning the transmission network can now carry substantially more power than the country produces.',
    publishedAt: '2026-07-23',
    topic: 'energy',
    country: 'ng',
    language: 'en',
    articleType: 'ANALYSIS',
    image:
      'https://images.unsplash.com/photo-1509389807183-f0fbe962761a?fm=jpg&q=80&w=2400&auto=format',
    imageAlt: 'High-voltage switchgear and busbars inside a transmission substation.',
    imageCaption:
      'Switchgear inside a transmission substation. Illustrative — not a photograph of the Nigerian grid.',
    imageCredit: 'American Public Power Association / Unsplash',
    imageUsageRights: 'Unsplash License',
    body: [
      `The [Transmission Company of Nigeria](${TCN_NG}) says the national grid can now carry 8,700 megawatts, up from roughly 7,000 — an increase of about 1,700 MW. Over the same period the highest generation the country has ever achieved was 5,801.84 MW, recorded on 4 March 2025. On that day the grid delivered 128,370.75 megawatt-hours, the most in Nigerian history.`,

      'Put the two numbers beside each other and the significance is hard to miss. The transmission network is no longer the binding constraint on Nigerian electricity supply.',

      'That is a genuine reversal. For most of the past two decades the grid was the thing that failed — the reason power generated in the south could not reach demand in the north, and the reason a fault in one place took the whole system down with it.',

      { h2: 'What was actually built' },

      `Between January 2024 and November 2025 the company commissioned 82 new [power transformers](/en/glossary#power-transformer), adding more than 8,500 [MVA](/en/glossary#mva) to the grid. Sule Ahmed Abdulaziz, TCN’s managing director and chief executive, has pointed to that programme as the basis for the higher wheeling figure.`,

      `The financing came largely from outside. More than $1.4 billion has been mobilised from development lenders — among them the [World Bank](${WORLD_BANK}), the [African Development Bank](${AFDB}) and the [Japan International Cooperation Agency](${JICA}).`,

      `A transformer is not, on its own, capacity. It has to arrive with the [bays](/en/glossary#bay) that connect it, the [circuit breakers](/en/glossary#circuit-breaker) and [disconnectors](/en/glossary#disconnector) that isolate it, the [protection relays](/en/glossary#protection-relay) that decide when to open them, and the [SCADA](/en/glossary#scada) that lets an operator see any of it. Eighty-two transformers implies a great deal of switchgear alongside them.`,

      `Pressly has documented two such sites. The [Kwara 330 kV substation](/en/article/icco-delivers-the-kwara-330-kv-transmission-substation) combines two 150 MVA transformers, six 330 kV bays and a variable [line reactor](/en/glossary#variable-line-reactor) on a greenfield site. The [Nnewi substation](/en/article/icco-delivers-the-nnewi-800-mva-transmission-substation) carries four transformers totalling 800 MVA across three switchyards in Anambra State.`,

      { h2: 'The constraint has moved, not disappeared' },

      'A grid that can carry more than the country generates is not a solved grid. It is a grid whose problem now sits somewhere else.',

      'Nigeria’s shortfall has moved upstream to generation — gas supply, plant availability, the commercial arrangements that determine whether a generator runs at all — and downstream to distribution, where the companies that actually deliver power to customers remain the weakest link in the chain.',

      'Federal targets put transmission capacity at 10,000 MW by the end of 2026. Reaching it would widen the gap between what the grid can carry and what the country produces still further.',

      'There is a reasonable argument that this is the correct order to build in. Transmission takes longest to plan, to right-of-way, and to construct; a network built only to today’s generation would constrain tomorrow’s. But capacity that is never used is also capital that is not yet earning, and the case for continuing to build it rests on generation eventually catching up.',

      { h2: 'The figures' },

      {
        table: {
          caption: 'Nigerian transmission capacity and generation',
          header: ['Measure', 'Figure'],
          rows: [
            ['Wheeling capacity', '8,700 MW'],
            ['Previous capacity', '~7,000 MW'],
            ['Capacity added', '~1,700 MW'],
            ['Transformers commissioned', '82 (Jan 2024 – Nov 2025)'],
            ['Substation capacity added', '~8,500 MVA'],
            ['Record peak generation', '5,801.84 MW (4 March 2025)'],
            ['Record daily energy', '128,370.75 MWh'],
            ['Development financing mobilised', 'Over $1.4bn'],
            ['Federal target', '10,000 MW by end 2026'],
          ],
        },
      },

      { rule: true },

      'Capacity and generation figures in this article are as stated publicly by the Transmission Company of Nigeria and reported in the Nigerian press. Pressly has not independently verified them.',
    ],
  },

  /* ------------------------------------------------------------- economics --
   * One piece outside the power beat, anchored to institutional data. Note what
   * it deliberately is not: war reporting. Pressly has no correspondents, and
   * casualty counts and battlefield claims from belligerents are contested,
   * fast-moving and propagandised. What can be reported responsibly from a desk
   * is the measurable economic consequence at home, which is what this does —
   * World Bank figures, named and dated.
   * ---------------------------------------------------------------------- */

  {
    headline: 'Nigeria Exports Oil and Imports Inflation',
    subheadline: 'Growth forecast at 4.2 per cent. Fuel prices up more than half.',
    seoTitle: 'Nigeria Economy 2026 | 4.2% Growth, Fuel Inflation From Oil Shock',
    metaDescription:
      'The World Bank forecasts Nigerian growth of about 4.2 per cent in 2026, while fuel prices have risen more than 50 per cent during the Iran conflict — a windfall and a squeeze at once.',
    summary:
      'The World Bank forecasts Nigerian economic growth of about 4.2 per cent for 2026, its strongest in over a decade. In the same period fuel prices have risen more than 50 per cent, pushing inflation back up after it had halved. An oil exporter that imports refined fuel receives the windfall and the shock together.',
    publishedAt: '2026-06-18',
    topic: 'business',
    country: 'ng',
    language: 'en',
    articleType: 'ANALYSIS',
    // Ghana, not Nigeria. West African rather than Nigerian is close enough to
    // pass unnoticed and exactly why the caption has to name the country: a
    // filling station over a piece about Nigerian fuel prices otherwise reads
    // as a photograph of the thing being described.
    image:
      'https://images.unsplash.com/photo-1723021939081-31f4ab31456a?fm=jpg&q=80&w=2400&auto=format',
    imageAlt: 'A filling station at night, with people walking through the forecourt.',
    imageCaption:
      'A filling station at night in Kasoa, Ghana. Illustrative — not a Nigerian forecourt.',
    imageCredit: 'Kingsley Hemans / Unsplash',
    imageUsageRights: 'Unsplash License',
    body: [
      `The [World Bank](${WORLD_BANK}) forecasts Nigerian economic growth of about 4.2 per cent for 2026. Over the same period fuel prices have risen more than 50 per cent during the conflict in the Middle East, and inflation — which had eased to 15.06 per cent in February 2026 from around 33 per cent in December 2024 — has come under renewed pressure.`,

      'Both things are true at once, and the tension between them is the Nigerian economy in one sentence.',

      { h2: 'The windfall' },

      `Oil and gas account for more than 90 per cent of Nigeria’s export earnings and roughly half of government revenue, while contributing only about 10 per cent of GDP. A higher oil price is therefore a fiscal event before it is an economic one: it arrives in the budget rather than in output.`,

      `Growth forecasts have converged around a strong year. The World Bank puts 2026 growth at about 4.2 per cent; the [International Monetary Fund](${IMF}) at 4.4 per cent; the [Central Bank of Nigeria](${CBN}) at 4.49 per cent. On the IMF’s figure it would be the strongest growth in more than a decade.`,

      { h2: 'The squeeze' },

      'The difficulty is that Nigeria has historically exported crude and imported the refined product it burns.',

      'That makes a high oil price a two-sided instrument. Export revenue rises, and so does the cost of the diesel and petrol that move goods, run generators and power small businesses. Fuel prices rising more than half in the space of a conflict does not stay in the fuel line of a household budget; it reaches transport, food and production costs within weeks.',

      'Fiseha Haile, the World Bank’s lead economist for Nigeria, put it plainly in April: “the shock is still being felt through higher inflation.” He added that “inflation is still elevated and under increasing pressure, and that poses risks to incomes and poverty reduction.”',

      'That is the sentence that matters. Growth of 4.2 per cent alongside inflation in the mid-teens is not straightforwardly good news for anyone earning a wage.',

      { h2: 'What had been going right' },

      'The disinflation before the shock was real and substantial. Inflation running near 33 per cent at the end of 2024 and near 15 per cent by early 2026 is a halving in a little over a year.',

      'It was enough for the Central Bank of Nigeria to cut its benchmark Monetary Policy Rate from 27.5 per cent to 26.5 per cent in May 2026 — the first reduction in five years. A single point off a very high rate is a cautious move, and the caution reads as deliberate given what fuel prices were doing at the time.',

      {
        table: {
          caption: 'Nigeria, 2026',
          header: ['Measure', 'Figure'],
          rows: [
            ['GDP growth forecast (World Bank)', '~4.2%'],
            ['GDP growth forecast (IMF)', '4.4%'],
            ['GDP growth forecast (CBN)', '4.49%'],
            ['Inflation, February 2026', '15.06%'],
            ['Inflation, December 2024', '~33%'],
            ['Monetary Policy Rate', '26.5% (cut from 27.5%, May 2026)'],
            ['Fuel price rise during the conflict', 'More than 50%'],
            ['Oil and gas share of export earnings', 'Over 90%'],
            ['Oil and gas share of government revenue', '~50%'],
            ['Oil and gas share of GDP', '~10%'],
          ],
        },
      },

      { h2: 'Why the grid is part of this story' },

      'There is a reason a publication that covers transmission infrastructure is writing about fuel prices.',

      'When grid electricity is unavailable, the substitute is a diesel generator. That makes the fuel price a direct input into the cost of running almost any Nigerian business, and it makes every megawatt the grid delivers reliably a megawatt that does not have to be bought at the pump at a price set by events in the Gulf.',

      `Nigeria’s transmission capacity has risen materially — the network can now carry [more power than the country generates](/en/article/nigerias-grid-can-now-carry-more-power-than-the-country-generates), following work including the [Kwara](/en/article/icco-delivers-the-kwara-330-kv-transmission-substation) and [Nnewi](/en/article/icco-delivers-the-nnewi-800-mva-transmission-substation) substations. The binding constraint has moved to generation and distribution.`,

      'Framed against an imported fuel shock, that is not an abstract infrastructure argument. Grid reliability is the closest thing Nigeria has to a domestic hedge against the price of oil.',

      { rule: true },

      'Growth forecasts, inflation figures and the quoted remarks are as reported from the World Bank’s Nigeria assessment presented on 8 April 2026, and from IMF and Central Bank of Nigeria statements. Figures have not been independently verified by Pressly, and forecasts are forecasts.',
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
