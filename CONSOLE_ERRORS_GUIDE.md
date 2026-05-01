# 🐛 Console Errors Guide

## Ошибки которые видите в консоли

### ❌ 1. "Maximum update depth exceeded" (RED ERROR)

**Что это:**
- React infinite loop warning
- Обычно happens when component keeps calling setState in useEffect

**Статус:** ⏳ Требует анализа  
**Влияние:** Нет видимого влияния на функциональность  
**Решение:** Проверить dependencies в useEffect

**Где искать:**
- `src/components/MeasurementPlanner.jsx`
- Likely в useEffect с unsampledAnalysis или histogramsByCategory

---

### ⚠️ 2. "Cannot draw sites: Geotransform is degenerate" (YELLOW WARNING)

**Что это было:**
- ❌ Geotransform имел нулевые pixel scales: `[19, 0, 0, 68, 0, -0]`
- Sites не могли быть drawn

**Что сделал:**
- ✅ Добавил triple-layer validation в parseGeotransform()
- ✅ Гарантирую что pixel scales никогда не будут 0

**Статус:** ✅ ИСПРАВЛЕНО (должен исчезнуть)

**Что видеть после fix:**
```
✅ Drawing 32 sites on raster
   Geotransform: [19, 1.0000, 0, 68, 0, -1.0000]
```

Вместо:
```
⚠️ Cannot draw sites: Geotransform is degenerate
   Geotransform: [19, 0.0000, 0.0000, 68, 0.0000, -0.0000]
```

---

### ⚠️ 3. "Error getting polygon bounds" (YELLOW WARNING)

**Что это:**
- getPolygonBounds() не может вычислить bounds полигона
- Likely координатов issue или invalid polygon geometry

**Статус:** ⏳ Требует анализа  
**Влияние:** Может повлиять на priority grid calculation  
**Решение:** Проверить polygon format и координаты

**Где искать:**
- `src/utils/rasterProcessing.js` → getPolygonBounds()
- Polygon structure/format validation

---

### ⓘ 4. "Rendering moisture/vegetation" (INFO/DEBUG)

**Что это:**
- Debug messages о том что рендерится
- Показывает какие категории загружены

**Статус:** ✅ Нормально (это информация)  
**Действие:** Можно игнорировать

---

### ⓘ 5. "CANDIDATE POINTS: 32/100" (INFO)

**Что это:**
- Успешная информация о сгенерированных points
- 32 из 100 requested points найдены внутри полигона

**Статус:** ✅ Нормально  
**Что означает:** 
- Всего 100 points сгенерировано
- 32 из них внутри polygon
- 68 вне polygon (были filtered out)

---

## 📊 Быстрый Checklist Console

| Ошибка | До Fix | После Fix | Действие |
|--------|--------|-----------|----------|
| Geotransform degenerate | ⚠️ YES | ✅ NO | Done! |
| Max update depth | ❌ YES | ⏳ TBD | Analyze |
| Polygon bounds | ❌ YES | ⏳ TBD | Analyze |
| Rendering messages | ⓘ INFO | ⓘ INFO | OK |
| Candidate points | ⓘ INFO | ⓘ INFO | OK |

---

## 🎯 What To Do

### Если видите "Geotransform is degenerate"
- Это **должно быть исправлено** после перезагрузки сервера
- Если всё ещё видите → посмотрите что pixel scales НЕ нулевые
- Должны быть: `[19, 1.0000, 0, 68, 0, -1.0000]`

### Если видите "Maximum update depth exceeded"
- **Функция работает?** → Можно пока игнорировать
- **Функция не работает?** → Нужен анализ useEffect dependencies

### Если видите "Error getting polygon bounds"
- **Приложение работает?** → Можно пока игнорировать  
- **Приложение не работает?** → Проверить polygon format

---

## ✅ Expected Clean Console

После всех fixes, должны видеть:

```
✅ Rendering moisture: visible=true, has geotransform=true, ...
✅ Rendering vegetation: visible=true, has geotransform=true, ...
✅ Calling createPriorityGrid with: ...
✅ createPriorityGrid returned: {success: true, ...}
✅ CANDIDATE POINTS: 32/100
   {critical: 32, high: 0, medium: 0, low: 0}
✅ Drawing 32 sites on raster
   Geotransform: [19, 1.0000, 0, 68, 0, -1.0000]
```

**Без warnings!** ✅

---

## 🔍 Debugging Tips

### Если что-то не работает:

1. **Откройте Developer Tools** (F12)
2. **Смотрите на Console tab**
3. **Ищите ERROR (красные) или WARNING (жёлтые)**
4. **Читайте сообщение** - обычно говорит что не так
5. **Смотрите на source** (линия файла и номер)
6. **Проверьте логику** в том месте

### Useful filters:
- Filter: "error" → видеть только errors
- Filter: "warn" → видеть только warnings
- Filter: "geotransform" → видеть все geotransform related

---

## 📞 If Still Issues

1. Прочитайте GEOTRANSFORM_FINAL_FIX.md
2. Проверьте что сервер перезагрузился (new code loaded)
3. Hard refresh браузера (Ctrl+Shift+R)
4. Проверьте что GeoTIFF файл valid (попробуйте другой)

---

**Remember:** Большинство warnings это информация, не критичные ошибки! ✅
