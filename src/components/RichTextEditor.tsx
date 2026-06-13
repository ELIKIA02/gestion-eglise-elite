import React, { useRef } from 'react';
import { Bold, Italic, Strikethrough, Code, Image, X, Type as TypeIcon, ArrowUp, ArrowDown } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  target?: 'whatsapp' | 'facebook';
  showImageUpload?: boolean;
  imageBase64?: string | null;
  onImageUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageClear?: () => void;
}

// --- Unicode conversion helpers pour Facebook ---
const FB_BOLD_OFFSET = 0x1D3BF; // A → 𝐀 (U+0041 → U+1D400)
const FB_ITALIC_OFFSET = 0x1D3F3; // A → 𝐴 (U+0041 → U+1D434)
const FB_BOLD_ITALIC_OFFSET = 0x1D427; // A → 𝑨 (U+0041 → U+1D468)
const FB_MONO_OFFSET = 0x1D62F; // A → 𝙰 (U+0041 → U+1D670)
const FB_BOLD_NUM_OFFSET = 0x1D79E; // 0 → 𝟎 (U+0030 → U+1D7CE)
const FB_STRIKE_CHAR = '\u0336'; // Combining long stroke overlay

function isAlpha(c: string): boolean {
  const code = c.charCodeAt(0);
  return (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A);
}

function isDigit(c: string): boolean {
  const code = c.charCodeAt(0);
  return code >= 0x30 && code <= 0x39;
}

function applyUnicode(text: string, offset: number, includeDigits: boolean): string {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 0x41 && code <= 0x5A) return String.fromCharCode(code + offset);
    if (code >= 0x61 && code <= 0x7A) return String.fromCharCode(code + offset);
    if (includeDigits && code >= 0x30 && code <= 0x39) return String.fromCharCode(code + FB_BOLD_NUM_OFFSET);
    return c;
  }).join('');
}

function toFbBold(text: string): string { return applyUnicode(text, FB_BOLD_OFFSET, true); }
function toFbItalic(text: string): string { return applyUnicode(text, FB_ITALIC_OFFSET, false); }
function toFbBoldItalic(text: string): string { return applyUnicode(text, FB_BOLD_ITALIC_OFFSET, false); }
function toFbMono(text: string): string { return applyUnicode(text, FB_MONO_OFFSET, true); }
function toFbStrike(text: string): string { return text.split('').map(c => c + FB_STRIKE_CHAR).join(''); }
function toFbBoldUppercase(text: string): string { return applyUnicode(text.toUpperCase(), FB_BOLD_OFFSET, true); }

// --- WhatsApp conversion helpers ---
function toWaBold(text: string): string { return `*${text}*`; }
function toWaItalic(text: string): string { return `_${text}_`; }
function toWaBoldItalic(text: string): string { return `*_${text}_*`; }
function toWaStrike(text: string): string { return `~${text}~`; }
function toWaMono(text: string): string { return `\`\`\`${text}\`\`\``; }
function toWaBoldUppercase(text: string): string { return `*${text.toUpperCase()}*`; }

export function stripWhatsAppFormatting(text: string): string {
  return text
    .replace(/\*_(.+?)_\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~(.+?)~/g, '$1')
    .replace(/```(.+?)```/g, '$1')
    .replace(/`(.+?)`/g, '$1');
}

export function whatsAppToFacebook(text: string): string {
  return text
    .replace(/\*_(.+?)_\*/g, (_, m) => toFbBoldItalic(m))
    .replace(/\*(.+?)\*/g, (_, m) => toFbBold(m))
    .replace(/_(.+?)_/g, (_, m) => toFbItalic(m))
    .replace(/~(.+?)~/g, (_, m) => toFbStrike(m))
    .replace(/```(.+?)```/g, (_, m) => toFbMono(m))
    .replace(/`(.+?)`/g, (_, m) => toFbMono(m));
}

export default function RichTextEditor({
  value, onChange, placeholder, rows = 5, label, target = 'whatsapp',
  showImageUpload, imageBase64, onImageUpload, onImageClear,
}: RichTextEditorProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);

  const applyToSelection = (transform: (text: string) => string) => {
    const ta = textRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end && target === 'facebook') return;
    const selected = start === end && target === 'whatsapp' ? '' : value.substring(start, end);
    const transformed = transform(selected);
    onChange(value.substring(0, start) + transformed + value.substring(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start + transformed.length);
    });
  };

  const toUpper = (t: string) => t.toUpperCase();
  const toLower = (t: string) => t.toLowerCase();

  const formatActions: Record<string, (text: string) => string> = target === 'facebook'
    ? { bold: toFbBold, italic: toFbItalic, boldItalic: toFbBoldItalic, strike: toFbStrike, mono: toFbMono, boldUpper: toFbBoldUppercase }
    : { bold: toWaBold, italic: toWaItalic, boldItalic: toWaBoldItalic, strike: toWaStrike, mono: toWaMono, boldUpper: toWaBoldUppercase };

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-600 block">{label}</label>
          <span className="text-[10px] text-slate-400">{value.length} car.</span>
        </div>
      )}
      <div className="flex gap-1 pb-1 flex-wrap">
        <button type="button" onClick={() => applyToSelection(formatActions.bold)} title="Gras"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Bold className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => applyToSelection(formatActions.italic)} title="Italique"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Italic className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => applyToSelection(formatActions.boldItalic)} title="Gras-italique"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><TypeIcon className="w-3.5 h-3.5" /></button>
        <span className="w-px bg-slate-200 mx-0.5 self-stretch" />
        <button type="button" onClick={() => applyToSelection(toUpper)} title="Majuscule"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer font-bold text-[10px] leading-none px-2">A<ArrowUp className="w-3 h-3 inline" /></button>
        <button type="button" onClick={() => applyToSelection(toLower)} title="Minuscule"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer text-[10px] leading-none px-2">a<ArrowDown className="w-3 h-3 inline" /></button>
        <button type="button" onClick={() => applyToSelection(formatActions.boldUpper)} title="Majuscule gras"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer font-bold text-[10px] leading-none px-2"><Bold className="w-3 h-3 inline" />A<ArrowUp className="w-3 h-3 inline" /></button>
        <span className="w-px bg-slate-200 mx-0.5 self-stretch" />
        <button type="button" onClick={() => applyToSelection(formatActions.strike)} title="Barré"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Strikethrough className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => applyToSelection(formatActions.mono)} title="Monospace"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Code className="w-3.5 h-3.5" /></button>
        {showImageUpload && (
          <>
            <span className="w-px bg-slate-200 mx-0.5 self-stretch" />
            <label className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer" title="Ajouter une image">
              <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
              <Image className="w-3.5 h-3.5" />
            </label>
          </>
        )}
      </div>
      <textarea ref={textRef} required value={value} onChange={e => onChange(e.target.value)}
        rows={rows} placeholder={placeholder}
        className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-800 dark:text-slate-200" />
      {imageBase64 && onImageClear && (
        <div className="relative inline-block mt-1">
          <img src={imageBase64} alt="Aperçu" className="max-h-32 rounded-lg border border-slate-200" />
          <button type="button" onClick={onImageClear}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 cursor-pointer shadow">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {target === 'facebook' && value.trim() && (
        <div className="text-[10px] text-slate-400 italic border-t border-slate-100 dark:border-slate-700 pt-1.5 mt-1 leading-relaxed">
          Aperçu Facebook : {stripWhatsAppFormatting(value).slice(0, 200)}{stripWhatsAppFormatting(value).length > 200 ? '...' : ''}
        </div>
      )}
    </div>
  );
}
