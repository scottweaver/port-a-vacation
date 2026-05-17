// Tiny markdown renderer covering the subset we use in release notes:
//   - # / ## / ### headings
//   - - bullet lists (single level)
//   - **bold**, *italic*, `inline code`, [link](url)
//   - paragraphs (separated by blank lines)
//
// No deps, no HTML interpolation. Content comes from our own repo so the
// XSS surface is nil, but using React elements all the way down means
// even a future content-from-Supabase use would be safe.

import { Fragment, type ReactNode } from 'react';

const INLINE_PATTERN = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE_PATTERN)) {
    if (m.index === undefined) continue;
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    const key = `${keyPrefix}-${n++}`;
    if (m[1] !== undefined) {
      parts.push(<strong key={key}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      parts.push(<em key={key}>{m[2]}</em>);
    } else if (m[3] !== undefined) {
      parts.push(
        <code key={key} className="bg-slate-100 px-1 py-0.5 rounded text-xs text-slate-700">{m[3]}</code>,
      );
    } else if (m[4] !== undefined && m[5] !== undefined) {
      parts.push(
        <a key={key} href={m[5]} target="_blank" rel="noreferrer noopener" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-900">
          {m[4]}
        </a>,
      );
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split('\n');
  const out: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (line.startsWith('# ')) {
      out.push(<h1 key={i} className="text-lg font-bold text-slate-900 mt-1 mb-2">{renderInline(line.slice(2), String(i))}</h1>);
      i++;
    } else if (line.startsWith('## ')) {
      out.push(<h2 key={i} className="text-base font-semibold text-slate-800 mt-5 mb-2">{renderInline(line.slice(3), String(i))}</h2>);
      i++;
    } else if (line.startsWith('### ')) {
      out.push(<h3 key={i} className="text-sm font-semibold text-slate-700 mt-3 mb-1">{renderInline(line.slice(4), String(i))}</h3>);
      i++;
    } else if (line.startsWith('- ')) {
      const items: string[] = [];
      const start = i;
      while (i < lines.length && (lines[i] ?? '').startsWith('- ')) {
        items.push((lines[i] ?? '').slice(2));
        i++;
      }
      out.push(
        <ul key={start} className="list-disc pl-5 my-2 space-y-1.5 text-sm text-slate-700">
          {items.map((it, j) => <li key={j}>{renderInline(it, `${start}-${j}`)}</li>)}
        </ul>,
      );
    } else if (line.trim() === '') {
      i++;
    } else {
      const para: string[] = [];
      const start = i;
      while (
        i < lines.length
        && (lines[i] ?? '').trim() !== ''
        && !(lines[i] ?? '').startsWith('#')
        && !(lines[i] ?? '').startsWith('- ')
      ) {
        para.push(lines[i] ?? '');
        i++;
      }
      out.push(
        <p key={start} className="text-sm text-slate-700 my-2 leading-relaxed">
          {renderInline(para.join(' '), String(start))}
        </p>,
      );
    }
  }

  return <div className="space-y-0.5">{out}</div>;
}
