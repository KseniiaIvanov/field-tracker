import { useState } from 'react'

export default function Help({ setCurrentPage }) {
  const [expandedSection, setExpandedSection] = useState(null)

  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      content: `1. Open "Field Diary" from the main menu
2. Fill in Site Information (number, date, time, UTC offset, landscape type)
3. Enter weather conditions
4. Select environment type (Terrestrial or Aquatic)
5. Record vegetation data (short and long descriptions)
6. Document soil profile and morphology
7. Click "Save Entry & Next Point" to save and start a new site`
    },
    {
      id: 'weather-sync',
      title: 'Weather Sync',
      content: `The "Sync Weather from Phone" button uses your device's location and weather capabilities.
- Requires location permission
- Will automatically detect your timezone
- Feature coming soon for full weather API integration`
    },
    {
      id: 'vegetation',
      title: 'Vegetation Recording',
      content: `Short Vegetation: Quick categories with coverage levels (0/1/2)
- 0 = Absent
- 1 = Present (<50%)
- 2 = Dominates (>50%)

Long Vegetation: Detailed species list with percentage coverage

You can add custom categories in both sections.`
    },
    {
      id: 'soil',
      title: 'Soil Profile',
      content: `Record thaw depth (active layer depth) in cm
Add soil layers with:
- Depth from/to (cm)
- Color
- Structure (granular, platy, etc.)
- Moisture level
- Texture description

Add multiple layers to document the full profile.`
    },
    {
      id: 'data-management',
      title: 'Data Management',
      content: `Export your data in two formats:
- CSV: Open in Excel, R, Python
- JSON: For detailed analysis

View entries as list or table
All data is stored locally on your device
Use "Clear All Data" carefully - it cannot be undone!`
    },
    {
      id: 'categories',
      title: 'Manage Categories',
      content: `Add or remove vegetation categories for Short Vegetation section
Changes will appear in all future entries
Standard categories cannot be deleted`
    },
    {
      id: 'species',
      title: 'Upload Species List',
      content: `Import a CSV file with your species list
Format: Species Name, Category

Download the template to see the correct format
Manually add species one at a time if needed`
    },
    {
      id: 'tips',
      title: 'Tips & Best Practices',
      content: `✓ Use UTC offset for consistent timestamps across locations
✓ Add notes to vegetation categories for special observations
✓ Take photos of each section (feature coming soon)
✓ Export regularly to backup your data
✓ Use consistent landscape type names
✓ Record morphology for topographic context`
    }
  ]

  return (
    <div className="page-content">
      <button className="btn-back" onClick={() => setCurrentPage('home')}>← Back to Menu</button>

      <h2>Help & Instructions</h2>

      <div className="help-sections">
        {sections.map((section) => (
          <div key={section.id} className="help-section">
            <button
              className="help-section-header"
              onClick={() => setExpandedSection(
                expandedSection === section.id ? null : section.id
              )}
            >
              <h3>{section.title}</h3>
              <span>{expandedSection === section.id ? '▼' : '▶'}</span>
            </button>

            {expandedSection === section.id && (
              <div className="help-section-content">
                {section.content.split('\n').map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="help-footer">
        <p>Need more help? Make sure all sections are properly filled in the Field Diary.</p>
      </div>
    </div>
  )
}
