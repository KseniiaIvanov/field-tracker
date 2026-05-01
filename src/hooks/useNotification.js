import { useState, useCallback } from 'react'

/**
 * Custom hook for managing notifications
 * Usage: const { showError, showSuccess, showWarning, notification } = useNotification()
 */
export function useNotification() {
  const [notification, setNotification] = useState(null)

  const show = useCallback((message, type = 'info', duration = 5000) => {
    setNotification({ message, type, id: Date.now() })

    if (duration > 0) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [])

  const showError = useCallback((message, duration = 5000) => {
    console.error('Error notification:', message)
    return show(message, 'error', duration)
  }, [show])

  const showSuccess = useCallback((message, duration = 3000) => {
    console.log('Success notification:', message)
    return show(message, 'success', duration)
  }, [show])

  const showWarning = useCallback((message, duration = 4000) => {
    console.warn('Warning notification:', message)
    return show(message, 'warning', duration)
  }, [show])

  const showInfo = useCallback((message, duration = 3000) => {
    console.info('Info notification:', message)
    return show(message, 'info', duration)
  }, [show])

  const dismiss = useCallback(() => {
    setNotification(null)
  }, [])

  return {
    notification,
    show,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    dismiss
  }
}

export default useNotification
