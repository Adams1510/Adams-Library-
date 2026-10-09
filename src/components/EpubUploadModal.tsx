import React, { useEffect, useRef, useState } from 'react';
import { Book, BookCategory } from '../types';
import { importBookFile } from '../utils/importBook';
import { Upload, X, Loader2, CheckCircle2 } from 'lucide-react';

interface Props { isOpen: boolean; onClose: () => void; onBookImported: (book: Book) => Promise<void>; }
type Item = {name: string; book?: Book; error?: string; saved?: boolean};
export function EpubUploadModal({isOpen, onClose, onBookImported}: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef(false);
  useEffect(() => { if (isOpen && !operation.current) { setItems([]); setStatus(''); } }, [isOpen]);
  if (!isOpen) return null;
  const parseFiles = async (files: FileList | File[]) => {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    const selected = Array.from(files);
    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      setStatus(`Reading ${i + 1} of ${selected.length}: ${file.name}`);
      try {
        const book = await importBookFile(file);
        setItems(prev => prev.some(item => item.book?.id === book.id) ? prev : [...prev, {name: file.name, book}]);
      } catch (error: any) { setItems(prev => [...prev, {name: file.name, error: error.message}]); }
    }
    setStatus('Review the books below, then add them to your library.');
    setBusy(false); operation.current = false;
    if (input.current) input.current.value = '';
  };
  const save = async () => {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    const pending = items.filter(item => item.book && !item.saved);
    let saved = 0;
    for (const item of pending) {
      setStatus(`Saving ${saved + 1} of ${pending.length}: ${item.book!.title}`);
      try {
        await onBookImported(item.book!); saved++;
        setItems(prev => prev.map(p => p === item ? {...p, saved: true, error: undefined} : p));
      } catch (error: any) {
        setItems(prev => prev.map(p => p === item ? {...p, error: error.message} : p));
      }
    }
    setStatus(`${saved} book${saved === 1 ? '' : 's'} saved. ${pending.length - saved ? 'Review the errors below; successful books are already in your library.' : 'You can add more files or close this window.'}`);
    setBusy(false); operation.current = false;
  };
  const update = (index: number, field: string, value: string) => setItems(prev => prev.map((item, i) => i === index && item.book ? {...item, book: {...item.book, [field]: value}} : item));
  const pendingCount = items.filter(item => item.book && !item.saved).length;
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
    <section role="dialog" aria-modal="true" aria-labelledby="upload-title" className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl">
      <header className="flex items-center justify-between mb-4">
        <div><h2 id="upload-title" className="font-bold text-lg">Add your books</h2><p className="text-xs text-slate-500 mt-1">EPUB and TXT · multiple files supported · large EPUBs stay as one book</p></div>
        <button aria-label="Close upload" disabled={busy} onClick={onClose} className="p-2 disabled:opacity-30"><X size={20}/></button>
      </header>
      <div className="overflow-y-auto space-y-4 flex-1">
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault(); void parseFiles(e.dataTransfer.files);}}
          className="w-full p-8 border-2 border-dashed border-emerald-500/50 rounded-2xl text-center bg-emerald-50 dark:bg-emerald-950/20 disabled:opacity-60">
          {busy ? <Loader2 className="mx-auto mb-2 animate-spin"/> : <Upload className="mx-auto mb-2"/>}
          <span className="font-semibold">Choose files or drop them here</span>
          <span className="block text-xs text-slate-500 mt-2">Chapter text stays intact. Duplicate files are detected automatically.</span>
        </button>
        <input ref={input} aria-label="Choose EPUB or text files" type="file" multiple accept=".epub,.txt" className="hidden" disabled={busy} onChange={e => {if (e.target.files) void parseFiles(e.target.files);}}/>
        {status && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{status}</p>}
        {items.map((item, index) => <div key={item.name + index} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500 truncate">{item.name}</p>{item.saved && <span className="text-xs text-emerald-600 flex gap-1"><CheckCircle2 size={14}/>Saved</span>}</div>
          {item.book && <>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs">Title<input aria-label={`Title for ${item.name}`} disabled={busy || item.saved} value={item.book.title} onChange={e => update(index, 'title', e.target.value)} className="block w-full mt-1 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm"/></label>
              <label className="text-xs">Author<input disabled={busy || item.saved} value={item.book.author} onChange={e => update(index, 'author', e.target.value)} className="block w-full mt-1 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm"/></label>
            </div>
            <label className="text-xs">Category<select disabled={busy || item.saved} value={item.book.category} onChange={e => update(index, 'category', e.target.value)} className="ml-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800">{(['Islamic', 'Psychological', 'Contemporary', 'Custom'] as BookCategory[]).map(c => <option key={c}>{c}</option>)}</select></label>
            <p className="text-xs text-slate-500">{item.book.chapters.length} chapters · {item.book.totalWords.toLocaleString()} words · about {Math.ceil(item.book.totalDurationSec / 60)} minutes</p>
          </>}
          {item.error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{item.error}</p>}
          {!busy && !item.saved && <button className="text-xs underline text-slate-500" onClick={() => setItems(prev => prev.filter((_, i) => i !== index))}>Remove from import list</button>}
        </div>)}
      </div>
      <footer className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
        <button disabled={busy} onClick={onClose} className="px-4 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40">Close</button>
        <button id="confirm-import-epub-btn" disabled={busy || !pendingCount} onClick={save} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-40">{busy ? 'Working…' : `Add ${pendingCount || ''} book${pendingCount === 1 ? '' : 's'}`}</button>
      </footer>
    </section>
  </div>;
}
