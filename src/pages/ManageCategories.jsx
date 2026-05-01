import { useState, useEffect } from 'react'
import localforage from 'localforage'

const DEFAULT_CATEGORIES = {
  vegetation: [
    'Shrubs', 'Dwarf Shrubs', 'Grass', 'Sedges',
    'Green Mosses', 'Sphagnum Mosses', 'Brown Mosses',
    'Lichens', 'Bare Peat', 'Litter Standing Dead'
  ],
  soil: [
    'Organic Layer', 'Mineral Layer', 'Permafrost', 'Gravel', 'Clay', 'Sand'
  ],
  morphology: [
    'Slope', 'Depression', 'Elevated', 'Ridge', 'Valley', 'Plateau'
  ],
  siteDescription: [
    'Wet', 'Dry', 'Exposed', 'Sheltered', 'North-facing', 'South-facing', 'Disturbed'
  ]
}

const CATEGORY_TYPES = {
  vegetation: { label: 'Vegetation (Short)', icon: '🌿' },
  soil: { label: 'Soil Types', icon: '🪨' },
  morphology: { label: 'Morphology', icon: '⛰️' },
  siteDescription: { label: 'Site Description', icon: '📍' }
}

export default function ManageCategories({ setCurrentPage }) {
  const [categoryType, setCategoryType] = useState('vegetation')
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES.vegetation)
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    loadCategories()
  }, [categoryType])

  const loadCategories = async () => {
    try {
      const saved = await localforage.getItem(`categories_${categoryType}`)
      if (saved) {
        setCategories(saved)
      } else {
        setCategories(DEFAULT_CATEGORIES[categoryType] || [])
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
    setNewCategory('')
  }

  const saveCategories = async (updatedCategories) => {
    try {
      await localforage.setItem(`categories_${categoryType}`, updatedCategories)
      setCategories(updatedCategories)
    } catch (error) {
      console.error('Error saving categories:', error)
    }
  }

  const addCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      const updated = [...categories, newCategory.trim()]
      saveCategories(updated)
      setNewCategory('')
    }
  }

  const removeCategory = (cat) => {
    const updated = categories.filter(c => c !== cat)
    saveCategories(updated)
  }

  const resetToDefaults = () => {
    if (confirm(`Reset ${CATEGORY_TYPES[categoryType].label} to default categories?`)) {
      saveCategories(DEFAULT_CATEGORIES[categoryType])
    }
  }

  return (
    <div className="page-content">
      <button className="btn-back" onClick={() => setCurrentPage('home')}>← Back to Menu</button>

      <h2>Manage Categories</h2>

      <div className="section">
        <h3>Select Category Type</h3>
        <div className="category-type-selector">
          {Object.entries(CATEGORY_TYPES).map(([type, info]) => (
            <button
              key={type}
              className={`type-button ${categoryType === type ? 'active' : ''}`}
              onClick={() => setCategoryType(type)}
            >
              <span className="type-icon">{info.icon}</span>
              <span className="type-label">{info.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <h3>{CATEGORY_TYPES[categoryType].label}</h3>
        <div className="categories-list">
          {categories.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No categories yet</p>
          ) : (
            categories.map((cat) => (
              <div key={cat} className="category-item">
                <span>{cat}</span>
                <button
                  className="btn-delete"
                  onClick={() => removeCategory(cat)}
                >
                  ✕ Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="section">
        <h3>Add New Category</h3>
        <div className="add-form">
          <input
            type="text"
            placeholder={`Enter new ${CATEGORY_TYPES[categoryType].label.toLowerCase()}`}
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') addCategory()
            }}
          />
          <button className="btn-add" onClick={addCategory}>
            + Add Category
          </button>
        </div>
      </div>

      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="info-text">Total categories: <strong>{categories.length}</strong></p>
          <button
            className="btn-reset"
            onClick={resetToDefaults}
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  )
}
