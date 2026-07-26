import type {
  ArticleDoc,
  BlockNode,
  InlineNode,
  ListItemNode,
  Mark,
  Media,
} from '@pressly/types';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Fragment } from 'react';

export interface RenderContext {
  /** Resolve an image node's mediaId to a Media record (for src/alt/variants). */
  resolveMedia?: (mediaId: string) => Media | undefined;
}

/**
 * Renders a structured Pressly article body (Tiptap/ProseMirror JSON) to React.
 * Shared by the Reader, the Newsroom live preview, and any future surface, so
 * every context renders identical output from one source of truth.
 */
export function ArticleBody({ doc, context }: { doc: ArticleDoc; context?: RenderContext }) {
  return (
    <div className="article-body">
      {doc.content.map((node, i) => (
        <BlockRenderer key={i} node={node} context={context} />
      ))}
    </div>
  );
}

function BlockRenderer({ node, context }: { node: BlockNode; context?: RenderContext }): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return (
        <p className="mt-4 font-sans text-body text-ink first:mt-0">
          <Inline nodes={node.content} />
        </p>
      );

    case 'heading': {
      const level = node.attrs.level;
      const Tag = (`h${level}` as 'h2' | 'h3' | 'h4');
      const size =
        level === 2 ? 'text-2xl mt-9' : level === 3 ? 'text-xl mt-7' : 'text-lg mt-6';
      return (
        <Tag className={clsx('font-serif font-semibold text-ink', size)}>
          <Inline nodes={node.content} />
        </Tag>
      );
    }

    case 'image': {
      const media = node.attrs.mediaId ? context?.resolveMedia?.(node.attrs.mediaId) : undefined;
      const src = media?.variants.large ?? media?.variants.original ?? node.attrs.src;
      const alt = node.attrs.alt ?? media?.alt ?? node.attrs.caption ?? '';
      const caption = node.attrs.caption ?? media?.caption;
      const credit = node.attrs.credit ?? media?.photographer ?? media?.copyrightHolder;
      return (
        <figure className="my-8 -mx-4 sm:mx-0">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt} className="w-full rounded-md" loading="lazy" />
          ) : (
            <div className="aspect-[3/2] w-full rounded-md bg-border" aria-hidden />
          )}
          {(caption || credit) && (
            <figcaption className="mt-3 px-4 sm:px-0 font-sans text-sm text-ink-muted">
              {caption}
              {credit && <span className="ms-2 font-mono text-xs uppercase tracking-wide">{credit}</span>}
            </figcaption>
          )}
        </figure>
      );
    }

    case 'pullQuote':
      return (
        <blockquote className="my-9 border-s-2 border-accent ps-6">
          <p className="font-serif text-2xl leading-snug text-ink">
            <Inline nodes={node.content} />
          </p>
          {node.attrs?.attribution && (
            <cite className="mt-3 block font-sans text-sm not-italic text-ink-muted">
              — {node.attrs.attribution}
            </cite>
          )}
        </blockquote>
      );

    case 'blockquote':
      return (
        <blockquote className="my-6 border-s border-border ps-5 text-ink-muted">
          {node.content?.map((child, i) => (
            <BlockRenderer key={i} node={child} context={context} />
          ))}
        </blockquote>
      );

    case 'bulletList':
      return (
        <ul className="mt-4 list-disc space-y-2 ps-6 font-sans text-body text-ink">
          {node.content?.map((li, i) => (
            <ListItem key={i} node={li} context={context} />
          ))}
        </ul>
      );

    case 'orderedList':
      return (
        <ol
          start={node.attrs?.start}
          className="mt-4 list-decimal space-y-2 ps-6 font-sans text-body text-ink"
        >
          {node.content?.map((li, i) => (
            <ListItem key={i} node={li} context={context} />
          ))}
        </ol>
      );

    case 'embed':
      return (
        <div className="my-8 overflow-hidden rounded-md border border-border">
          {node.attrs.html ? (
            <div dangerouslySetInnerHTML={{ __html: node.attrs.html }} />
          ) : (
            <a
              href={node.attrs.url}
              className="block p-4 font-sans text-sm text-accent underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {node.attrs.url}
            </a>
          )}
        </div>
      );

    case 'horizontalRule':
      return <hr className="my-10 border-border" />;

    default:
      return null;
  }
}

function ListItem({ node, context }: { node: ListItemNode; context?: RenderContext }) {
  return (
    <li>
      {node.content?.map((child, i) => (
        <BlockRenderer key={i} node={child} context={context} />
      ))}
    </li>
  );
}

function Inline({ nodes }: { nodes?: InlineNode[] }): ReactNode {
  if (!nodes) return null;
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === 'hardBreak') return <br key={i} />;
        return <Fragment key={i}>{applyMarks(node.text, node.marks)}</Fragment>;
      })}
    </>
  );
}

function applyMarks(text: string, marks?: Mark[]): ReactNode {
  if (!marks || marks.length === 0) return text;
  return marks.reduce<ReactNode>((acc, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong className="font-semibold">{acc}</strong>;
      case 'italic':
        return <em>{acc}</em>;
      case 'underline':
        return <u>{acc}</u>;
      case 'strike':
        return <s>{acc}</s>;
      case 'code':
        return <code className="rounded bg-border px-1 py-0.5 font-mono text-[0.9em]">{acc}</code>;
      case 'link':
        return (
          <a
            href={mark.attrs?.href}
            target={mark.attrs?.target}
            rel={mark.attrs?.rel ?? 'noopener noreferrer'}
            className="text-accent underline decoration-border underline-offset-2 hover:decoration-accent"
          >
            {acc}
          </a>
        );
      default:
        return acc;
    }
  }, text);
}

export default ArticleBody;
