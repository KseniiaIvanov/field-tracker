// Save a Blob to the device.
//
// iOS/Safari does not reliably honor a programmatic `<a download>` for blob
// URLs (nothing happens, or the file opens in-page). The robust path there is
// the native share sheet (→ "Save to Files"). We prefer it when the browser can
// share files, and fall back to a download link everywhere else (desktop).
//
// Only call this from a user gesture (a button click) — iOS requires it.
export async function saveFile(blob, fileName, mimeType = 'application/octet-stream') {
  const file = new File([blob], fileName, { type: mimeType })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return
    } catch (err) {
      // User dismissed the share sheet — treat as done, don't double-trigger.
      if (err && err.name === 'AbortError') return
      // Otherwise fall through to the download-link fallback.
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
