// Human-readable label and filesystem-safe slug for an entry, based on Area/Collar.
// Falls back to the legacy "Site N" for older records that predate those fields.

export function entryLabel(entry) {
  if (!entry) return 'Entry'
  const parts = [entry.area, entry.collar].filter((v) => v != null && String(v).trim() !== '')
  return parts.length ? parts.join(' / ') : `Site ${entry.siteNumber ?? '?'}`
}

const safe = (s) => String(s).trim().replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')

// Unique, sortable, filesystem-safe name. Leads with Area/Collar and always
// keeps the zero-padded site number as a suffix so names stay unique even if
// two points share an area/collar.
export function entrySlug(entry) {
  if (!entry) return 'Entry'
  const num = String(entry.siteNumber ?? 0).padStart(3, '0')
  const parts = [entry.area, entry.collar]
    .filter((v) => v != null && String(v).trim() !== '')
    .map(safe)
    .filter(Boolean)
  return parts.length ? `${parts.join('_')}_${num}` : `Site_${num}`
}
