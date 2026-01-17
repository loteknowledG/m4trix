"use client";

import React from "react";

type State = { hasError: boolean; error?: Error | null; info?: React.ErrorInfo | null };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error } as State;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // log to console and leave state for rendering
    console.error("ErrorBoundary caught:", error, info);
    this.setState({ hasError: true, error, info });
  }

  render() {
    if (!this.state.hasError) return this.props.children as React.ReactElement;

    const err = this.state.error;
    const stack = this.state.info?.componentStack || (err && (err.stack ?? "")) || "No stack available";

    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto bg-red-50 border border-red-200 rounded p-4">
          <h2 className="text-xl font-semibold text-red-800 mb-2">An error occurred while rendering this view</h2>
          <div className="text-sm text-muted-foreground mb-4">The app logged the error to the console for debugging.</div>
          <details className="bg-white p-2 rounded text-xs text-red-700 whitespace-pre-wrap overflow-auto max-h-64">
            <summary className="cursor-pointer mb-2">Show error details</summary>
            <div>
              <strong>{err?.name}</strong>: {err?.message}
            </div>
            <pre className="mt-2 text-[11px]">{stack}</pre>
          </details>
        </div>
      </div>
    );
  }
}
