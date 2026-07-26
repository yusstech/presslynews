import { notFound } from 'next/navigation';

/** Any unmatched path inside a locale falls through to the localized 404. */
export default function CatchAll() {
  notFound();
}
