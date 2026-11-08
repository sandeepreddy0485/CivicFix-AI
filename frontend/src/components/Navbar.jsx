import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth()
  const { language, t, toggleLanguage } = useLanguage()
  const navigate = useNavigate()
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const onInstallAvailable = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const onInstalled = () => setInstallPrompt(null)
    const onOnline = () => setIsOffline(false)
    const onOffline = () => setIsOffline(true)

    window.addEventListener('beforeinstallprompt', onInstallAvailable)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallAvailable)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white text-slate-800 shadow-[0_4px_16px_rgba(15,35,55,0.06)]">
      <div className="flex h-1 w-full" aria-hidden="true">
        <span className="w-1/3 bg-[#e77b24]" />
        <span className="w-1/3 bg-white" />
        <span className="w-1/3 bg-[#16834b]" />
      </div>
      <div className="page-shell flex min-h-[76px] flex-wrap items-center justify-between gap-2 py-2 sm:flex-nowrap sm:gap-5 sm:py-0">
        <Link to="/" className="flex items-center gap-3 font-bold tracking-tight">
          <img
            src="/images/india-flag-logo.png"
            alt="Indian flag"
            className="h-11 w-11 rounded-xl object-contain"
          />
          <span className="text-lg">CivicFix <span className="font-medium text-brand-600">AI</span>          <span className="mt-0.5 hidden text-[10px] font-medium tracking-[0.08em] text-slate-500 sm:block">{t('CIVIC REPORTING · INDIA')}</span></span>
        </Link>

        <nav aria-label={language === 'hi' ? 'मुख्य नेविगेशन' : 'Main navigation'} className="flex w-full flex-wrap items-center justify-end gap-1 text-sm sm:w-auto sm:flex-nowrap sm:gap-3">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={t(language === 'en' ? 'Switch language to Hindi' : 'Switch language to English')}
            className="rounded-lg border border-slate-200 px-2.5 py-2 font-bold text-brand-700 transition hover:bg-brand-50 focus:outline-none focus:ring-4 focus:ring-brand-100 sm:px-3"
          >
            {language === 'en' ? 'हिंदी' : 'English'}
          </button>
          {isOffline && <span role="status" className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-800">{t('Offline')}</span>}
          {installPrompt && (
            <button type="button" onClick={handleInstall} className="rounded-lg bg-brand-50 px-2.5 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-100">
              {t('Install app')}
            </button>
          )}
          {user ? (
            <>
              {isAdmin ? (
                <Link to="/admin" className="rounded-lg px-2 py-2 font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-brand-700">{t('Dashboard')}</Link>
              ) : (
                <>
                  <Link to="/report" className="rounded-lg px-2 py-2 font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-brand-700"><span className="sm:hidden">{t('Report')}</span><span className="hidden sm:inline">{t('Report an issue')}</span></Link>
                  <Link to="/my-complaints" className="rounded-lg px-2 py-2 font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-brand-700"><span className="sm:hidden">{t('My reports')}</span><span className="hidden sm:inline">{t('Track reports')}</span></Link>
                </>
              )}
              <NotificationBell key={user.id} userId={user.id} />
              <span className="hidden text-slate-500 md:inline">{language === 'hi' ? 'नमस्ते' : 'Namaste'}, {user.name.split(' ')[0]}</span>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {t('Sign out')}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-2 py-2 font-semibold text-slate-600 transition hover:bg-slate-50 sm:px-3">{t('Sign in')}</Link>
              <Link to="/register" className="rounded-lg bg-brand-600 px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-brand-700">
                {t('Register')} <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
