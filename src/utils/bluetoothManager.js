/**
 * Web Bluetooth Manager for Xiaomi LYWSD03MMC Thermometer/Hygrometer
 * Discovers device and parses temperature + humidity from BLE advertisement
 */

import logger from './logger'

/**
 * Discover and connect to Xiaomi LYWSD03MMC sensor via Web Bluetooth API
 * Triggers native OS device picker (Android only)
 *
 * @returns {Promise<{temperature: number, humidity: number, success: boolean, error?: string}>}
 */
export async function discoverAndReadDevice() {
  // Check browser support
  if (!navigator.bluetooth) {
    return {
      success: false,
      error: '❌ Web Bluetooth not supported on this device. Use Chrome on Android.',
      temperature: null,
      humidity: null
    }
  }

  try {
    logger.debug('bluetoothManager', '🔍 Starting device discovery...')

    // Request device matching Xiaomi LYWSD patterns
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: 'LYWSD' },
        { namePrefix: 'MiTemp' },
        { namePrefix: 'Xiaomi' }
      ],
      optionalServices: [
        '0000180a-0000-1000-8000-00805f9b34fb', // Device Information Service
        '0000181a-0000-1000-8000-00805f9b34fb', // Environmental Sensing Service
        'generic_access'
      ]
    })

    logger.debug('bluetoothManager', `✅ Device discovered: ${device.name}`)
    console.log(`✅ Device discovered: ${device.name}`)

    // Connect to GATT server
    const server = await device.gatt.connect()
    logger.debug('bluetoothManager', '✅ GATT server connected')
    console.log('✅ GATT server connected')

    // Try to read from Environmental Sensing Service (temperature + humidity)
    // LYWSD03MMC exposes these via standard BLE characteristics
    let temperature = null
    let humidity = null

    try {
      // Environmental Sensing Service
      console.log('🔍 Trying Environmental Sensing Service (0x181a)...')
      const service = await server.getPrimaryService('0000181a-0000-1000-8000-00805f9b34fb')
      logger.debug('bluetoothManager', '✅ Environmental Sensing Service found')
      console.log('✅ Found Environmental Sensing Service')

      // Temperature Characteristic (UUID: 2a1c)
      try {
        const tempChar = await service.getCharacteristic('00002a1c-0000-1000-8000-00805f9b34fb')
        const tempValue = await tempChar.readValue()
        // Temperature is signed int16 in 0.01°C units
        const tempRaw = tempValue.getInt16(0, true)
        temperature = parseFloat((tempRaw / 100).toFixed(2))
        logger.debug('bluetoothManager', `🌡️ Temperature read: ${temperature}°C (raw: ${tempRaw})`)
      } catch (err) {
        logger.warn('bluetoothManager', 'Could not read temperature characteristic (2a1c):', err.message)
      }

      // Humidity Characteristic (UUID: 2a6f)
      try {
        const humidChar = await service.getCharacteristic('00002a6f-0000-1000-8000-00805f9b34fb')
        const humidValue = await humidChar.readValue()
        // Humidity is uint8 percentage (0-100)
        humidity = humidValue.getUint8(0)
        logger.debug('bluetoothManager', `💧 Humidity read: ${humidity}%`)
      } catch (err) {
        logger.warn('bluetoothManager', 'Could not read humidity characteristic (2a6f):', err.message)
      }
    } catch (serviceErr) {
      console.warn(`⚠️ Service 0x181a not available: ${serviceErr.message}`)
      logger.warn('bluetoothManager', 'Environmental Sensing Service (0x181a) not available:', serviceErr.message)

      // Fallback: Try Device Information Service (0x180a)
      // Xiaomi with ATC/pvvx firmware uses different UUIDs
      try {
        console.log('🔄 Trying Device Information Service (0x180a) fallback...')
        logger.debug('bluetoothManager', '🔄 Trying fallback services...')

        // Try Device Information Service (0x180a) - some devices expose temp/humid here
        try {
          const devInfoService = await server.getPrimaryService('0000180a-0000-1000-8000-00805f9b34fb')
          logger.debug('bluetoothManager', '✅ Device Information Service found, trying custom characteristics...')

          // Try common custom UUIDs used by ATC firmware
          const customUUIDs = [
            '00002a6e-0000-1000-8000-00805f9b34fb', // Temperature (some versions)
            '00002a6f-0000-1000-8000-00805f9b34fb'  // Humidity
          ]

          for (const uuid of customUUIDs) {
            try {
              const char = await devInfoService.getCharacteristic(uuid)
              const value = await char.readValue()
              if (uuid.endsWith('2a6e')) {
                temperature = parseFloat((value.getInt16(0, true) / 100).toFixed(2))
                logger.debug('bluetoothManager', `🌡️ Temperature (custom): ${temperature}°C`)
              } else if (uuid.endsWith('2a6f')) {
                humidity = value.getUint8(0)
                logger.debug('bluetoothManager', `💧 Humidity (custom): ${humidity}%`)
              }
            } catch {
              // Continue trying other UUIDs
            }
          }
        } catch (err) {
          logger.warn('bluetoothManager', 'Device Information Service fallback also failed:', err.message)
        }
      } catch (err) {
        logger.warn('bluetoothManager', 'All service attempts failed:', err.message)
      }
    }

    // Disconnect
    device.gatt.disconnect()
    logger.debug('bluetoothManager', '🔌 Disconnected')

    if (temperature === null || humidity === null) {
      console.warn(`❌ Failed to read data - Temperature: ${temperature}, Humidity: ${humidity}`)
      return {
        success: false,
        error: '⚠️ Could not read sensor data. Try again or move closer.',
        temperature: null,
        humidity: null
      }
    }

    return {
      success: true,
      temperature,
      humidity,
      error: null
    }
  } catch (err) {
    const errorMsg = err.name === 'NotFoundError'
      ? '❌ No Xiaomi sensor found. Make sure device is nearby and powered on.'
      : err.name === 'NotAllowedError'
      ? '❌ Bluetooth permission denied. Enable in Chrome settings.'
      : `❌ Error: ${err.message}`

    logger.error('bluetoothManager', 'Device discovery failed:', err)

    return {
      success: false,
      error: errorMsg,
      temperature: null,
      humidity: null
    }
  }
}

/**
 * Parse temperature and humidity from Xiaomi BLE advertisement data (fallback method)
 * Used if GATT characteristic read fails
 *
 * @param {DataView} advertisementData - Raw BLE advertisement data
 * @returns {{temperature: number, humidity: number} | null}
 */
export function parseXiaomiAdvertisement(advertisementData) {
  try {
    // Xiaomi format: look for manufacturer-specific data (AD type 0xFF)
    // Payload typically contains: [temp_hi, temp_lo, humidity, battery]
    // This is device-specific and may vary by firmware

    if (!advertisementData || advertisementData.byteLength < 5) {
      return null
    }

    // Simple heuristic: temperature usually at offset 0-1, humidity at offset 2
    // This varies by LYWSD model and firmware — adjust if needed
    const tempRaw = advertisementData.getInt16(0, true)
    const humidity = advertisementData.getUint8(2)

    const temperature = parseFloat((tempRaw / 100).toFixed(2))

    if (temperature >= -50 && temperature <= 60 && humidity >= 0 && humidity <= 100) {
      return { temperature, humidity }
    }

    return null
  } catch (err) {
    logger.warn('bluetoothManager', 'Advertisement parsing failed:', err.message)
    return null
  }
}
