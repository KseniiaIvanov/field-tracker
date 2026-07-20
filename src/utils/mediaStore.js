// Separate IndexedDB store for heavy media (photo/voice base64), kept OUT of the
// main `allEntries` array. This is what lets a save write just one entry instead
// of rewriting every photo of every site, and keeps the in-memory entry list
// small — critical once a campaign grows to dozens of sites with photos.
import localforage from 'localforage'

const mediaStore = localforage.createInstance({
  name: 'field-tracker',
  storeName: 'media',
})

export async function putMedia(id, payload) {
  await mediaStore.setItem(String(id), payload)
}

export async function getMedia(id) {
  return mediaStore.getItem(String(id))
}

export async function deleteMedia(id) {
  await mediaStore.removeItem(String(id))
}
