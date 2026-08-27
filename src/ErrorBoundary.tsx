import { Component, type ErrorInfo, type ReactNode } from "react";

// Red de contención para errores inesperados durante el render (ej: un dato
// raro que vino de Supabase). Sin esto, cualquier excepción no capturada deja
// la pantalla completamente en blanco, sin ningún mensaje para quien visita
// el sitio ni pista alguna salvo la consola del navegador.
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error no controlado en la app:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#FAF7F2" }}>
          <div className="max-w-md text-center p-8 rounded-2xl" style={{ background: "#FFFFFF", border: "1px solid #DDD8CF" }}>
            <p style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>⚠️</p>
            <p style={{ color: "#1A1A18", fontWeight: 500, marginBottom: "0.5rem", fontFamily: "Fraunces, Georgia, serif", fontSize: "1.1rem" }}>Algo salió mal</p>
            <p style={{ color: "#5A5A56", fontSize: "0.85rem", marginBottom: "1.5rem" }}>Ocurrió un error inesperado. Probá recargar la página; si el problema sigue, avisale al administrador.</p>
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-xl font-medium transition-all hover:opacity-80" style={{ background: "#2D4A22", color: "#FAF7F2", fontSize: "0.85rem" }}>
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
