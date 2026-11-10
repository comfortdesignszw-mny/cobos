import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 px-3 py-1.5 text-xs font-semibold shadow-sm transition-all"
        title="Install COBOS to Home Screen"
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-900/40 transition"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Add to iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  Install COBOS on iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">1</div>
                  <p>In Safari, tap the <strong>Share</strong> button at the bottom of the screen (the square with an arrow pointing up).</p>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">2</div>
                  <p>Scroll down the share sheet and tap <strong>"Add to Home Screen"</strong>.</p>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">3</div>
                  <p>Tap <strong>Add</strong> in the top-right corner. COBOS will launch in full-screen standalone mode even when offline!</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-800 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback direct install button for other environments
  return (
    <button
      onClick={() => alert('To install COBOS: In Chrome/Edge/Brave, tap the browser menu (⋮) and select "Install app" or "Add to Home Screen".')}
      className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 transition"
    >
      <Download className="w-3.5 h-3.5 text-cyan-400" />
      <span>Install PWA</span>
    </button>
  );
};
