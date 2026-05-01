import { useState, useMemo } from 'react'

export default function RepeatSites({ setCurrentPage, allEntries }) {
  const [selectedSite, setSelectedSite] = useState(null)

  // Group entries by GPS location (within 10m accuracy)
  const groupedByLocation = useMemo(() => {
    const groups = {}

    allEntries.forEach((entry, idx) => {
      if (entry.latitude && entry.longitude) {
        // Round to 4 decimals (~10m) to group nearby sites
        const lat = parseFloat(entry.latitude)
        const lng = parseFloat(entry.longitude)
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`

        if (!groups[key]) {
          groups[key] = {
            key,
            lat: lat,
            lng: lng,
            entries: [],
            firstDate: entry.date,
            lastDate: entry.date,
            count: 0
          }
        }

        groups[key].entries.push({ ...entry, idx })
        groups[key].count++
        groups[key].lastDate = entry.date

        // Sort by date
        groups[key].entries.sort((a, b) => new Date(a.date) - new Date(b.date))
      }
    })

    // Only return sites visited more than once
    return Object.values(groups).filter(g => g.count > 1).sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate))
  }, [allEntries])

  const selected = selectedSite !== null ? groupedByLocation[selectedSite] : null

  return (
    <div className="page-content">
      <button className="btn-back" onClick={() => setCurrentPage('home')}>← Back to Menu</button>

      <h2>Repeat Sites</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
        Sites visited multiple times (grouped by GPS location within ~10m)
      </p>

      {groupedByLocation.length === 0 ? (
        <div className="section info-section">
          <p>No repeat sites yet. Visit the same location multiple times to see comparisons.</p>
        </div>
      ) : (
        <div className="repeat-sites-layout">
          {/* List of sites */}
          <div className="sites-list">
            <h3>Sites ({groupedByLocation.length})</h3>
            {groupedByLocation.map((group, idx) => (
              <button
                key={group.key}
                className={`site-item ${selectedSite === idx ? 'active' : ''}`}
                onClick={() => setSelectedSite(idx)}
              >
                <div className="site-header">
                  <strong>Site Group {idx + 1}</strong>
                  <span className="visit-count">{group.count} visits</span>
                </div>
                <div className="site-details">
                  <div>📍 {group.lat.toFixed(4)}, {group.lng.toFixed(4)}</div>
                  <div>📅 {group.firstDate} → {group.lastDate}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Details of selected site */}
          {selected && (
            <div className="site-details-panel">
              <h3>Visit History</h3>
              <div className="site-meta">
                <div><strong>Latitude:</strong> {selected.lat.toFixed(6)}</div>
                <div><strong>Longitude:</strong> {selected.lng.toFixed(6)}</div>
                <div><strong>Total Visits:</strong> {selected.count}</div>
                <div><strong>Date Range:</strong> {selected.firstDate} to {selected.lastDate}</div>
              </div>

              <div className="visits-timeline">
                {selected.entries.map((entry, visitIdx) => (
                  <div key={entry.idx} className="visit-card">
                    <div className="visit-header">
                      <span className="visit-number">Visit #{visitIdx + 1}</span>
                      <span className="visit-date">{entry.date}</span>
                    </div>

                    <div className="visit-data">
                      <div className="data-row">
                        <span className="label">Time:</span>
                        <span className="value">{entry.localTime} (UTC {entry.utcOffset})</span>
                      </div>
                      <div className="data-row">
                        <span className="label">Landscape:</span>
                        <span className="value">{entry.landscape || 'Not recorded'}</span>
                      </div>
                      <div className="data-row">
                        <span className="label">Environment:</span>
                        <span className="value">{entry.terrestrialAquatic}</span>
                      </div>

                      {entry.weather?.temperature !== undefined && (
                        <div className="data-row">
                          <span className="label">Temperature:</span>
                          <span className="value">{entry.weather.temperature}°C</span>
                        </div>
                      )}

                      {entry.activeLayerDepth !== undefined && (
                        <div className="data-row">
                          <span className="label">Active Layer Depth:</span>
                          <span className="value">{entry.activeLayerDepth} cm</span>
                        </div>
                      )}

                      {entry.soilTemperature !== undefined && (
                        <div className="data-row">
                          <span className="label">Soil Temperature:</span>
                          <span className="value">{entry.soilTemperature}°C</span>
                        </div>
                      )}

                      <div className="data-row">
                        <span className="label">Morphology:</span>
                        <span className="value">{entry.morphology || 'Not recorded'}</span>
                      </div>
                    </div>

                    {visitIdx < selected.entries.length - 1 && <div className="visit-divider">⋮</div>}
                  </div>
                ))}
              </div>

              <div className="comparison-note">
                <strong>💡 Tip:</strong> Compare changes in temperature, active layer depth, and vegetation across visits to see temporal trends.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
