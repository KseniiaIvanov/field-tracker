# 🌬️ Carbon Flux Measurement Feature

## What Was Added

A persistent checkbox toggle for marking **Carbon flux measurements** in the Field Diary form.

### Features

✅ **Checkbox appears at the top of the diary form**
- Located between the action buttons and the form sections
- Clean, styled design with gradient background
- Easy to see and toggle

✅ **Persistent state across entries**
- When checked, the flag applies to the current entry
- The checked state persists for the NEXT entry
- Remains checked until the user manually unchecks it
- Resets when using "Copy from Previous" (preserves from last entry)

✅ **Auto-applies to subsequent points**
- No need to re-check for each point
- Toggle once, applies to all following entries until unchecked

✅ **Saved with each entry**
- The `carbonFluxMeasurement` field is stored in the database
- Can be exported and analyzed in CSV

---

## How to Use

### Step 1: Open Field Diary
1. Click "🌬️ Field Diary" from the home menu
2. You'll see the checkbox at the top: "🌬️ Carbon flux measurement"

### Step 2: Check the box (if applicable)
```
If you're doing carbon flux measurements:
☑️ Carbon flux measurement
```

### Step 3: Fill in the rest of the form
- Enter point info, weather, vegetation, etc.
- The checkbox state persists automatically

### Step 4: Save the entry
- Click "Save Entry & Next Point"
- The checkbox stays checked for the next entry
- No need to re-check!

### Step 5: Uncheck when done
- If you finish doing carbon flux measurements
- Simply uncheck the box
- It will remain unchecked for subsequent entries

---

## Example Workflow

```
Entry 1: ☑️ Carbon flux measurement → Save
Entry 2: ☑️ Carbon flux measurement → Save (auto-checked)
Entry 3: ☑️ Carbon flux measurement → Save (auto-checked)
Entry 4: ☐ Carbon flux measurement → Uncheck before saving
Entry 5: ☐ Carbon flux measurement (stays unchecked)
Entry 6: ☐ Carbon flux measurement (stays unchecked)
```

---

## Technical Details

### Changed Files

#### `src/App.jsx`
- Added state: `carbonFluxMeasurementDefault` for persistence
- Added field: `carbonFluxMeasurement: false` to form defaultValues
- Updated `saveEntry()`: Preserves checkbox state for next entry
- Updated `copyFromPrevious()`: Copies checkbox state from previous entry
- Added UI: Carbon flux toggle component with checkbox

#### `src/App.css`
- Added `.carbon-flux-toggle`: Container styling with gradient background
- Added `.carbon-flux-label`: Label styling with flexbox layout
- Added `.carbon-flux-checkbox`: Checkbox styling
- Added `.carbon-flux-text`: Text label styling

### Data Structure

Each entry now includes:
```javascript
{
  collector: "...",
  siteNumber: 1,
  // ... other fields ...
  carbonFluxMeasurement: true,  // ← NEW FIELD
  // ... other fields ...
}
```

---

## Styling

### Light Mode
- Border: Purple (#6750a4)
- Background: Light purple gradient
- Text: Dark text with purple accent

### Dark Mode
- Border: Light purple (#d0bcff)
- Background: Dark purple gradient
- Text: Light text with accent

---

## Storage & Export

The `carbonFluxMeasurement` field is:
- ✅ Stored in browser's local storage
- ✅ Included in CSV exports
- ✅ Visible in Data Management tab
- ✅ Available for analysis

---

## Testing Checklist

- [ ] Checkbox appears at top of diary form
- [ ] Can toggle on/off
- [ ] State persists to next entry when checked
- [ ] State persists when unchecked
- [ ] "Copy from Previous" preserves the state
- [ ] Field appears in exported CSV
- [ ] Works in both light and dark modes
- [ ] No console errors

---

**Status:** ✅ READY
**Last Updated:** 2026-04-30
