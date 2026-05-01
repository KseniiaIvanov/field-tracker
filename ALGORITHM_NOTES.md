# Анализ и рекомендации для алгоритма приоритизации точек измерения

## 📋 Состояние после исправлений

### ✅ Исправлены (v2)
- [x] Обработка ошибок: теперь всегда возвращает `{ bins, missingPercent, peakMissingPercent }`
- [x] Peak definition: исправлен расчет top 25% по плотности
- [x] peakMissingPercent: теперь % от peak area, а не от всей площади

### 🔴 Остаются проблемы (требуют внимания)

---

## 1. Hardcoded пороги весов - НЕ обоснованы научно

### Текущие пороги
```
Critical: >40% missing OR >50% peak missing
High:     30-40% missing OR 40-50% peak missing
Medium:   15-30% missing OR 25-40% peak missing
Low:      0-15% missing
```

### Проблема
Эти значения выбраны произвольно. Для Абиско-тундры нужна **calibration study**:
- Разные параметры имеют разные natural distributions
- Влажность (часто бимодальна) ≠ высота (часто uniform) ≠ температура (часто нормальна)
- Пропуск 40% в хвостах нормален, пропуск 10% в пике - критичен

### Что нужно сделать
1. Собрать статистику для каждого параметра (shape of distribution)
2. Установить пороги адаптивно, напр.:
```javascript
// Адаптивный порог based на distribution shape
function getAdaptiveThresholds(histogram, parameterName) {
  const skewness = calculateSkewness(histogram)
  const kurtosis = calculateKurtosis(histogram)
  
  // Uniform-like: 40% → 60% threshold
  // Normal-like: 40% → 20% threshold
  // Bimodal: need special handling
}
```

---

## 2. Percentile-based thresholding смешивает абсолютную и относительную важность

### Проблема
```javascript
const thresholdHigh = sortedPriorities[high75Idx]  // Top 25% of THIS dataset
```

Если у вас в одной экспедиции все area хорошо измерены → все points будут "Low"
Если в другой экспедиции всё плохо → то же самое распределение = "Critical"

### Решение
Нужно двухуровневое решение:
1. **Absolute thresholds**: "Critical" если ANY параметр missing >40%
2. **Relative ranking**: "Within this dataset, which are most critical?"

```javascript
// Two-level approach
const absoluteCritical = priorities.some(p => p > 16)  // Any param missing >40%
const relativeTop25 = percentile(priorities, 0.25)
const zoneLevelFinal = absoluteCritical ? 'critical' : priority >= relativeTop25 ? 'high' : 'medium'
```

---

## 3. OR логика в весах может быть неправильной

### Сценарий 1: Parameter with uniform distribution
```
Height: 0-100m measured uniformly across area
Missing: 45% from range 80-100m (= 20% missing from peak)
Algorithm: "45% missing → CRITICAL" ✓ ПРАВИЛЬНО
But scientifically: missing tail of uniform dist = normal
```

### Сценарий 2: Parameter with normal distribution
```
Temperature: natural peak at 10±5°C
Missing: 35% from 8-12°C range (= 70% missing from peak)
Algorithm: "35% missing → HIGH" ✗ НЕПРАВИЛЬНО!
Should be: "70% peak missing → CRITICAL"
```

### Решение
Нужна нормализация по distribution shape:
```javascript
// Normalize missing % by distribution shape
function normalizeByDistribution(missingPercent, peakMissingPercent, histogram) {
  const isDensity = histogram.kurtosis > 5  // Very peaked
  const isUniform = histogram.kurtosis < 2  // Flat
  
  if (isDensity) {
    // For peaked distributions, weight peak_missing more heavily
    return 0.3 * missingPercent + 0.7 * peakMissingPercent
  } else if (isUniform) {
    // For uniform, just use total missing
    return missingPercent
  } else {
    // Normal: balanced weight
    return 0.5 * missingPercent + 0.5 * peakMissingPercent
  }
}
```

---

## 4. Jitter факторы (0.3-0.5) - не валидированы

### Текущие значения
```javascript
critical: 0.3 × targetResolution  // 30% spread
high:     0.35 × targetResolution
medium+:  0.5 × targetResolution  // 50% spread
```

### Вопросы
- Если targetResolution = 100м, это означает jitter до 50м
- Для мелкомасштабных явлений (микротопография тундры) - слишком много?
- Есть ли риск overlap соседних точек?

### Валидация нужна
```javascript
// Check for excessive jitter
const minDistanceBetweenPoints = targetResolution * 0.3
const jitterRange = targetResolution * jitterFactor
if (jitterRange > minDistanceBetweenPoints) {
  console.warn('⚠️ Jitter may cause point overlap')
}
```

---

## 5. topN = 20 - не адаптивно

### Проблема
Вы пригласили 604 записей, suggestive 20 new points
- Это 3.3% of existing sample
- Для detection of difference: нужна мощность анализа

### Нужно
```javascript
// Suggest sample size based on effect detection power
function suggestSampleSize(existingSampleSize, parameterVariance, effectSizeWanted) {
  // Using power analysis (e.g., Cohen's d)
  // For ecological data, effect_size ~0.5-1.0 SD
  const sampleSize = calculateRequiredN(variance, effectSizeWanted, power=0.8)
  return sampleSize - existingSampleSize  // Additional points needed
}
```

---

## 📊 Что работает ХОРОШО

### ✅ Weighted scoring (вместо counting)
Правильно: одна Critical дыра (weight 4) > трёх Low (weight 1 each)

### ✅ Hierarchical clustering
Правильно: 4 point в Critical zone вместо 1 = лучший spatial coverage

### ✅ Binary masks для undersampling
Правильно: реальное пространственное распределение, не абстрактные значения

### ✅ Adaptive percentile thresholding (идея)
Идея хорошая, реализация нуждается в refinement (см. п.2 выше)

---

## 🔬 Научные рекомендации для NEXT версии

### Priority 1: Distribution-aware classification
```
Текущее: "missing% vs peakMissing% threshold"
Нужно: "adapt thresholds to histogram shape (normal vs uniform vs bimodal)"
```

### Priority 2: Spatial autocorrelation
```
Текущее: независимые пиксели
Нужно: соседние пиксели коррелируют!
→ Не нужно 4 точки в tiny Critical pixel
→ Нужно smart clustering with spatial continuity
```

### Priority 3: Multi-scale analysis
```
Текущее: single resolution (targetResolution)
Нужно: important gaps могут быть в разных масштабах
→ Анализ на 2-3 масштабах
→ Merge recommendations с разных уровней
```

### Priority 4: Uncertainty quantification
```
Добавить: confidence intervals для missing%
Пример: "Missing 40 ± 12%" лучше, чем "Missing 40%"
```

---

## 💾 Файлы для reference

- Algorithm: `/src/utils/priorityGridAlgorithm.js`
- UI integration: `/src/components/MeasurementPlanner.jsx`
- Visualization: `/src/components/RasterViewer.jsx`

---

## 📝 История изменений

### v2 (текущая - 2026-04-30)
- ✅ Fixed: error handling consistency
- ✅ Fixed: peak definition (top 25% density)
- ✅ Fixed: peakMissingPercent (% of peak, not total)
- 🔴 TODO: distribution-aware thresholds
- 🔴 TODO: spatial autocorrelation
- 🔴 TODO: multi-scale analysis

### v1 (baseline)
- Sophisticated priority weighting
- Weighted binary mask scoring
- Hierarchical clustering
- Adaptive percentile thresholding
