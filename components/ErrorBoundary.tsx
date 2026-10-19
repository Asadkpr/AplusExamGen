import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component to catch JavaScript errors anywhere in their child component tree,
 * log those errors, and display a fallback UI instead of the component tree that crashed.
 */
// Explicitly extending React.Component with Props and State to ensure 'this.props' is correctly recognized.
export class ErrorBoundary extends React.Component<Props, State> {
  // Remove override as it causes issues with React.Component inheritance detection
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  // Remove override as it causes issues with React.Component inheritance detection
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  // Remove override as it causes issues with React.Component inheritance detection
  public render(): ReactNode {
    if (this.state.hasError) {
      // Fallback UI when an error occurs in the child component tree
      return (
        <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
          <div className="bg-[#1f2937] border border-red-500/50 rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              The application encountered an unexpected error.
            </p>
            <div className="bg-black/30 p-3 rounded text-left mb-6 overflow-auto max-h-32">
               <code className="text-xs text-red-300 font-mono">
                 {this.state.error?.message || "Unknown Error"}
               </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#f59e0b] hover:bg-[#fbbf24] text-black font-bold py-2 px-6 rounded-lg flex items-center justify-center mx-auto transition-colors"
            >
              <RefreshCw size={18} className="mr-2" /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    // Default rendering of children if no error occurred.
    // Casting 'this' to React.Component if inheritance is not correctly inferred in this environment.
    return (this as React.Component<Props, State>).props.children;
  }
}