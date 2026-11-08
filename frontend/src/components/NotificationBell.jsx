import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/complaintService'
import { useLanguage } from '../context/LanguageContext'

export default function NotificationBell({ userId }) {
  const { t, locale } = useLanguage()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function refresh() {
      try {
        const items = await getNotifications()
        if (active) {
          setNotifications(items)
          setError('')
        }
      } catch {
        if (active) setError(t('Could not load notifications.'))
      }
    }

    setNotifications([])
    refresh()
    const intervalId = window.setInterval(refresh, 30_000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [userId, t])

  const unreadCount = notifications.filter((notification) => !notification.read_at).length

  async function handleSelect(notification) {
    if (!notification.read_at) {
      try {
        const updated = await markNotificationRead(notification.id)
        setNotifications((items) => items.map((item) => item.id === updated.id ? updated : item))
      } catch {
        setError(t('Could not mark notifications as read.'))
        return
      }
    }
    setOpen(false)
    navigate(`/complaints/${notification.complaint_id}`)
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      const readAt = new Date().toISOString()
      setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || readAt })))
      setError('')
    } catch {
      setError(t('Could not mark notifications as read.'))
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`${t('Notifications')}${unreadCount ? ` (${unreadCount})` : ''}`}
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-lg text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-brand-100"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-xl" aria-label={t('Notifications')}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-extrabold text-slate-800">{t('Notifications')}</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs font-bold text-brand-700 hover:text-brand-800">
                {t('Mark all as read')}
              </button>
            )}
          </div>
          {error && <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
          <ul className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">{t('No notifications yet')}</li>
            ) : notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(notification)}
                  className={`w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${notification.read_at ? '' : 'bg-brand-50/50'}`}
                >
                  <span className="block text-sm font-semibold text-slate-800">
                    {t('Report')} #{notification.complaint_id}: {t('Report status updated to ')}{t(notification.new_status.replace(/_/g, ' '))}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">{new Date(notification.created_at).toLocaleString(locale)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
