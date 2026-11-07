import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { t } from '../i18n/core';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = t('errors.somethingWrong');
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = t('errors.noPermission');
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <main className="min-h-dvh flex items-center justify-center bg-canvas p-4">
          <div role="alert" className="max-w-md w-full bg-surface p-8 rounded-dialog shadow-raised border border-line text-center">
            <div className="size-14 bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="size-7" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold font-display text-fg mb-3">{t('errors.appError')}</h1>
            <p className="text-fg-muted mb-8">{errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-11 px-6 bg-brand-600 text-white rounded-control font-semibold hover:bg-brand-700 transition-colors"
            >
              {t('errors.reload')}
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
