'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, CheckCircle2, Smartphone, Share } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallState = 'waiting' | 'ready' | 'installed' | 'ios';

/**
 * PWA Download / Install button.
 *
 * Behaviour per platform:
 *   Chrome / Edge / Android  →  captures beforeinstallprompt, shows "Download" button,
 *                                on click triggers native install prompt.
 *   iOS Safari               →  shows "Add to Home Screen" instructions modal
 *                                (iOS never fires beforeinstallprompt).
 *   Already installed        →  button shows "Installed ✓" and is disabled.
 *   Other browsers           →  button is not rendered at all.
 */
export function DownloadButton({ className = '' }: { className?: string }) {
  const [state, setState] = useState<InstallState>('waiting');
  const [showIosModal, setShowIosModal] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const { toast, container: toastContainer } = useToast();

  useEffect(() => {
    // Detect iOS Safari
    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window as { MSStream?: unknown }).MSStream;
    const isInStandaloneMode =
      'standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone;

    if (isIos && !isInStandaloneMode) {
      setState('ios');
      return;
    }

    // Already installed as PWA (display-mode: standalone)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setState('installed');
      return;
    }

    // Chrome / Edge / Android — wait for the browser's install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setState('ready');
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      setState('installed');
      promptRef.current = null;
      toast('WorkWise has been installed to your device! 🎉', 'success');
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [toast]);

  async function handleInstallClick() {
    if (state === 'ios') {
      setShowIosModal(true);
      return;
    }

    if (!promptRef.current) return;

    await promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;

    if (outcome === 'accepted') {
      setState('installed');
    } else {
      // User dismissed — keep the button available for next time
      toast('Installation cancelled. You can install anytime from this page.', 'info');
    }
    promptRef.current = null;
  }

  // Don't render anything if no install mechanism is available
  if (state === 'waiting') return null;

  return (
    <>
      {toastContainer}

      {/* Main button */}
      <button
        onClick={handleInstallClick}
        disabled={state === 'installed'}
        className={`inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all ${
          state === 'installed'
            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 cursor-default'
            : 'bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:-translate-y-0.5'
        } ${className}`}
      >
        {state === 'installed' ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Installed ✓
          </>
        ) : state === 'ios' ? (
          <>
            <Smartphone className="h-4 w-4" />
            Add to Home Screen
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Download App
          </>
        )}
      </button>

      {/* iOS instructions modal */}
      {showIosModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowIosModal(false)}
        >
          <div
            className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-teal-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg font-outfit">W</span>
              </div>
              <div>
                <h3 className="font-bold text-white">Install WorkWise</h3>
                <p className="text-xs text-slate-400">Add to your iPhone Home Screen</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { step: '1', text: 'Tap the Share button', icon: <Share className="h-4 w-4 text-blue-400" /> },
                { step: '2', text: 'Scroll down and tap "Add to Home Screen"', icon: <span className="text-blue-400 font-bold text-xs">⊕</span> },
                { step: '3', text: 'Tap "Add" in the top right corner', icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" /> },
              ].map(({ step, text, icon }) => (
                <div key={step} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                  <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    {icon}
                  </div>
                  <p className="text-sm text-slate-300">{text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowIosModal(false)}
              className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
