import React, { useState } from 'react';
import { Member, ChurchSettings, Department } from '../types';
import { BookOpen, Library, FileText } from 'lucide-react';
import EnseignementModule from './EnseignementModule';
import LibraryModule from './LibraryModule';
import DocumentsModule from './DocumentsModule';

interface RessourcesModuleProps {
  members: Member[];
  settings: ChurchSettings | null;
  departments: Department[];
}

export default function RessourcesModule({ members, settings, departments }: RessourcesModuleProps) {
  const [subTab, setSubTab] = useState<'enseignement' | 'bibliotheque' | 'documents'>('enseignement');

  return (
    <div className="space-y-4 font-sans">
      <div>
        <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight">Ressources</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Enseignements, bibliothèque et documents de l'église.</p>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-600 flex gap-4 text-xs font-bold overflow-x-auto shrink-0 pb-0.5">
        <button onClick={() => setSubTab('enseignement')}
          className={`pb-2.5 px-1 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            subTab === 'enseignement' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}>
          <BookOpen className="w-3.5 h-3.5" /> Enseignement
        </button>
        <button onClick={() => setSubTab('bibliotheque')}
          className={`pb-2.5 px-1 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            subTab === 'bibliotheque' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}>
          <Library className="w-3.5 h-3.5" /> Bibliothèque
        </button>
        <button onClick={() => setSubTab('documents')}
          className={`pb-2.5 px-1 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            subTab === 'documents' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}>
          <FileText className="w-3.5 h-3.5" /> Documents
        </button>
      </div>

      {subTab === 'enseignement' && <EnseignementModule settings={settings} members={members} departments={departments} />}
      {subTab === 'bibliotheque' && <LibraryModule members={members} />}
      {subTab === 'documents' && <DocumentsModule settings={settings} members={members} />}
    </div>
  );
}
