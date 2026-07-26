import type { MediaVariants } from '@pressly/types';
import { srcSetFrom, webpSrcSetFrom } from '@/lib/images';

interface Props {
  variants: MediaVariants | undefined;
  /** The best single JPEG for browsers that ignore srcSet. */
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  /** Set on the LCP element only — the hero. Everything else stays lazy. */
  priority?: boolean;
}

/**
 * One `<picture>` for every image in the Reader.
 *
 * Serving JPEG only meant a 2× phone downloaded the 1024px crop for each card
 * — 915KB on the home page. This offers WebP at every width and lets the
 * browser fall back to the JPEG set, which also covers media recorded before
 * the pipeline produced `webpSet`.
 *
 * Aspect ratio is reserved by the caller's `className` (`aspect-[3/2]` and
 * friends), which is why CLS measures 0 without intrinsic width/height — the
 * card shapes never depend on the image loading.
 */
export function MediaImage({ variants, src, alt, sizes, className, priority = false }: Props) {
  const webp = webpSrcSetFrom(variants);
  const jpeg = srcSetFrom(variants);

  return (
    <picture>
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        srcSet={jpeg}
        sizes={sizes}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
      />
    </picture>
  );
}
