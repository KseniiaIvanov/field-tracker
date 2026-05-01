// IndexedDB manager для эффективного хранения больших растров
// Значительно быстрее localStorage, особенно для больших файлов

const DB_NAME = 'fieldDiaryDB'
const DB_VERSION = 1
const STORE_NAME = 'rasters'

let db = null

// Инициализировать базу данных
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = event.target.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

// Сохранить растр
export async function saveRasterData(fileId, data) {
  if (!db) await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const request = store.put({
      id: fileId,
      data,
      timestamp: Date.now()
    })

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(fileId)
  })
}

// Загрузить растр
export async function loadRasterData(fileId) {
  if (!db) await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(fileId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result
      resolve(result ? result.data : null)
    }
  })
}

// Удалить растр
export async function deleteRasterData(fileId) {
  if (!db) await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(fileId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(fileId)
  })
}

// Очистить всю базу
export async function clearAllRasters() {
  if (!db) await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// Получить все ключи (список файлов)
export async function getAllRasterIds() {
  if (!db) await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAllKeys()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}
