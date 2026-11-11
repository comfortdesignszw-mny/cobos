import React from 'react';
import { Heart } from 'lucide-react';

interface FooterProps {
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenTerms, onOpenPrivacy }) => {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-950/90 py-4 px-4 text-center text-xs text-slate-400 space-y-2 shrink-0">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <button
          onClick={onOpenTerms}
          className="hover:text-cyan-400 transition underline underline-offset-2"
        >
          Terms of Service
        </button>
        <span className="text-slate-700">•</span>
        <button
          onClick={onOpenPrivacy}
          className="hover:text-cyan-400 transition underline underline-offset-2"
        >
          Privacy Policy
        </button>
        <span className="text-slate-700">•</span>
        <span className="text-slate-400">Multi-Currency (USD • ZiG • ZAR)</span>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-medium text-slate-300">
          &copy; 2026 COBOS. All Rights Reserved.
        </p>
        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
          <span>Developed with</span>
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline-block animate-pulse" />
          <span>by Comfort Designs -</span>
          <a
            href="tel:+263772824132"
            className="text-cyan-400 hover:underline font-mono font-medium"
          >
            +263772824132
          </a>
        </p>
      </div>
    </footer>
  );
};
