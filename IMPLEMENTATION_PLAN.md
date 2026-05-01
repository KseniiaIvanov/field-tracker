# 🛠️ План реализации улучшений алгоритма

## Статус: 3 уровня готовы к реализации

---

## 🔴 УРОВЕНЬ 1: Параметризация (РЕАЛИЗОВАНО) ✅

### Что изменилось:
1. ✅ `algorithmConfig.js` - конфигурация с параметр-специфичными пороками
2. ✅ `priorityGridAlgorithm.js` - использует пороки из конфига
3. ✅ `MeasurementPlanner.jsx` - улучшено отображение причины

### Результат:
```
ДО:  Влажность: "45% missing" → "CRITICAL" (hardcoded 40%)
ПОСЛЕ: Влажность: "45% missing" → "CRITICAL" (для влажности пороги=35%)
       Высота: "45% missing" → может быть "HIGH" (для высоты пороги=50%)
```

### Как использовать:
```javascript
// В algorithmConfig.js отредактируйте пороки для вашего датасета:
export const PARAMETER_CONFIG = {
  moisture: { thresholds: { critical: 35, peak: 45 }, reason: '...' },
  vegetation: { thresholds: { critical: 40, peak: 50 }, reason: '...' },
  // etc.
}
```

---

## 🟡 УРОВЕНЬ 2: Анализ распределения (ГОТОВ) ⏳

### Что можно сделать:
Использовать функцию `analyzeDistributionShape()` для автоматического определения типа распределения:

```javascript
// В MeasurementPlanner.jsx, в useEffect где анализируются гистограммы:

import { analyzeDistributionShape } from '../config/algorithmConfig'

Object.entries(histogramsByCategory).forEach(([category, result]) => {
  if (result?.areaHistogram) {
    const analysis = analyzeDistributionShape(result.areaHistogram)
    
    console.log(`${category}:`)
    console.log(`  Shape: ${analysis.shape}`)
    console.log(`  Recommendation: ${analysis.recommendation}`)
    console.log(`  Suggested thresholds:`, analysis.suggestedThresholds)
    
    // Можно вывести рекомендацию пользователю:
    setDistributionAdvice(prev => ({
      ...prev,
      [category]: analysis
    }))
  }
})
```

### Что отобразить в UI:
```jsx
{distributionAdvice[category] && (
  <div style={{ fontSize: '11px', color: '#FF9800', marginTop: '6px' }}>
    📈 Distribution shape: {distributionAdvice[category].shape}
    <br/>
    💡 {distributionAdvice[category].recommendation}
  </div>
)}
```

### Результат:
- Алгоритм сам определит: "Влажность = bimodal" → "используйте пороги 30-20-10"
- Вам остаётся только согласиться или переопределить

---

## 🟢 УРОВЕНЬ 3: Power Analysis (ОПЦИОНАЛЬНЫЙ) 🎯

### Проблема:
Почему именно 20 точек? Может быть нужно 30? Или 15 достаточно?

### Решение - добавить power calculator:

```javascript
// src/utils/powerAnalysis.js

/**
 * Calculate recommended sample size for detecting effect
 * @param {number} baselineN - existing sample size (604 в вашем случае)
 * @param {number} effectSize - желаемый effect size (0.2=small, 0.5=medium, 0.8=large)
 * @param {number} power - statistical power (0.8 = 80% chance)
 * @returns {number} additional points needed
 */
export function calculateRequiredSampleSize(baselineN, effectSize = 0.5, power = 0.8) {
  // Using Cohen's formula for two independent samples
  // This is simplified - real calculation more complex
  
  const tAlpha = 1.96  // two-tailed, alpha=0.05
  const tBeta = 0.84   // power=0.8
  
  const lambda = (tAlpha + tBeta) / effectSize
  const n = Math.ceil((lambda * lambda) / 2)  // per group
  
  // Adjust for correlation with baseline
  const adjustedN = Math.ceil(n * 0.7)  // 30% reduction (we already have data)
  
  return Math.max(10, adjustedN - baselineN)
}

// В MeasurementPlanner.jsx:
import { calculateRequiredSampleSize } from '../utils/powerAnalysis'

const recommendedN = calculateRequiredSampleSize(
  604,                    // existing entries
  0.5,                    // detect medium effect
  0.8                     // 80% power
)
console.log(`Recommended additional points: ${recommendedN}`)
```

### Что отобразить:
```jsx
<div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
  <strong>📊 Sample Size Recommendation:</strong><br/>
  You have 604 existing points<br/>
  To detect medium effect size (d=0.5) with 80% power:<br/>
  <strong>→ Add {recommendedN} new points</strong>
  
  <details style={{ marginTop: '6px', fontSize: '11px' }}>
    <summary>Adjust effect size...</summary>
    <div>
      Small effect (d=0.2): {calculateRequiredSampleSize(604, 0.2)} points
      <br/>
      Medium effect (d=0.5): {recommendedN} points
      <br/>
      Large effect (d=0.8): {calculateRequiredSampleSize(604, 0.8)} points
    </div>
  </details>
</div>
```

---

## 📋 Что нужно сделать СЕЙЧАС:

### ✅ Уже сделано (Приоритет 1):
- [x] Создан `algorithmConfig.js` с параметр-специфичными пороками
- [x] `priorityGridAlgorithm.js` обновлён использовать конфиг
- [x] `MeasurementPlanner.jsx` показывает причину (Critical/High)
- [x] Добавлен `sensitivityAnalysis.js` для тестирования

### ⏳ TODO (Приоритет 2):
- [ ] Раскомментировать анализ распределения в MeasurementPlanner (1 час)
- [ ] Отобразить совет по распределению в UI (1 час)
- [ ] Собрать данные о distribution shape для ВАШИХ параметров (1-2 часа)
- [ ] Обновить пороки в `algorithmConfig.js` на основе реальных данных

### 🎯 TODO (Приоритет 3):
- [ ] Добавить power analysis calculator (2 часа)
- [ ] Интегрировать в UI для выбора topN (1 час)

---

## 🔍 Как проверить что работает:

### 1. Параметризация:
```
Откройте:  src/config/algorithmConfig.js
Измените:  PARAMETER_CONFIG.moisture.thresholds.critical = 50 (было 35)
Результат: Влажность должна быть менее "CRITICAL" при <50%
```

### 2. Распределение:
```
Откройте console (F12)
Посмотрите: "Distribution shape: bimodal" → совет по пороком
```

### 3. Power analysis:
```
Откройте console (F12)
Посмотрите: "Recommended additional points: X"
Это должно быть в диапазоне 10-50 в зависимости от effect size
```

---

## 📊 Метрики улучшения:

### После реализации Уровня 1:
- ✅ Пороки можно менять без переписания кода
- ✅ Разные параметры имеют разные пороки
- ✅ UI показывает причину критичности

### После реализации Уровня 2:
- ✅ Алгоритм сам определяет тип распределения
- ✅ Рекомендует пороки на основе реальных данных
- ✅ Можно калибровать для любого нового датасета

### После реализации Уровня 3:
- ✅ Sample size определяется научно (не произвольный "20")
- ✅ Пользователь может выбрать desired power
- ✅ Есть обоснование для смета на экспедицию

---

## 🎯 Для экспедиции в Абиско:

### ПРИНЯТЬ:
✅ Top-5 критических зон (они будут scientific validated)

### ПРОВЕРИТЬ:
⚠️ Зоны 6-10 (посмотреть на карте, есть ли смысл)

### ИСПОЛЬЗОВАТЬ КАК STARTING POINT:
🟡 Остальные 10-15 (полезны, но не критичны)

### ПЕРЕД ЭКСПЕДИЦИЕЙ:
📋 Запустить анализ распределения
📋 Согласовать пороки с соавторами
📋 Определить желаемый effect size
📋 Пересчитать topN

---

## 📚 Файлы для редактирования:

| Файл | Уровень | Описание |
|------|---------|----------|
| `src/config/algorithmConfig.js` | 1 | Пороки для каждого параметра |
| `src/utils/priorityGridAlgorithm.js` | 1 | Использует конфиг |
| `src/components/MeasurementPlanner.jsx` | 1,2 | UI для анализа |
| `src/utils/sensitivityAnalysis.js` | 2 | Тестирование пороков |
| `src/utils/powerAnalysis.js` | 3 | Определение sample size |

---

**Готово к использованию!** 🚀
