// Pictures attached to a record.
//
// The files sit in a private Storage bucket (record_photos_setup.sql) and
// the record keeps only their paths, in a `photos` text[] column. Nothing
// here is reachable by URL alone: every picture shown is fetched through a
// signed link that expires within the hour.
//
// Every upload is shrunk in the browser first. A phone camera produces
// 3–5 MB a shot, and five of those on each of twelve thousand records is
// far more than the storage allowance — and far more than anyone needs to
// see whether a seal was fitted. Resized to 1600px they land near 300 KB,
// which is still more detail than the screen can show.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const PHOTO_BUCKET = 'record-photos'
export const MAX_PHOTOS = 5
const MAX_EDGE = 1600
const QUALITY = 0.82

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']
export const PHOTO_ACCEPT = ACCEPT.join(',')

/**
 * Draw the picture into a canvas no bigger than MAX_EDGE on its long side
 * and read it back out as a JPEG.
 *
 * A picture that is already small is left alone rather than re-encoded,
 * which would only lose detail for no saving. Anything that will not
 * decode — a file with the wrong extension, say — is passed through
 * untouched so the upload itself reports the problem.
 */
async function shrink(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 600 * 1024) {
    bitmap.close?.()
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
  if (!blob) return file
  // Only worth keeping if it actually came out smaller.
  return blob.size < file.size ? blob : file
}

function safeName(name) {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : 'jpg'
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'jpg'
}

/**
 * Upload the chosen files and return the paths of the ones that landed.
 *
 * Paths are keyed on a fresh id rather than on the record, so a picture
 * can be attached while the record is still being typed and has no id of
 * its own yet. Each file is reported on separately: one that fails does
 * not take the rest of the batch with it.
 */
export async function uploadPhotos(files, sector, { onProgress } = {}) {
  const added = []
  const errors = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    onProgress?.(i, files.length)

    if (!ACCEPT.includes(file.type)) {
      errors.push(`${file.name} is not a JPEG, PNG or WebP picture.`)
      continue
    }

    const body = await shrink(file)
    const path = `${sector || 'unknown'}/${crypto.randomUUID()}.${safeName(file.name)}`
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, body, { contentType: body.type || file.type, upsert: false })

    if (error) {
      errors.push(
        /row-level security|unauthorized/i.test(error.message || '')
          ? `${file.name} could not be uploaded — your account cannot attach pictures.`
          : `${file.name} could not be uploaded. ${error.message || ''}`.trim()
      )
      continue
    }
    added.push(path)
  }

  onProgress?.(files.length, files.length)
  return { added, errors }
}

/**
 * Delete the file behind a path.
 *
 * The caller drops the path from the record either way. A file left
 * behind in the bucket costs a little space; a path left on a record
 * whose file is gone shows as a broken picture every time the record is
 * opened, which is worse.
 */
export async function deletePhoto(path) {
  await supabase.storage.from(PHOTO_BUCKET).remove([path])
}

/**
 * Signed links for a list of paths, as a { path: url } map.
 *
 * Re-signed whenever the list changes. The links last an hour, which is
 * far longer than a record stays open.
 */
export function useSignedPhotoUrls(paths) {
  const [urls, setUrls] = useState({})
  // The array is rebuilt on every render, so the effect keys off its
  // contents instead — otherwise it would re-sign on each keystroke.
  const key = (paths || []).join('|')

  useEffect(() => {
    const list = key ? key.split('|') : []
    if (list.length === 0) { setUrls({}); return undefined }

    let alive = true
    supabase.storage.from(PHOTO_BUCKET).createSignedUrls(list, 3600).then(({ data }) => {
      if (!alive || !data) return
      const next = {}
      for (const row of data) if (row.signedUrl) next[row.path] = row.signedUrl
      setUrls(next)
    })
    return () => { alive = false }
  }, [key])

  return urls
}
