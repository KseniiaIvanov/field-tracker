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
        '📁 Select storage folder on Home page (one-time setup)',
        '✅ Each Site auto-saves: Date → Site_### → JSON + photos + voice notes',
        '🔄 Data in both app storage AND device folder (double backup)',
        '📱 Access files via Files app on your phone'
      ]
    },
    {
      id: 'site-info',
      icon: '📍',
      title: 'Step 1: Site Info',
      tips: [
        '🔢 Site # MUST match your data logger',
        '📝 Add notes immediately (don\'t wait)',
        '🎤 Record voice notes for urgent observations',
        '📍 GPS averages 2 min for accuracy'
      ]
    },
    {
      id: 'vegetation',
      icon: '🌱',
      title: 'Vegetation (Steps 3-4)',
      tips: [
        '📊 Short: Quick coverage (0/1/2 scale)',
        '🔬 Long: Detailed species composition',
        '📸 Photos for entire vegetation section (end of form)',
        '➕ Add custom categories anytime'
      ]
    },
    {
      id: 'soil-gas',
      icon: '🔬',
      title: 'Soil (Step 5)',
      tips: [
        '❄️ Active layer = thaw depth (controls CO₂)',
        '💧 Standing water → anaerobic → CH₄',
        '🌍 Organic type: Live/Litter/Peat (decomposition rates)',
        '🔧 Disturbance: None/Thermokarst/Erosion/Trampling/etc'
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
              <td style={{ padding: '6px 8px' }}>⚡ Quick Mode</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>~30 sec entry</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '6px 8px' }}>🎤 Voice Notes</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>Step 1</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '6px 8px' }}>📸 Photos</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>Embedded in JSON</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '6px 8px' }}>🎯 GPS Averaging</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>2 min, ±5-20m</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px' }}>🔄 Quick Buttons</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>Wind, Disturbance</td>
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
