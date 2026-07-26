'use client';

import { useRef, useState } from 'react';
import { Button } from '@pressly/ui';
import { upload } from '@/lib/api';
import type { NewsroomMedia } from './types';

// Media upload lives in this app now — no cross-origin base URL.

interface Props {
  current: NewsroomMedia | null;
  onUploaded: (media: NewsroomMedia) => void;
}

/**
 * Hero image picker. Uploads directly to the media endpoint (which generates
 * responsive variants) and hands the new media back to the editor.
 */
export function HeroImageField({ current, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      // `upload` deliberately does not set Content-Type — the browser has to
      // add the multipart boundary itself. The session rides on the cookie.
      onUploaded(await upload<NewsroomMedia>('/newsroom/media', form));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const preview = current?.variants.tablet ?? current?.variants.large ?? current?.variants.original;

  return (
    <div className="mb-8">
      <input ref={inputRef} type="file" accept="image/*" onChange={onSelect} className="hidden" />
      {preview ? (
        <div className="group relative overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={current?.alt ?? ''} className="aspect-[3/2] w-full object-cover" />
          <Button
            size="sm"
            onClick={() => inputRef.current?.click()}
            busy={busy}
            className="absolute bottom-3 end-3 bg-ink/80 text-background backdrop-blur hover:bg-ink"
          >
            {busy ? 'Uploading…' : 'Replace'}
          </Button>
        </div>
      ) : (
        <Button
          variant="plain"
          onClick={() => inputRef.current?.click()}
          busy={busy}
          className="flex aspect-[3/2] h-auto w-full flex-col justify-center rounded-xl border border-dashed border-border text-ink-muted hover:border-ink/30 hover:text-ink"
        >
          <span className="font-sans text-ui">{busy ? 'Uploading…' : 'Add hero image'}</span>
          <span className="mt-1 font-mono text-meta uppercase">JPG · PNG · WebP</span>
        </Button>
      )}
      {error && <p className="mt-2 font-sans text-ui-sm text-error">{error}</p>}
    </div>
  );
}
