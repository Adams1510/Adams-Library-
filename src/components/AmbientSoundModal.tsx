import React from 'react';
import { CloudRain, BookOpen, Waves, Droplets, Volume2, VolumeX, X } from 'lucide-react';

interface AmbientSoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  ambientSound: 'none' | 'rain' | 'library' | 'stream' | 'waves';
  ambientVolume: number;
  onSelectSound: (sound: 'none' | 'rain' | 'library' | 'stream' | 'waves') => void;
  onChangeVolume: (vol: number) => void;
}

export const AmbientSoundModal: React.FC<AmbientSoundModalProps> = ({
  isOpen,
  onClose,
  ambientSound,
  ambientVolume,
  onSelectSound,
  onChangeVolume,
}) => {
  if (!isOpen) return null;

  const soundOptions = [
    {
      id: 'none' as const,
      name: 'None (Pure Narration)',
      icon: VolumeX,
      description: 'Zero background noise, clean audiobook voice only.',
    },
    {
      id: 'rain' as const,
      name: 'Gentle Rain on Window',
      icon: CloudRain,
      description: 'Soothing low-frequency raindrops for deep concentration.',
    },
    {
      id: 'library' as const,
      name: 'Quiet Library White Noise',
      icon: BookOpen,
      description: 'Warm acoustic noise simulating a peaceful reading hall.',
    },
    {
      id: 'stream' as const,
      name: 'Mountain Forest Stream',
      icon: Droplets,
      description: 'Serene trickling water for meditative and spiritual reading.',
    },
    {
      id: 'waves' as const,
      name: 'Gentle Ocean Swell',
      icon: Waves,
      description: 'Slow rhythmic waves designed for evening contemplation.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <CloudRain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Ambient Focus Mixer
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mix subtle background atmosphere with narration
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ambient Sound Presets */}
        <div className="my-5 space-y-2">
          {soundOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = ambientSound === opt.id;

            return (
              <div
                key={opt.id}
                onClick={() => onSelectSound(opt.id)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                  isSelected
                    ? 'bg-teal-50 dark:bg-teal-950/70 border-teal-500 text-slate-900 dark:text-white shadow-md shadow-teal-950/20'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  isSelected ? 'bg-teal-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold truncate text-slate-900 dark:text-slate-100">{opt.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{opt.description}</p>
                </div>

                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Volume Slider */}
        {ambientSound !== 'none' && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 my-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Ambient Mixer Level
              </span>
              <span className="font-mono text-teal-600 dark:text-teal-400 font-bold">{Math.round(ambientVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={ambientVolume}
              onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
              className="w-full accent-teal-500 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer h-2"
            />
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
          >
            Apply & Close
          </button>
        </div>

      </div>
    </div>
  );
};
