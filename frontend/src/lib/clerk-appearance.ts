import type { Appearance } from '@clerk/types';

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: '#0d9488',
    colorText: '#0f172a',
    colorTextSecondary: '#64748b',
    colorBackground: '#ffffff',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full max-w-md',
    cardBox: 'w-full shadow-none',
    card: 'w-full shadow-none border border-slate-200 rounded-2xl p-6',
    headerTitle: 'text-slate-900 font-outfit',
    headerSubtitle: 'text-slate-500',
    formButtonPrimary:
      'bg-teal-600 hover:bg-teal-700 text-white rounded-xl normal-case shadow-sm',
    formFieldInput: 'rounded-xl border-slate-200',
    footerActionLink: 'text-teal-600 hover:text-teal-700',
    identityPreviewEditButton: 'text-teal-600',
  },
};
