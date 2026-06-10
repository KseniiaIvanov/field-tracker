export default function Home({ setCurrentPage, allEntries, onSelectStorageFolder, deviceStoragePath, storageAvailable }) {
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

  return (
    <div className="home-page" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
      {storageAvailable && !deviceStoragePath && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#e3f2fd', borderRadius: '8px', border: '2px solid #1976d2' }}>
          <div style={{ marginBottom: '8px', fontWeight: '700', color: '#1565c0' }}>
            💾 Set Up Device Storage
          </div>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#0d47a1' }}>
            Save field data directly to your phone's storage. Your data will be organized by date and site number.
          </p>
          <button
            onClick={onSelectStorageFolder}
            style={{
              padding: '10px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            📁 Select Storage Folder
          </button>
        </div>
      )}

      {deviceStoragePath && (
        <div style={{ marginBottom: '24px', padding: '12px 16px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '2px solid #388e3c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1b5e20' }}>✅ {deviceStoragePath}</div>
            <div style={{ fontSize: '11px', color: '#2e7d32', marginTop: '2px' }}>Sites save directly to this folder</div>
          </div>
          <button
            onClick={onSelectStorageFolder}
            style={{ flexShrink: 0, padding: '4px 10px', fontSize: '11px', backgroundColor: 'transparent', color: '#1b5e20', border: '1px solid #388e3c', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
          >Change</button>
        </div>
      )}

      {lastEntry && (
        <div className="quick-actions" style={{ marginBottom: '24px' }}>
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

      <div className="menu-grid">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className="menu-card"
            onClick={() => setCurrentPage(item.id)}
            style={{ borderLeftColor: item.color }}
          >
            <div className="menu-icon">{item.icon}</div>
            <div style={{ flex: 1 }}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="home-info">
        <p>Click any card to get started</p>
      </div>
    </div>
  )
}
