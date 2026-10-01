// The name at the bottom of the sidebar, as a button.
//
// Where you'd go looking for anything to do with your own account, so
// that is where it lives, rather than as another item in a list of
// places to navigate to. Opens upward: the footer is already at the
// bottom of the screen.

import { useEffect, useRef, useState } from 'react'
import { ChevronUp, KeyRound } from 'lucide-react'
import ChangePasswordModal from './ChangePasswordModal'

export default function AccountMenu({ children }) {
  const [open, setOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDown(e) { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 text-left transition-colors hover:bg-[#3C3C3C]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">{children}</div>
        <ChevronUp
          size={15}
          className={`shrink-0 text-gray-400 transition-transform ${open ? '' : 'rotate-180'}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-40 mb-2 w-full overflow-hidden rounded-lg border border-[#4A4A4A] bg-[#3C3C3C] shadow-xl"
        >
          <button
            role="menuitem"
            onClick={() => { setOpen(false); setChangingPassword(true) }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:bg-[#4A4A4A] hover:text-white"
          >
            <KeyRound size={15} />
            Change Password
          </button>
        </div>
      )}

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </div>
  )
}
