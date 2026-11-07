import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from './components/ui/Toast';
import { I18nProvider } from './i18n';
import './index.css';
import { initAnalyticsWhenIdle } from './analytics';
import ConsentBanner from './components/ConsentBanner';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      {/* Respect prefers-reduced-motion for all Motion animations. */}
      <MotionConfig reducedMotion="user">
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
        <ConsentBanner />
        <Toaster />
      </MotionConfig>
    </I18nProvider>
  </StrictMode>,
);

// Analytics (Amplitude) loads lazily after the first render, and only if the user accepted it.
initAnalyticsWhenIdle();
