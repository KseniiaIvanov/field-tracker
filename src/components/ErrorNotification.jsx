import { useState, useEffect } from 'react'

/**
 * Error Notification Component
 * Global error display with auto-dismiss
 */
export default function ErrorNotification({ message, onDismiss, type = 'error', duration = 5000 }) {
  const [isVisible, setIsVisible] = useState(!!message)

  useEffect(() => {
    setIsVisible(!!message)

    if (!message) return

    const timer = setTimeout(() => {
      setIsVisible(false)
      onDismiss?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [message, duration, onDismiss])

  if (!isVisible || !message) return null

  const bgColor = {
    error: 'rgba(220, 53, 69, 0.95)',
    warning: 'rgba(255, 193, 7, 0.95)',
    success: 'rgba(40, 167, 69, 0.95)',
    info: 'rgba(23, 162, 184, 0.95)'
  }[type] || 'rgba(220, 53, 69, 0.95)'

  const textColor = {
    error: '#fff',
    warning: '#000',
    success: '#fff',
    info: '#fff'
  }[type] || '#fff'

  const icon = {
    error: '❌',
    warning: '⚠️',
    success: '✅',
    info: 'ℹ️'
  }[type] || '❌'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: bgColor,
        color: textColor,
        padding: '16px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
        maxWidth: '400px',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'slideIn 0.3s ease-out',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        fontWeight: '500',
        lineHeight: '1.4'
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={() => {
          setIsVisible(false)
          onDismiss?.()
        }}
        style={{
          background: 'none',
          border: 'none',
          color: textColor,
          cursor: 'pointer',
          fontSize: '18px',
          padding: '0',
          flexShrink: 0,
          opacity: 0.8,
          hover: { opacity: 1 }
        }}
      >
        ✕
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
