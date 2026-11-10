import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker with autoUpdate
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[COBOS PWA] New version available.');
  },
  onOfflineReady() {
    console.log('[COBOS PWA] Cold Start ready: App is 100% offline-ready.');
  },
});

createRoot(document.getElementById('root')!).render(<App />);
