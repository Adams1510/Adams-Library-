import { Book, VoiceOption } from '../types';

/**
 * Clean initial state: Zero placeholder books by default as requested.
 * The library starts pristine and ready for custom ePub uploads.
 */
export const INITIAL_BOOKS: Book[] = [];

/**
 * Pre-configured voice synthesis profiles for Gemini AI TTS and Native Device Speech.
 */
export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: 'gemini-kore',
    name: 'Kore (Gemini Studio AI)',
    engine: 'gemini' as const,
    geminiVoiceName: 'Kore' as const,
    gender: 'Female' as const,
    description: 'Calm, contemplative, expressive timbre optimal for spiritual & psychological reflection.',
    accent: 'Serene Warm'
  },
  {
    id: 'gemini-puck',
    name: 'Puck (Gemini Studio AI)',
    engine: 'gemini' as const,
    geminiVoiceName: 'Puck' as const,
    gender: 'Male' as const,
    description: 'Crisp, engaging, articulate narrator with modern rhythm.',
    accent: 'Contemporary'
  },
  {
    id: 'gemini-fenrir',
    name: 'Fenrir (Gemini Studio AI)',
    engine: 'gemini' as const,
    geminiVoiceName: 'Fenrir' as const,
    gender: 'Male' as const,
    description: 'Deep, resonant, authoritative baritone for classic literature.',
    accent: 'Deep Warm'
  },
  {
    id: 'gemini-zephyr',
    name: 'Zephyr (Gemini Studio AI)',
    engine: 'gemini' as const,
    geminiVoiceName: 'Zephyr' as const,
    gender: 'Female' as const,
    description: 'Gentle, soothing, mindfulness and spiritual specialist.',
    accent: 'Soft Melodic'
  },
  {
    id: 'gemini-charon',
    name: 'Charon (Gemini Studio AI)',
    engine: 'gemini' as const,
    geminiVoiceName: 'Charon' as const,
    gender: 'Male' as const,
    description: 'Philosophical, measured, academic and reflective cadence.',
    accent: 'Reflective'
  },
  {
    id: 'browser-natural',
    name: 'Device Native Audio Narrator',
    engine: 'browser' as const,
    gender: 'Neutral' as const,
    description: 'Instant zero-latency device speech synthesis with synchronized text highlighting.',
    accent: 'System High-Speed'
  }
];
