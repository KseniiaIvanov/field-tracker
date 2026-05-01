import { useState, useEffect, useCallback, useRef } from 'react'
import localforage from 'localforage'

/**
 * Custom hook for safely handling async storage operations
 * Handles errors, debouncing, and prevents race conditions
 *
 * @param {string} key - Storage key
 * @param {*} initialValue - Default value
 * @param {number} debounceMs - Debounce delay for writes
 * @returns {[value, setValue, error, isLoading]} - State tuple
 */
export function useAsyncStorage(key, initialValue, debounceMs = 1000) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const debounceTimer = useRef(null)
  const isMounted = useRef(true)

  // Load from storage on mount
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const stored = await localforage.getItem(key)
        if (isMounted.current) {
          setValue(stored !== null ? stored : initialValue)
        }
      } catch (err) {
        console.error(`Error loading ${key} from storage:`, err)
        if (isMounted.current) {
          setError(err)
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false)
        }
      }
    }

    load()
    return () => {
      isMounted.current = false
    }
  }, [key])

  // Save to storage with debouncing
  const setValueWithSave = useCallback(
    (newValue) => {
      // Update local state immediately for responsive UI
      setValue(newValue)
      setError(null)

      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }

      // Set new debounced save
      debounceTimer.current = setTimeout(async () => {
        try {
          if (isMounted.current) {
            await localforage.setItem(key, newValue)
          }
        } catch (err) {
          console.error(`Error saving ${key} to storage:`, err)
          if (isMounted.current) {
            setError(err)
          }
        }
      }, debounceMs)
    },
    [key, debounceMs]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  return [value, setValueWithSave, error, isLoading]
}

export default useAsyncStorage
