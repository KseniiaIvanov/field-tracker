# Анализ фильтра приоритета и причины "всё критическое"

## 🔍 Обнаруженная проблема

### Как работает классификация zoneLevel

В `priorityGridAlgorithm.js` (линии 490-503), классификация точек основана на **percentile thresholds**:

```javascript
const thresholdHigh = sortedPriorities[0.25] // Top 25% по приоритету
const thresholdMedium = sortedPriorities[0.50] // Top 50% по приоритету

if (priority >= thresholdHigh) zoneLevel = 'critical'      // ~25% всех points
else if (priority >= thresholdMedium) zoneLevel = 'high'   // ~25% points
else if (priority > 0) zoneLevel = 'medium'                 // ~50% points
```

### 🎯 Ключевой вывод

**Это АДАПТИВНАЯ система, а не абсолютная!**
- Всегда будет ~25% points marked as "critical" (top 25% по приоритету)
- ~25% как "high"
- ~50% как "medium" или "low"

### ❌ Почему все кажутся critical?

**Вероятная причина:** Vegetation имеет 52.4% missing (> 40% critical threshold)

Это означает что:
1. Практически ВСЕ undersampled пиксели получают HIGH приоритет от vegetation
2. Даже если есть только 4 параметра, vegetation один сильно weighted
3. Результат: очень мало пиксельных ячеек с LOW приоритетом
4. Percentile-based система тогда распределяет 25% от этих HIGH points как "critical"

## ✅ Фильтр РАБОТАЕТ ПРАВИЛЬНО!

Логика на линиях 256-279 MeasurementPlanner.jsx корректна:
- priorityThreshold = 1,2,3,4 → переключает что показывать
- zoneLevel filtering правильно реализован
- useMemo гарантирует что filteredCandidates обновляется

## 📊 Что нужно изменить?

### Вариант 1: Использовать абсолютные пороги вместо percentile (более научный)

Измените `generateCandidatePoints()` чтобы использовать пороги из `algorithmConfig.js`:

```javascript
// Вместо percentile-based:
const thresholdCritical = 50   // >= 50% missing = critical
const thresholdHigh = 30       // >= 30% missing = high
const thresholdMedium = 15     // >= 15% missing = medium

if (missingPercent >= thresholdCritical) zoneLevel = 'critical'
else if (missingPercent >= thresholdHigh) zoneLevel = 'high'
...
```

### Вариант 2: Сделать пороги Vegetation менее строгими

В `algorithmConfig.js`:
```javascript
vegetation: {
  // Было: 40% critical
  // Измени на: 50% critical (менее строго)
  thresholds: { critical: 50, peak: 60 }
}
```

### Вариант 3: Использовать КОМБИНИРОВАННЫЙ подход (рекомендуется)

1. Сначала применить абсолютные пороги (используя распределение)
2. Затем применить percentile-based scaling для fine-tuning в каждой категории

## 📈 Рекомендуемые улучшения

1. ✅ **Фильтр уже работает** - просто попробуйте переключать "Priority Level"
2. **Измени пороги vegetation с 40% → 50%** (сделает менее чувствительным)
3. **Добавь визуализацию тепловой карты** приоритетов на карту
4. **Добавь объяснения** почему точка marked как critical
5. **Добавь историю анализов** для сравнения

## 🧪 Как проверить что фильтр работает?

1. Загрузи данные
2. Нажми "Analyze" 
3. Нажми "Generate Points"
4. **В таблице должно быть много points**
5. Переключи "🔴 Critical only" → **должна остаться только ~25% points**
6. Переключи на "🟠 High and above" → должно быть ~50% points

Если числа меняются → фильтр работает! ✅
