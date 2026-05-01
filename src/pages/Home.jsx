export default function Home({ setCurrentPage, allEntries }) {
  const menuItems = [
    {
      id: 'diary',
      icon: '📓',
      title: 'Field Diary',
      description: 'Record field observations and site data',
      color: '#0066cc'
    },
    {
      id: 'import',
      icon: '📤',
      title: 'Import Sites',
      description: 'Load sites from CSV, Excel, or Shapefile',
      color: '#ff6600'
    },
    {
      id: 'repeat',
      icon: '🔄',
      title: 'Repeat Sites',
      description: 'Compare multiple visits to same location',
      color: '#00aa44'
    },
    {
      id: 'statistics',
      icon: '📊',
      title: 'Statistics',
      description: 'View distribution by landscape and other metrics',
      color: '#ff9800'
    },
    {
      id: 'categories',
      icon: '🏷️',
      title: 'Manage Categories',
      description: 'Add/remove vegetation categories',
      color: '#6600cc'
    },
    {
      id: 'species',
      icon: '🌿',
      title: 'Upload Species List',
      description: 'Load vegetation species from CSV',
      color: '#00cc66'
    },
    {
      id: 'settings',
      icon: '⚙️',
      title: 'Settings',
      description: 'Configure app preferences',
      color: '#0099cc'
    },
    {
      id: 'data',
      icon: '💾',
      title: 'Data Management',
      description: 'View, export, and manage data',
      color: '#cc6600'
    },
    {
      id: 'help',
      icon: '❓',
      title: 'Help & Instructions',
      description: 'Learn how to use the app',
      color: '#6699cc'
    }
  ]

  // Calculate statistics
  const lastEntry = allEntries.length > 0 ? allEntries[allEntries.length - 1] : null
  const todayEntries = allEntries.filter(e => e.date === new Date().toISOString().split('T')[0]).length

  // Get average temperature from today's entries
  const avgTemp = allEntries.length > 0
    ? (allEntries.reduce((sum, e) => sum + (e.weather?.temperature || 0), 0) / allEntries.length).toFixed(1)
    : 'N/A'

  return (
    <div className="home-page">
      <div className="home-top-section">
        <div className="home-header">
          <h2>Welcome to Field Campaign Tracker</h2>
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-label">Total Sites</span>
              <span className="stat-value">{allEntries.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Today</span>
              <span className="stat-value">{todayEntries}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Avg Temp</span>
              <span className="stat-value">{avgTemp}°C</span>
            </div>
          </div>
        </div>

        {lastEntry && (
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <button
              className="btn-continue-last"
              onClick={() => setCurrentPage('diary')}
            >
              <div className="btn-continue-content">
                <span className="btn-continue-icon">▶ Continue</span>
                <span className="btn-continue-text">Last site: {lastEntry.siteNumber} • {lastEntry.landscape || 'No landscape'}</span>
              </div>
            </button>
          </div>
        )}
      </div>

      <div className="menu-grid">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className="menu-card"
            onClick={() => setCurrentPage(item.id)}
            style={{ borderTopColor: item.color }}
          >
            <div className="menu-icon">{item.icon}</div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </button>
        ))}
      </div>

      <div className="home-info">
        <p>Click any card to get started</p>
      </div>
    </div>
  )
}
