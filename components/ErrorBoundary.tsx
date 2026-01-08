import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Fix: Explicitly extending Component with Props and State generics to ensure property recognition
export class ErrorBoundary extends Component<Props, State> {
  // Fix: Explicitly declare the props property to resolve property-not-found errors during compilation
  public props: Props;

  // Fix: Explicitly declare the state property to resolve property-not-found errors during compilation
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
    // Fix: Re-initialize state in constructor if necessary, though property initialization above is preferred
    this.state = {
      hasError: false,
      error: null
    };
    // Fix: Explicitly assign props to resolve property-not-found errors on line 70
    this.props = props;
  }

  // Fix: Static method to update state after an error occurs
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // Fix: Component method to catch errors for side-effects like logging
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    // Fix: Accessing state via 'this.state' which is now explicitly declared and initialized
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-red-500/50 rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
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
              className="bg-gold-500 hover:bg-gold-400 text-black font-bold py-2 px-6 rounded-lg flex items-center justify-center mx-auto transition-colors"
            >
              <RefreshCw size={18} className="mr-2" /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    // Fix: Accessing props via 'this.props' which is inherited from the generic Component class
    return this.props.children;
  }
}
