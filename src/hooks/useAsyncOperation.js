import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Custom hook for managing async operations with error handling
 * Automatically handles mounting state to prevent memory leaks
 *
 * @param {Function} asyncFn - Async function to execute
 * @param {boolean} executeOnMount - Whether to run immediately
 * @returns {Object} - {execute, data, error, isLoading}
 */
export function useAsyncOperation(asyncFn, executeOnMount = false) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(executeOnMount)
  const isMounted = useRef(true)
  const abortController = useRef(new AbortController())

  const execute = useCallback(async (...args) => {
    try {
      if (!isMounted.current) return

      setIsLoading(true)
      setError(null)

      const result = await asyncFn(...args, abortController.current.signal)

      if (isMounted.current) {
        setData(result)
        setError(null)
      }
      return result
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        return null
      }

      console.error('Async operation error:', err)
      if (isMounted.current) {
        setError(err)
        setData(null)
      }
      throw err
    } finally {
      if (isMounted.current) {
        setIsLoading(false)
      }
    }
  }, [asyncFn])

  // Auto-execute on mount if requested
  useEffect(() => {
    if (executeOnMount) {
      execute()
    }

    return () => {
      isMounted.current = false
      abortController.current.abort()
    }
  }, [executeOnMount, execute])

  return { execute, data, error, isLoading }
}

export default useAsyncOperation
