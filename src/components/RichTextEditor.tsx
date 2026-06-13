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

export function stripWhatsAppFormatting(text: string): string {
  return text
    .replace(/\*_(.+?)_\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~(.+?)~/g, '$1')
    .replace(/```(.+?)```/g, '$1')
    .replace(/`(.+?)`/g, '$1');
}

export default function RichTextEditor({
  value, onChange, placeholder, rows = 5, label, target = 'whatsapp',
  showImageUpload, imageBase64, onImageUpload, onImageClear,
}: RichTextEditorProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);

  const formatText = (before: string, after: string) => {
    const ta = textRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    const newText = value.substring(0, start) + before + selected + after + value.substring(end);
    onChange(newText);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const transformSelection = (transform: (text: string) => string) => {
    const ta = textRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    const selected = value.substring(start, end);
    const transformed = transform(selected);
    onChange(value.substring(0, start) + transformed + value.substring(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start + transformed.length);
    });
  };

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-600 block">{label}</label>
          <span className="text-[10px] text-slate-400">{value.length} car.</span>
        </div>
      )}
      <div className="flex gap-1 pb-1 flex-wrap">
        <button type="button" onClick={() => formatText('*', '*')} title="Gras"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Bold className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => formatText('_', '_')} title="Italique"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Italic className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => formatText('*_', '_*')} title="Gras-italique"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><TypeIcon className="w-3.5 h-3.5" /></button>
        <span className="w-px bg-slate-200 mx-0.5 self-stretch" />
        <button type="button" onClick={() => transformSelection(t => t.toUpperCase())} title="Majuscule"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer font-bold text-[10px] leading-none px-2">A<ArrowUp className="w-3 h-3 inline" /></button>
        <button type="button" onClick={() => transformSelection(t => t.toLowerCase())} title="Minuscule"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer text-[10px] leading-none px-2">a<ArrowDown className="w-3 h-3 inline" /></button>
        <button type="button" onClick={() => transformSelection(t => `*${t.toUpperCase()}*`)} title="Majuscule gras"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer font-bold text-[10px] leading-none px-2"><Bold className="w-3 h-3 inline" />A<ArrowUp className="w-3 h-3 inline" /></button>
        <span className="w-px bg-slate-200 mx-0.5 self-stretch" />
        <button type="button" onClick={() => formatText('~', '~')} title="Barré"
          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Strikethrough className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => formatText('```', '```')} title="Monospace"
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
        <div className="text-[10px] text-slate-400 italic border-t border-slate-100 dark:border-slate-700 pt-1 mt-1">
          Aperçu Facebook propre : {stripWhatsAppFormatting(value).slice(0, 120)}{stripWhatsAppFormatting(value).length > 120 ? '...' : ''}
        </div>
      )}
    </div>
  );
}
