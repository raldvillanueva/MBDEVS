// A compact strip of pictures attached to a record.
//
// Deliberately small: a row of thumbnails the height of one input, so it
// sits inside a form that is already long without pushing everything else
// off the screen. Clicking one opens it full size over the whole window,
// which is where the detail is actually wanted.
//
// Read-only (a record already in Field Orders) shows the same strip with
// no add tile and no remove buttons, and disappears entirely when there
// are no pictures rather than leaving an empty label behind.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImagePlus, X, ChevronLeft, ChevronRight, Loader2, ImageOff } from 'lucide-react'
import {
  MAX_PHOTOS,
  PHOTO_ACCEPT,
  deletePhoto,
  uploadPhotos,
  useSignedPhotoUrls,
} from '../lib/recordPhotos'

export default function RecordPhotos({ value, onChange, sector, readOnly = false }) {
  const paths = Array.isArray(value) ? value : []
  const urls = useSignedPhotoUrls(paths)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState(-1)
  const inputRef = useRef(null)

  const room = MAX_PHOTOS - paths.length

  if (readOnly && paths.length === 0) return null

  async function addFiles(fileList) {
    const chosen = Array.from(fileList || [])
    if (chosen.length === 0) return

    // Taking the first few rather than refusing the lot: picking six by
    // accident should still get five of them attached.
    const taking = chosen.slice(0, room)
    setBusy(true)
    setError('')
    const { added, errors } = await uploadPhotos(taking, sector)
    setBusy(false)

    if (added.length > 0) onChange([...paths, ...added])
    const over = chosen.length > room ? [`Only ${MAX_PHOTOS} pictures can be attached to a record.`] : []
    setError([...over, ...errors].join(' '))
  }

  async function remove(path) {
    onChange(paths.filter(p => p !== path))
    setError('')
    await deletePhoto(path)
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
          Photos
        </label>
        <span className="text-[11px] text-slate-400">
          {readOnly ? `${paths.length}` : `${paths.length} of ${MAX_PHOTOS}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {paths.map((path, index) => (
          <div key={path} className="group relative">
            {/* Not a <button>: the drawer wraps the form in a disabled
                fieldset for anyone who may not edit, and that would take
                looking at a picture away along with changing it. */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setViewing(index)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewing(index) } }}
              className="block h-14 w-14 cursor-pointer overflow-hidden rounded border border-slate-200 bg-slate-100 transition-colors hover:border-blue-400"
              title="View"
            >
              {urls[path] ? (
                <img src={urls[path]} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-slate-300">
                  <Loader2 size={14} className="animate-spin" />
                </span>
              )}
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(path)}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-700 p-0.5 text-white opacity-0 shadow transition-opacity hover:bg-red-600 group-hover:opacity-100"
                title="Remove"
                aria-label="Remove picture"
              >
                <X size={11} />
              </button>
            )}
          </div>
        ))}

        {!readOnly && room > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-blue-400 hover:text-blue-500 disabled:opacity-60"
            title="Add a picture"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            <span className="text-[10px] leading-none">{busy ? 'Adding' : 'Add'}</span>
          </button>
        )}

        {paths.length === 0 && readOnly === false && !busy && (
          <span className="text-xs text-slate-400">No pictures attached</span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_ACCEPT}
          multiple
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      {viewing >= 0 && paths[viewing] && (
        <Lightbox
          paths={paths}
          urls={urls}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(-1)}
        />
      )}
    </div>
  )
}

function Lightbox({ paths, urls, index, onIndex, onClose }) {
  const path = paths[index]
  const url = urls[path]

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      // The drawer underneath closes on Escape too. Caught here on the way
      // down and stopped, so Escape shuts the picture and leaves the record
      // open — otherwise one press would close both.
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onIndex((index - 1 + paths.length) % paths.length)
      if (e.key === 'ArrowRight') onIndex((index + 1) % paths.length)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [index, paths.length, onClose, onIndex])

  // Rendered on the body rather than where it sits in the tree: it has to
  // cover the drawer, and inside that disabled fieldset its own arrows
  // would be dead.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Close"
      >
        <X size={22} />
      </button>

      {paths.length > 1 && (
        <>
          <Arrow side="left" onClick={e => { e.stopPropagation(); onIndex((index - 1 + paths.length) % paths.length) }} />
          <Arrow side="right" onClick={e => { e.stopPropagation(); onIndex((index + 1) % paths.length) }} />
        </>
      )}

      <div className="flex max-h-full max-w-5xl flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        {url ? (
          <img src={url} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl" />
        ) : (
          <span className="flex items-center gap-2 text-sm text-white/70">
            <ImageOff size={16} /> This picture could not be loaded.
          </span>
        )}
        <p className="text-xs text-white/60">{index + 1} of {paths.length}</p>
      </div>
    </div>,
    document.body,
  )
}

function Arrow({ side, onClick }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute ${side === 'left' ? 'left-3' : 'right-3'} rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white`}
      aria-label={side === 'left' ? 'Previous' : 'Next'}
    >
      <Icon size={24} />
    </button>
  )
}
