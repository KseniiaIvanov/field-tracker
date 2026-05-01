# План улучшений для Planning Next Measurement Points

## ✅ Уже сделано
- [x] Фильтр приоритета (работает правильно)
- [x] Распределение по уровням (critical/high/medium/low)
- [x] Экспорт в CSV
- [x] Увеличены пороги vegetation (40% → 50%)

## 🎯 Улучшения в приоритете

### TIER 1: Визуализация приоритетов на карте (HIGH VALUE)
**Файл:** `src/components/MeasurementPlanner.jsx` + `src/components/RasterViewer.jsx`

**Что добавить:**
1. **Тепловая карта приоритетов** под RGB слой
   - Зелёный (Low priority) → Жёлтый (Medium) → Оранжевый (High) → Красный (Critical)
   - Прозрачность регулируется слайдером

2. **Цветные маркеры candidate points** на основе zoneLevel
   - 🟢 Low points
   - 🟡 Medium points  
   - 🟠 High points
   - 🔴 Critical points (уже есть, но улучшить)

**Сложность:** Medium (нужна новая layer в RasterViewer)
**Время:** ~2 часа

---

### TIER 2: Интерпретация результатов (HIGH VALUE)
**Файл:** `src/components/MeasurementPlanner.jsx`

**Что добавить:**
1. **Insight cards** для каждого critical point:
   ```
   🔴 Critical Point #3
   Coordinates: [68.4234, 19.1256]
   
   Why Critical?
   ├─ Vegetation: 62% missing (CRITICAL - exceeds 50% threshold)
   ├─ Moisture: 28% missing (OK - below 35% threshold)  
   └─ Combined priority score: 12.5 (top 15%)
   
   Action: Prioritize this point in field campaign
   ```

2. **Summary card** для всех results:
   ```
   📊 Analysis Summary
   Total undersampled points: 847 pixels
   ├─ Critical zones (25%): 212 pixels - NEED IMMEDIATE ATTENTION
   ├─ High zones (25%): 210 pixels - Important to sample
   ├─ Medium zones (50%): 425 pixels - Secondary priority
   
   Recommendation: Start with Critical zone (top 20 points)
   ```

3. **Per-category breakdown:**
   ```
   📈 Parameter Analysis
   
   Vegetation (52.4% missing)
   └─ CRITICAL: Very undersampled across entire polygon
   └─ Focus: peaks and valleys in spatial distribution
   
   Moisture (35.2% missing)  
   └─ MODERATE: Some gaps in certain ranges
   └─ Focus: wet/dry transition zones
   
   Disturbance (8% missing)
   └─ GOOD: Well represented
   ```

**Сложность:** Easy (mostly text rendering)
**Время:** ~1 час

---

### TIER 3: Сохранение истории анализов (MEDIUM VALUE)
**Файл:** `src/utils/analysisHistory.js` (NEW) + `src/components/MeasurementPlanner.jsx`

**Что добавить:**
1. **IndexedDB storage** для анализов (уже используется в проекте)
   - Timestamp
   - Polygon GeoJSON
   - Histogram data
   - Generated candidate points
   - Thresholds used
   - Analysis results

2. **History sidebar:**
   - Список всех анализов (с датой и временем)
   - Hover → preview параметров
   - Click → загрузить старый анализ
   - Delete → удалить из истории

3. **Comparison view:**
   - Выбрать 2 анализа
   - Показать разницу в points
   - Показать как изменился score с разными пороками

**Сложность:** Medium (нужна работа с IndexedDB)
**Время:** ~2 часа

---

### TIER 4 (ОПЦИОНАЛЬНО): Интерактивная настройка пороков (NICE-TO-HAVE)
**Файл:** `src/components/ParameterThresholdTuner.jsx` (NEW)

**Что добавить:**
1. **Slider UI** для каждого параметра:
   ```
   🌾 Vegetation
   ├─ Critical threshold: [30---50---70] %
   ├─ High threshold: [15---30---50] %
   └─ Preview: Updates points live
   ```

2. **Live preview:**
   - Когда меняешь слайдер → точки перерассчитываются live
   - Таблица обновляется (new distribution)
   - Карта обновляется (new points positions)

3. **Preset buttons:**
   - "Conservative" (high thresholds, few critical)
   - "Moderate" (default)
   - "Aggressive" (low thresholds, many critical)

**Сложность:** Hard (live calculation, UI state management)
**Время:** ~3 часа

---

## 📋 Рекомендуемый порядок

1. **День 1:** Heat map visualization (TIER 1)
2. **День 1:** Interpretation cards (TIER 2)  
3. **День 2:** Analysis history (TIER 3)
4. **День 3 (опционально):** Interactive tuning (TIER 4)

---

## 🚀 Quick wins прямо сейчас

✅ Уже сделано:
- Увеличены пороги vegetation (менее critical)
- Фильтр работает

Проверьте:
1. Откройте приложение
2. Загрузите данные
3. Нажмите "Analyze" → "Generate Points"
4. Переключайте "Priority Level" filter - должны видеть разные количества points!

---

## 📝 Технические заметки

### Heat map approach
Вместо новой layer, можно:
1. Создать новый RasterViewer режим "priority mode"
2. Рендерить priorityGrid как цветную карту
3. Наложить на RGB с opacity slider

### Interpretation approach  
Создать component `PointInsights.jsx`:
- Получает candidate points
- Получает unsampledAnalysis
- Рендерит карточки для каждого уровня

### History approach
Использовать существующий `analysisCache` в HeterogeneityAnalysis и расширить его
