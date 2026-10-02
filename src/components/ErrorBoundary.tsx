import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-6 text-center select-none">
          {/* Subtle liquid background glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 via-black to-black pointer-events-none" />

          <div className="relative z-10 max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-5 text-red-500">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="text-xl font-black text-white mb-2">
              Si è verificato un errore
            </h1>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              L'applicazione ha riscontrato un problema imprevisto durante la riproduzione o il caricamento della pagina.
            </p>

            {this.state.error && (
              <div className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 mb-6 text-left overflow-x-auto">
                <p className="text-[11px] font-mono text-red-400 truncate">
                  {this.state.error.message || 'Errore sconosciuto'}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-red-950/50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Ricarica App</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-bold text-sm text-zinc-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
