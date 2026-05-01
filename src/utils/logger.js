/**
 * Logger Utility - Centralized logging with environment control
 *
 * Usage:
 * - Production: DEBUG=false in .env → no logs
 * - Development: DEBUG=true in .env → all logs
 * - Per-module: logger.enable('rasterProcessing') for selective logging
 */

const DEBUG = import.meta.env.VITE_DEBUG === 'true' || false
const ENABLED_MODULES = new Set()

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function format(type, module, message, color) {
  const timestamp = new Date().toLocaleTimeString()
  const prefix = `[${timestamp}] ${type}`

  if (typeof message === 'object') {
    return `${prefix} ${module}:`, message
  }

  return `${color}${prefix}${colors.reset} ${colors.bright}${module}${colors.reset}: ${message}`
}

const logger = {
  /**
   * Enable logging for specific module
   */
  enable(moduleName) {
    ENABLED_MODULES.add(moduleName)
  },

  /**
   * Disable logging for specific module
   */
  disable(moduleName) {
    ENABLED_MODULES.delete(moduleName)
  },

  /**
   * Check if module logging is enabled
   */
  isEnabled(moduleName) {
    return DEBUG || ENABLED_MODULES.has(moduleName)
  },

  /**
   * Debug log
   */
  debug(module, message, data) {
    if (!this.isEnabled(module)) return

    if (data !== undefined) {
      console.debug(format('DEBUG', module, message, colors.cyan), data)
    } else {
      console.debug(format('DEBUG', module, message, colors.cyan))
    }
  },

  /**
   * Info log
   */
  info(module, message, data) {
    if (!this.isEnabled(module)) return

    if (data !== undefined) {
      console.info(format('INFO', module, message, colors.blue), data)
    } else {
      console.info(format('INFO', module, message, colors.blue))
    }
  },

  /**
   * Success log
   */
  success(module, message, data) {
    if (!this.isEnabled(module)) return

    if (data !== undefined) {
      console.log(format('✓', module, message, colors.green), data)
    } else {
      console.log(format('✓', module, message, colors.green))
    }
  },

  /**
   * Warning log
   */
  warn(module, message, data) {
    // Always log warnings, regardless of DEBUG setting
    if (data !== undefined) {
      console.warn(format('⚠ WARN', module, message, colors.yellow), data)
    } else {
      console.warn(format('⚠ WARN', module, message, colors.yellow))
    }
  },

  /**
   * Error log
   */
  error(module, message, error) {
    // Always log errors, regardless of DEBUG setting
    if (error instanceof Error) {
      console.error(
        format('✗ ERROR', module, message, colors.red),
        error.message
      )
      if (DEBUG) {
        console.error(colors.dim + error.stack + colors.reset)
      }
    } else if (error !== undefined) {
      console.error(format('✗ ERROR', module, message, colors.red), error)
    } else {
      console.error(format('✗ ERROR', module, message, colors.red))
    }
  },

  /**
   * Performance timing
   */
  time(label) {
    return {
      end: () => {
        console.log(`${colors.magenta}⏱ ${label}${colors.reset}`)
      }
    }
  }
}

export default logger

/**
 * Example usage in modules:
 *
 * // In rasterProcessing.js
 * import logger from './logger'
 *
 * export async function parseGeoTIFF(file, targetCRS) {
 *   logger.info('rasterProcessing', 'Starting parse', { file: file.name })
 *
 *   try {
 *     const result = await parseFile(file)
 *     logger.success('rasterProcessing', 'Parse completed')
 *     return result
 *   } catch (err) {
 *     logger.error('rasterProcessing', 'Parse failed', err)
 *     throw err
 *   }
 * }
 *
 * // In components
 * useEffect(() => {
 *   logger.debug('RasterViewer', 'Rendering', { width, height })
 * }, [width, height])
 */
