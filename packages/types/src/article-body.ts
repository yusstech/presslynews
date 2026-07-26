/**
 * Structured article body — the single most important data principle in Pressly:
 * an article body is NEVER stored as one big HTML blob. It is a Tiptap /
 * ProseMirror document (structured JSON), so it can be re-rendered on any
 * surface, translated block-by-block (v2), summarized, and re-styled without
 * rewriting stored content.
 *
 * The shared `@pressly/article-renderer` package renders this shape to React.
 */

export type MarkType = 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link';

export interface Mark {
  type: MarkType;
  attrs?: {
    href?: string;
    target?: string;
    rel?: string;
  };
}

export interface TextNode {
  type: 'text';
  text: string;
  marks?: Mark[];
}

export interface ParagraphNode {
  type: 'paragraph';
  content?: InlineNode[];
}

export interface HeadingNode {
  type: 'heading';
  attrs: { level: 2 | 3 | 4 };
  content?: InlineNode[];
}

export interface ImageNode {
  type: 'image';
  attrs: {
    mediaId: string;
    caption?: string;
    credit?: string;
    /** Optional pre-resolved URL for rendering when media isn't joined. */
    src?: string;
    alt?: string;
  };
}

export interface PullQuoteNode {
  type: 'pullQuote';
  attrs?: { attribution?: string };
  content?: InlineNode[];
}

export interface BlockquoteNode {
  type: 'blockquote';
  content?: BlockNode[];
}

export interface ListItemNode {
  type: 'listItem';
  content?: BlockNode[];
}

export interface BulletListNode {
  type: 'bulletList';
  content?: ListItemNode[];
}

export interface OrderedListNode {
  type: 'orderedList';
  attrs?: { start?: number };
  content?: ListItemNode[];
}

export interface EmbedNode {
  type: 'embed';
  attrs: {
    provider: 'youtube' | 'twitter' | 'generic';
    url: string;
    html?: string;
  };
}

export interface HorizontalRuleNode {
  type: 'horizontalRule';
}

export interface HardBreakNode {
  type: 'hardBreak';
}

export type InlineNode = TextNode | HardBreakNode;

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | ImageNode
  | PullQuoteNode
  | BlockquoteNode
  | BulletListNode
  | OrderedListNode
  | EmbedNode
  | HorizontalRuleNode;

export interface ArticleDoc {
  type: 'doc';
  content: BlockNode[];
}

export function emptyArticleDoc(): ArticleDoc {
  return { type: 'doc', content: [] };
}

/** Rough plain-text extraction for reading-time / search / summaries. */
export function extractPlainText(doc: ArticleDoc): string {
  const walk = (nodes: Array<BlockNode | InlineNode | ListItemNode>): string =>
    nodes
      .map((node) => {
        if (node.type === 'text') return node.text;
        if ('content' in node && Array.isArray(node.content)) {
          return walk(node.content as Array<BlockNode | InlineNode | ListItemNode>);
        }
        return '';
      })
      .join(' ');
  return walk(doc.content).replace(/\s+/g, ' ').trim();
}

/** Average adult reading speed ≈ 200 wpm; minimum 1 minute. */
export function estimateReadingTimeMinutes(doc: ArticleDoc): number {
  const words = extractPlainText(doc).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
