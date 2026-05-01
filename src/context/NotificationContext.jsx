import { createContext, useContext, useState, useCallback } from 'react'
import ErrorNotification from '../components/ErrorNotification'

/**
 * Global Notification Context
 * Provides notification system across entire app
 */
const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const [notification, setNotification] = useState(null)

  const show = useCallback((message, type = 'info', duration = 5000) => {
    setNotification({ message, type, id: Date.now() })

    if (duration > 0) {
      setTimeout(() => {
        setNotification(null)
      }, duration)
    }
  }, [])

  const showError = useCallback((message, duration = 5000) => {
    console.error('Error:', message)
    show(message, 'error', duration)
  }, [show])

  const showSuccess = useCallback((message, duration = 3000) => {
    show(message, 'success', duration)
  }, [show])

  const showWarning = useCallback((message, duration = 4000) => {
    show(message, 'warning', duration)
  }, [show])

  const showInfo = useCallback((message, duration = 3000) => {
    show(message, 'info', duration)
  }, [show])

  const dismiss = useCallback(() => {
    setNotification(null)
  }, [])

  const value = {
    notification,
    show,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    dismiss
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {notification && (
        <ErrorNotification
          message={notification.message}
          type={notification.type}
          onDismiss={dismiss}
          duration={5000}
        />
      )}
    </NotificationContext.Provider>
  )
}

export function useNotificationContext() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider')
  }
  return context
}

export default NotificationContext
