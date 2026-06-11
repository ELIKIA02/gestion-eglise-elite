import React, { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center space-y-4">
          <div className="text-rose-600 text-4xl">!</div>
          <h3 className="font-bold text-slate-700 text-lg">Une erreur est survenue</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">{this.state.error?.message}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer">
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
