// Move heavy media (photo/voice base64) between an entry and the separate media
// store, so the stored entry (and the in-memory list) stays light.
//
// - dehydrateEntry: pull base64 out into the media store, return a slim entry
//   that keeps only { id, name, type, metadata } / { id, duration, timestamp }.
// - hydrateEntry: fetch base64 back into the fields the UI/export expect.
// - deleteEntryMedia: remove an entry's media keys.
//
// Loss-safe: if a media write fails, the base64 is left inline on the entry so
// nothing is ever dropped — it just isn't optimized for that one item.
import { putMedia, getMedia, deleteMedia } from './mediaStore'

const PHOTO_FIELDS = ['entryPhotos', 'vegetationShortPhotos', 'vegetationLongPhotos']

function photoIsHeavy(p) {
  return p && (p.originalData || p.previewData)
}
function voiceIsHeavy(n) {
  return n && (n.data || n.audioData)
}

export function entryHasInlineMedia(entry) {
  if (!entry) return false
  if (PHOTO_FIELDS.some((f) => Array.isArray(entry[f]) && entry[f].some(photoIsHeavy))) return true
  if (Array.isArray(entry.voiceNotes) && entry.voiceNotes.some(voiceIsHeavy)) return true
  return false
}

export async function dehydrateEntry(entry) {
  const out = { ...entry }

  for (const field of PHOTO_FIELDS) {
    const arr = entry[field]
    if (!Array.isArray(arr)) continue
    out[field] = await Promise.all(arr.map(async (p) => {
      if (!p) return p
      const id = p.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      if (!photoIsHeavy(p)) return { ...p, id } // already slim
      try {
        await putMedia(`photo:${id}`, { originalData: p.originalData, previewData: p.previewData })
        return { id, name: p.name, type: p.type, metadata: p.metadata, stored: true }
      } catch {
        return { ...p, id } // keep inline rather than lose it
      }
    }))
  }

  if (Array.isArray(entry.voiceNotes)) {
    out.voiceNotes = await Promise.all(entry.voiceNotes.map(async (n) => {
      if (!n) return n
      const id = n.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      if (!voiceIsHeavy(n)) return { ...n, id }
      try {
        await putMedia(`voice:${id}`, { data: n.data || n.audioData })
        return { id, duration: n.duration, timestamp: n.timestamp, stored: true }
      } catch {
        return { ...n, id }
      }
    }))
  }

  return out
}

export async function hydrateEntry(entry) {
  if (!entry) return entry
  const out = { ...entry }

  for (const field of PHOTO_FIELDS) {
    const arr = entry[field]
    if (!Array.isArray(arr)) continue
    out[field] = await Promise.all(arr.map(async (p) => {
      if (!p || photoIsHeavy(p)) return p // already has data inline
      const m = await getMedia(`photo:${p.id}`)
      return m ? { ...p, originalData: m.originalData, previewData: m.previewData } : p
    }))
  }

  if (Array.isArray(entry.voiceNotes)) {
    out.voiceNotes = await Promise.all(entry.voiceNotes.map(async (n) => {
      if (!n || voiceIsHeavy(n)) return n
      const m = await getMedia(`voice:${n.id}`)
      return m ? { ...n, data: m.data } : n
    }))
  }

  return out
}

export async function deleteEntryMedia(entry) {
  if (!entry) return
  for (const field of PHOTO_FIELDS) {
    if (Array.isArray(entry[field])) {
      for (const p of entry[field]) {
        if (p?.id != null) await deleteMedia(`photo:${p.id}`).catch(() => {})
      }
    }
  }
  if (Array.isArray(entry.voiceNotes)) {
    for (const n of entry.voiceNotes) {
      if (n?.id != null) await deleteMedia(`voice:${n.id}`).catch(() => {})
    }
  }
}
