import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

/** Design law: warm white page, near-black text, one hairline rule. */
const BG = '#FAFAF8';
const TEXT = '#111111';
const MUTED = '#666666';
const RULE = '#E8E8E8';

export interface SocialCardInput {
  headline: string;
  kicker?: string | null;
  readingTime: number;
  heroImage?: Buffer | null;
}

/**
 * Renders the 1200×630 card used for og:image.
 *
 * Text is drawn as SVG because sharp has no text primitive, which also means
 * wrapping is ours to do — see wrapText below.
 */
export async function renderSocialCard(input: SocialCardInput): Promise<Buffer> {
  const hasHero = !!input.heroImage;
  // With a hero the text sits in a lower band; without one it uses the page.
  const textTop = hasHero ? 360 : 150;
  const maxLines = hasHero ? 3 : 5;
  const lines = wrapText(input.headline, hasHero ? 40 : 34).slice(0, maxLines);

  const kicker = [input.kicker, `${input.readingTime} min read`]
    .filter(Boolean)
    .join('  ·  ')
    .toUpperCase();

  const headlineSvg = lines
    .map(
      (line, i) =>
        `<text x="72" y="${textTop + i * 68}" font-family="Newsreader, Georgia, 'Times New Roman', serif" font-size="58" font-weight="700" fill="${TEXT}">${escapeXml(line)}</text>`,
    )
    .join('');

  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>
      ${headlineSvg}
      <line x1="72" y1="${HEIGHT - 108}" x2="${WIDTH - 72}" y2="${HEIGHT - 108}" stroke="${RULE}" stroke-width="1"/>
      <text x="72" y="${HEIGHT - 64}" font-family="'IBM Plex Mono', 'Courier New', monospace" font-size="22" letter-spacing="1.5" fill="${MUTED}">${escapeXml(kicker)}</text>
      <text x="${WIDTH - 72}" y="${HEIGHT - 64}" text-anchor="end" font-family="'IBM Plex Mono', 'Courier New', monospace" font-size="22" letter-spacing="3" fill="${TEXT}">PRESSLY</text>
    </svg>`;

  // The SVG carries its own opaque background, so it is the bottom layer and
  // the hero band goes over it — never the other way around.
  const layers: sharp.OverlayOptions[] = [{ input: Buffer.from(svg), top: 0, left: 0 }];

  if (input.heroImage) {
    // A band across the top, cropped to attention-centre.
    const band = await sharp(input.heroImage)
      .resize({ width: WIDTH, height: 260, fit: 'cover', position: 'attention' })
      .toBuffer()
      .catch(() => null);
    if (band) layers.push({ input: band, top: 0, left: 0 });
  }

  return sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: BG },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

/** Greedy word wrap to a character budget per line. */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
