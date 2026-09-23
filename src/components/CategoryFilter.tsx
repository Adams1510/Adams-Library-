import React from 'react';
import { BookCategory } from '../types';
import { Compass, Moon, Brain, Radio, UploadCloud } from 'lucide-react';

interface CategoryFilterProps {
  selectedCategory: string; // 'All' | BookCategory
  onSelectCategory: (cat: string) => void;
  categoryCounts: {
    all: number;
    islamic: number;
    psychological: number;
    contemporary: number;
    custom: number;
  };
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts,
}) => {
  const tabs = [
    {
      id: 'All',
      label: 'All Books',
      icon: Compass,
      count: categoryCounts.all,
      activeColor: 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30',
    },
    {
      id: 'Islamic',
      label: 'Islamic Literature',
      icon: Moon,
      count: categoryCounts.islamic,
      activeColor: 'bg-emerald-700 text-white border-emerald-600 shadow-emerald-950/40',
    },
    {
      id: 'Psychological',
      label: 'Psychology & Mind',
      icon: Brain,
      count: categoryCounts.psychological,
      activeColor: 'bg-indigo-700 text-white border-indigo-600 shadow-indigo-950/40',
    },
    {
      id: 'Contemporary',
      label: 'Contemporary Thought',
      icon: Radio,
      count: categoryCounts.contemporary,
      activeColor: 'bg-amber-700 text-white border-amber-600 shadow-amber-950/40',
    },
    {
      id: 'Custom',
      label: 'My Uploads',
      icon: UploadCloud,
      count: categoryCounts.custom,
      activeColor: 'bg-teal-700 text-white border-teal-600 shadow-teal-950/40',
    },
  ];

  return (
    <div className="w-full overflow-x-auto pb-2 scrollbar-none">
      <div className="flex items-center gap-2 sm:gap-3 min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedCategory === tab.id;

          return (
            <button
              key={tab.id}
              id={`category-tab-${tab.id.toLowerCase()}`}
              onClick={() => onSelectCategory(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all duration-200 shadow-xs ${
                isSelected
                  ? `${tab.activeColor} shadow-md scale-[1.02]`
                  : 'bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`} />
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isSelected
                    ? 'bg-black/25 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
