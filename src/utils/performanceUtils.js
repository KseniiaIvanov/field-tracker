// Утилиты для оптимизации производительности

// Debounce функция - откладывает вызов до конца активности пользователя
export function debounce(func, delay) {
  let timeoutId = null

  return function debounced(...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      func.apply(this, args)
    }, delay)
  }
}

// RequestAnimationFrame debounce - оптимально для рендеринга
export function rafDebounce(func) {
  let rafId = null

  return function debounced(...args) {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      func.apply(this, args)
      rafId = null
    })
  }
}

// Мемоизация - кэширует результаты функции
export function memoize(func) {
  const cache = new Map()

  return function memoized(...args) {
    const key = JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)
    }

    const result = func.apply(this, args)
    cache.set(key, result)

    // Ограничить размер кэша до 100 элементов
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }

    return result
  }
}

// Throttle функция - вызывает максимум 1 раз за N миллисекунд
export function throttle(func, delay) {
  let lastCall = 0

  return function throttled(...args) {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      return func.apply(this, args)
    }
  }
}

// BatchUpdate - группирует множественные обновления в одно
export function createBatchUpdater(callback, delay = 100) {
  let batch = []
  let timeoutId = null

  const processBatch = () => {
    if (batch.length > 0) {
      callback(batch)
      batch = []
    }
  }

  return function(item) {
    batch.push(item)
    clearTimeout(timeoutId)
    timeoutId = setTimeout(processBatch, delay)
  }
}

// Async task queue - запускает задачи последовательно, не блокируя UI
export class AsyncQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency
    this.running = 0
    this.queue = []
  }

  async add(task) {
    while (this.running >= this.concurrency) {
      await new Promise(resolve => {
        this.queue.push(resolve)
      })
    }

    this.running++

    try {
      return await task()
    } finally {
      this.running--
      const resolve = this.queue.shift()
      if (resolve) resolve()
    }
  }

  async addBatch(tasks) {
    return Promise.all(tasks.map(task => this.add(task)))
  }
}

// Progressively load - загружает данные с прогрессом
export async function* progressiveLoad(items, batchSize = 10) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    yield batch
    await new Promise(resolve => setTimeout(resolve, 0)) // Yield to browser
  }
}
