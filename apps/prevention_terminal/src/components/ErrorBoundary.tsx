import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { reportFrontendError } from "../lib/frontend_telemetry.ts";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
    reportFrontendError(error, `React ComponentStack: ${errorInfo.componentStack?.slice(0, 300)}`);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "20px"
        }}>
          <div style={{
            maxWidth: "560px",
            width: "100%",
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)",
            border: "1px solid #e2e8f0",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "42px", marginBottom: "16px" }}>🛡️</div>
            <h2 style={{ fontSize: "1.35rem", color: "#1e293b", margin: "0 0 10px 0", fontWeight: 600 }}>
              Обнаружена ошибка интерфейса
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#64748b", margin: "0 0 20px 0", lineHeight: 1.5 }}>
              Система автоматически зафиксировала сбой и уже передала отчёт с кодом ошибки нашему автономному AI-сторожу.
            </p>

            {this.state.error && (
              <div style={{
                textAlign: "left",
                backgroundColor: "#f1f5f9",
                padding: "12px 16px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                color: "#475569",
                fontFamily: "monospace",
                marginBottom: "24px",
                overflowX: "auto",
                border: "1px solid #e2e8f0"
              }}>
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  fontWeight: 500,
                  fontSize: "0.9rem",
                  cursor: "pointer"
                }}
              >
                Попробовать снова
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 500,
                  fontSize: "0.9rem",
                  cursor: "pointer"
                }}
              >
                Перезагрузить страницу
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
