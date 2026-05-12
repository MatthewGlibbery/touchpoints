import { StrictMode, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/global.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: 16, fontFamily: 'system-ui, sans-serif', padding: 32,
          background: '#F5F6F8',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>Something went wrong</div>
          <div style={{
            maxWidth: 560, padding: '12px 16px', borderRadius: 8,
            background: '#fff', border: '1px solid #e5e7eb',
            fontSize: 13, color: '#374151', fontFamily: 'monospace',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {error.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#2563EB', color: '#fff', fontSize: 14,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
