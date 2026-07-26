'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import { Button, cn } from '@pressly/ui';

interface Props {
  initialContent: Record<string, unknown>;
  onChange: (doc: Record<string, unknown>) => void;
  dir?: 'ltr' | 'rtl';
}

/**
 * The focused block editor. Produces structured JSON (Tiptap doc) — the same
 * shape the Reader renders, so what you write is what readers get.
 */
export function ArticleEditor({ initialContent, onChange, dir = 'ltr' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
      }),
    ],
    content: hasContent(initialContent) ? initialContent : undefined,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose-editor min-h-[50vh] max-w-none font-sans text-body leading-loose text-ink outline-none',
          dir === 'rtl' && 'font-arabic',
        ),
        dir,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as Record<string, unknown>),
  });

  if (!editor) return <div className="min-h-[50vh]" />;

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function hasContent(doc: Record<string, unknown>): boolean {
  const content = (doc as { content?: unknown[] }).content;
  return Array.isArray(content) && content.length > 0;
}

function Toolbar({ editor }: { editor: Editor }) {
  // Re-render on selection changes so active states stay in sync.
  useEffect(() => {
    const update = () => {};
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  /**
   * A formatting toggle. These are toggle buttons, so they carry `aria-pressed`
   * — without it a screen-reader user has no way to tell whether bold is on.
   * `tinted` is the design system's "on" state: it reads as active without the
   * weight of a primary action sitting in a toolbar.
   */
  const Toggle = ({ active, onClick, children }: ToggleProps) => (
    <Button
      variant={active ? 'tinted' : 'plain'}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      className="px-2.5"
    >
      {children}
    </Button>
  );

  return (
    <div className="sticky top-14 z-10 mb-6 flex flex-wrap items-center gap-1 border-b border-border bg-background/90 py-2 backdrop-blur">
      <Toggle active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        Bold
      </Toggle>
      <Toggle active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        Italic
      </Toggle>
      <span className="mx-1 h-5 w-px bg-border" />
      <Toggle
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </Toggle>
      <Toggle
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </Toggle>
      <span className="mx-1 h-5 w-px bg-border" />
      <Toggle active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        List
      </Toggle>
      <Toggle active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        Quote
      </Toggle>
    </div>
  );
}

interface ToggleProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}
