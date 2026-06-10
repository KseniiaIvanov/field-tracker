import { useState } from 'react'

export default function Help({ setCurrentPage }) {
  const [expandedSection, setExpandedSection] = useState(null)

  const sections = [
    {
      id: 'quick-start',
      icon: '⚡',
      title: 'Quick Start',
      tips: [
        '📱 Use Quick Mode (⚡) for fast repeated sites (~30 sec)',
        '🎤 Voice notes in Step 1 - no need to type',
        '📋 Copy button reuses data from previous site',
        '🎯 Quick buttons for Wind Direction & Disturbance'
      ]
    },
    {
      id: 'storage',
      icon: '💾',
      title: 'Device Storage Setup',
      tips: [
        '📁 "Select Storage Folder" on Home (one-time) — Android Chrome / desktop only',
        '🍎 iPhone/iPad: no folder picker — data stays in-app; use Export / Share to get files out',
        '✅ Each site auto-saves: Date → Site_### → JSON + photos + voice notes',
        '🏷️ Files named Site_###_date_time_type (sortable, self-documenting)',
        '🔄 Data kept in app storage AND (where supported) the chosen folder',
        '📱 Access folder files via the Files app on your phone'
      ]
    },
    {
      id: 'offline',
      icon: '📶',
      title: 'Offline & Install',
      tips: [
        '✈️ Works fully offline after the first online load — capture, storage & analysis run with no signal',
        '📲 Install to home screen: Android (Chrome) shows a prompt; on iPhone/iPad use Share → "Add to Home Screen"',
        '🔌 Network only needed for first install, app updates, and the online map background',
        '⏳ iOS may clear app storage if unused for a while — open it online & export before fieldwork',
        '💾 Export and back up regularly to be safe'
      ]
    },
    {
      id: 'site-info',
      icon: '📍',
      title: 'Step 1: Site Info',
      tips: [
        '🔢 Site # MUST match your data logger',
        '📍 GPS averages 60 sec — stand still for accuracy',
        '📝 Landscape, disturbance, organic matter type',
        '🎤 Voice notes + 📷 photo in one row at bottom',
        '📋 Copy button reuses collector, landscape from previous site'
      ]
    },
    {
      id: 'weather',
      icon: '🌤️',
      title: 'Step 2: Weather',
      tips: [
        '☁️ Cloud cover, precipitation, wind speed & direction',
        '🌡️ Air temperature',
        '⏱️ Record at time of measurement, not start of day'
      ]
    },
    {
      id: 'vegetation',
      icon: '🌱',
      title: 'Step 3: Vegetation',
      tips: [
        '📊 One row per category: coverage (0/1/2) + height cm',
        '➕ Add custom categories with the + button',
        '📸 Add vegetation photos at the bottom of the step',
        '🌍 Environment (Terrestrial/Aquatic) at the very end of step'
      ]
    },
    {
      id: 'soil-gas',
      icon: '🔬',
      title: 'Step 4: Soil & Morphology',
      tips: [
        '❄️ AL depth: 3 probe readings → auto-average calculated',
        '🌡️ Soil temp °C + soil moisture % in one row',
        '💧 Moisture type (Dry/Moist/Wet/Saturated) + Standing Water in one row',
        '🪨 Add soil layers with depth from/to + soil type',
        '🗺️ Morphology: topographic position description'
      ]
    },
    {
      id: 'data-logger',
      icon: '⚙️',
      title: 'Data Logger Integration',
      tips: [
        '🔗 Site numbers MUST match device ↔ logger',
        '📡 Logger records: fluxes, precise coordinates, soil params',
        '📊 App records: vegetation, landscape context, photos',
        '🔀 Merge data by site number for analysis'
      ]
    },
    {
      id: 'remote-sensing',
      icon: '🛰️',
      title: 'Upscaling & Raster Data',
      tips: [
        '📏 5-10m resolution matches GPS accuracy (±5-20m)',
        '🎯 Document patch size: "homogeneous ~50m × 30m"',
        '📍 Validate NDVI/EVI with field observations',
        '🔍 Is this patch typical or distinct from surroundings?'
      ]
    },
    {
      id: 'export',
      icon: '💾',
      title: 'Export & Backup',
      tips: [
        '📦 Organized ZIP: Field_Diary_YYYY-MM-DD/ → Date/ → Site_###/ with all files',
        '📸 Photos saved in ORIGINAL quality with EXIF metadata (camera, GPS, date/time)',
        '📊 CSV: for Excel, R, Python analysis',
        '📋 JSON: complete data structure with embedded media',
        '🔄 Export regularly to protect field data'
      ]
    },
    {
      id: 'tips',
      icon: '✓',
      title: 'Best Practices',
      tips: [
        '⏱️ Standardize: same methods & timing each visit',
        '📸 Photos: include scale, multiple angles',
        '🕒 Use UTC offset for consistent timestamps',
        '🗣️ Voice notes for complex observations'
      ]
    }
  ]

  return (
    <div className="page-content">
      <button className="btn-back" onClick={() => setCurrentPage('home')}>← Back to Menu</button>

      <h2>Help & Instructions</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Tap any section to expand. All data is stored locally on your device.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
        {sections.map((section) => (
          <div
            key={section.id}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              overflow: 'hidden',
              border: expandedSection === section.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)'
            }}
          >
            <button
              onClick={() => setExpandedSection(
                expandedSection === section.id ? null : section.id
              )}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'left'
              }}
            >
              <span style={{ fontSize: '24px' }}>{section.icon}</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {section.title}
                </h3>
              </div>
              <span style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
                {expandedSection === section.id ? '▼' : '▶'}
              </span>
            </button>

            {expandedSection === section.id && (
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)'
              }}>
                {section.tips.map((tip, idx) => (
                  <div key={idx} style={{
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    marginBottom: idx < section.tips.length - 1 ? '8px' : '0',
                    lineHeight: '1.4'
                  }}>
                    {tip}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700' }}>📋 Feature Summary</h3>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '6px 8px' }}>📋 Steps</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>5 steps total</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '6px 8px' }}>⚡ Quick Mode</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>~30 sec entry</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '6px 8px' }}>🎤 Voice Notes</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>Step 1</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '6px 8px' }}>❄️ AL Depth</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>3 readings, Step 4</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '6px 8px' }}>📸 Photos</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>Step 1 + Step 5</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '6px 8px' }}>🎯 GPS Averaging</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>60 sec, ±5-20m</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px' }}>💾 Save Entry</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>Step 5 + JSON backup</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fff8e1', borderRadius: '6px', fontSize: '12px', color: '#856404' }}>
        <strong>⚠️ Important:</strong> Site numbers MUST match between this app and your data logger!
      </div>
    </div>
  )
}
