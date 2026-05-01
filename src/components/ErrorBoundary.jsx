import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ ERROR BOUNDARY CAUGHT:', error)
    console.error('Stack:', error?.stack)
    console.error('Component stack:', errorInfo?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.toString() || 'Unknown error'
      const errorStack = this.state.error?.stack || ''

      return (
        <div style={{
          padding: '40px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          overflow: 'auto'
        }}>
          <h2 style={{ marginTop: 0 }}>❌ Application Error</h2>
          <div style={{
            backgroundColor: '#fff',
            padding: '16px',
            borderRadius: '4px',
            marginBottom: '16px',
            border: '2px solid #c62828',
            maxWidth: '900px',
            fontSize: '12px',
            color: '#333'
          }}>
            <div><strong>Error Message:</strong></div>
            <div style={{ marginBottom: '16px', color: '#d32f2f' }}>{errorMsg}</div>

            {errorStack && (
              <>
                <div><strong>Stack Trace:</strong></div>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '12px' }}>
                  {errorStack}
                </div>
              </>
            )}

            <div style={{ color: '#666', fontSize: '11px' }}>
              📝 Also check F12 Console (right-click → Inspect → Console tab) for additional details
            </div>
          </div>

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#d32f2f',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            🔄 Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
