import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from './components/ui/Toast';
import { I18nProvider } from './i18n';
import './index.css';
import { initAnalyticsWhenIdle } from './analytics';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      {/* Respect prefers-reduced-motion for all Motion animations. */}
      <MotionConfig reducedMotion="user">
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
        <Toaster />
      </MotionConfig>
    </I18nProvider>
  </StrictMode>,
);

// Analytics (Amplitude) is loaded lazily after the first render so it doesn't block startup.
initAnalyticsWhenIdle();
