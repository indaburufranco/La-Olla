import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from './ErrorBoundary'

const root = ReactDOM.createRoot(document.getElementById('root')!)

// Si faltan las variables de entorno de Supabase, ./App (a través de
// ./lib/supabase) tira una excepción apenas se importa, antes de que React
// llegue a montar nada — eso deja la pantalla en blanco sin ningún mensaje.
// Por eso el chequeo va acá, antes de siquiera importar App, y con un
// import() dinámico para no arrastrar esa cadena de imports si falta algo.
const missingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY

if (missingEnv) {
  root.render(
    <React.StrictMode>
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#FAF7F2' }}>
        <div className="max-w-md text-center p-8 rounded-2xl" style={{ background: '#FFFFFF', border: '1px solid #DDD8CF' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⚠️</p>
          <p style={{ color: '#1A1A18', fontWeight: 500, marginBottom: '0.5rem', fontFamily: 'Fraunces, Georgia, serif', fontSize: '1.1rem' }}>No pudimos cargar el sitio</p>
          <p style={{ color: '#5A5A56', fontSize: '0.85rem' }}>Faltan las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisá la configuración del proyecto en Vercel (o el archivo .env en local).</p>
        </div>
      </div>
    </React.StrictMode>,
  )
} else {
  import('./App').then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    )
  })
}
