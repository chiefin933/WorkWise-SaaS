'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, CheckCircle2, Smartphone, Share, Globe } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallState = 'waiting' | 'ready' | 'installed' | 'ios' | 'browser';

/**
 * PWA Download / Install button.
 *
 * Behaviour per platform:
 *   Chrome / Edge / Android  →  captures beforeinstallprompt, shows "Download App"
 *                                button, on click triggers native install prompt.
 *   iOS Safari               →  shows "Add to Home Screen" instructions modal.
 *   Already installed        →  button shows "Installed ✓" and is disabled.
 *   Other browsers / desktop →  shows "Open in Browser" — WorkWise is a web app,
 *                                no download required. Button links to register.
 */
export function DownloadButton({ className = '' }: { className?: string }) {
  const [state, setState] = useState<InstallState>('waiting');
  const [showIosModal, setShowIosModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const { toast, container: toastContainer } = useToast();

  useEffect(() => {
    // Detect iOS Safari
    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window as { MSStream?: unknown }).MSStream;
    const isInStandaloneMode =
      'standalone' in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone;

    if (isIos && !isInStandaloneMode) {
      setState('ios');
      return;
    }

    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setState('installed');
      return;
    }

    // Chrome / Edge / Android — wait for the browser install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setState('ready');
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setState('installed');
      promptRef.current = null;
      toast('WorkWise has been installed to your device!', 'success');
    });

    // After a short wait, if no install prompt fired this browser doesn't support PWA install
    const timer = setTimeout(() => {
      if (promptRef.current === null) {
        setState(prev => prev === 'waiting' ? 'browser' : prev);
      }
    }, 1500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, [toast]);

  async function handleInstallClick() {
    if (state === 'ios') { setShowIosModal(true); return; }
    if (state === 'browser') { setShowInfoModal(true); return; }
    if (!promptRef.current) return;

    await promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === 'accepted') {
      setState('installed');
    } else {
      toast('Installation cancelled. You can install anytime from this page.', 'info');
    }
    promptRef.current = null;
  }

  // Still detecting — render a neutral placeholder so layout doesn't shift
  if (state === 'waiting') {
    return (
      <div className={`inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-sm opacity-0 pointer-events-none ${className}`}>
        <Download className="h-4 w-4" /> Download App
      </div>
    );
  }

  return (
    <>
      {toastContainer}

      <button
        onClick={handleInstallClick}
        disabled={state === 'installed'}
        className={`inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all ${
          state === 'installed'
            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 cursor-default'
            : state === 'browser'
            ? 'border border-white/15 text-slate-300 hover:border-white/30 hover:text-white bg-white/5 hover:bg-white/10'
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/20 hover:-translate-y-0.5'
        } ${className}`}
      >
        {state === 'installed' ? (
          <><CheckCircle2 className="h-4 w-4" /> Installed ✓</>
        ) : state === 'ios' ? (
          <><Smartphone className="h-4 w-4" /> Add to Home Screen</>
        ) : state === 'browser' ? (
          <><Globe className="h-4 w-4" /> Works in your browser</>
        ) : (
          <><Download className="h-4 w-4" /> Download App</>
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
            onClick={e => e.stopPropagation()}
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
                { text: 'Tap the Share button at the bottom of Safari', icon: <Share className="h-4 w-4 text-blue-400" /> },
                { text: 'Scroll down and tap "Add to Home Screen"',     icon: <span className="text-blue-400 font-bold text-xs">⊕</span> },
                { text: 'Tap "Add" in the top right corner',            icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" /> },
              ].map(({ text, icon }, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                  <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">{icon}</div>
                  <p className="text-sm text-slate-300">{text}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowIosModal(false)}
              className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors">
              Got it
            </button>
          </div>
        </div>
      )}

      {/* "Works in browser" info modal for non-PWA-capable browsers */}
      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-teal-600 rounded-2xl flex items-center justify-center">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">No download needed</h3>
                <p className="text-xs text-slate-400">WorkWise works directly in your browser</p>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              WorkWise is a <strong className="text-white">web app</strong> — you access it by visiting
              the URL in any modern browser. No app store, no download, no installation required.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              If you use <strong className="text-white">Chrome or Edge</strong>, you can optionally
              install it to your desktop or home screen for a native app-like experience. Open this
              page in Chrome and the install button will appear automatically.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowInfoModal(false)}
                className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors">
                Got it
              </button>
              <a href="/auth/register"
                className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold text-center transition-colors">
                Start Free Trial
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
