import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Login() {
  const { login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(user.role === 'admin' ? '/admin' : '/report')
    } catch (err) {
      setError(err.response?.data?.detail || t('Login failed. Check your credentials.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell py-10 sm:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[1.25rem] border-t-4 border-t-[#e77b24] border-x border-b border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(27,54,39,0.10)] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden min-h-[550px] overflow-hidden bg-[#153c55] p-10 text-white md:flex md:flex-col md:justify-between">
          <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-16 -left-8 h-56 w-56 rounded-full border border-white/10" />
          <div className="relative">
            <p className="eyebrow !text-orange-200">{t('Citizen services')}</p>
            <h2 className="mt-5 max-w-sm font-['Manrope'] text-4xl font-extrabold leading-tight">{t('Better neighbourhoods start with residents like you.')}</h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-sky-50/80">{t('Sign in to track civic issues you have reported and see the latest status updates.')}</p>
          </div>
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.07] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-orange-200">{t('Your reports, all in one place')}</p>
            <p className="mt-2 text-sm leading-6 text-sky-50/90">{t('Check report progress and follow updates from the relevant department.')}</p>
          </div>
        </aside>

        <section className="p-6 sm:p-10 md:p-12">
          <p className="eyebrow">{t('Citizen access')}</p>
          <h1 className="mt-2 font-['Manrope'] text-3xl font-extrabold tracking-tight text-slate-900">{t('Sign in to CivicFix')}</h1>
          <p className="mt-2 text-sm text-slate-500">{t('Access your civic reports and updates.')}</p>

          {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-email" className="field-label">{t('Email address')}</label>
              <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field-control" placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="login-password" className="field-label">{t('Password')}</label>
              <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field-control" placeholder={t('Enter your password')} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {t(loading ? 'Signing in…' : 'Sign in')} <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-500">
            {t('New to CivicFix? ')}<Link to="/register" className="font-bold text-brand-600 hover:text-brand-700">{t('Create an account')}</Link>
          </p>
        </section>
      </div>
    </div>
  )
}
