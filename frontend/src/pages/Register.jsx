import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Register() {
  const { register } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError(t('Password must be at least 6 characters.'))
      return
    }
    setLoading(true)
    try {
      await register(name, email, password)
      navigate('/report')
    } catch (err) {
      setError(err.response?.data?.detail || t('Registration failed. Try a different email.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell py-10 sm:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[1.25rem] border-t-4 border-t-[#e77b24] border-x border-b border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(27,54,39,0.10)] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden min-h-[590px] overflow-hidden bg-[#153c55] p-10 text-white md:flex md:flex-col md:justify-between">
          <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-16 -left-8 h-56 w-56 rounded-full border border-white/10" />
          <div className="relative">
            <p className="eyebrow !text-orange-200">{t('Citizen services')}</p>
            <h2 className="mt-5 max-w-sm font-['Manrope'] text-4xl font-extrabold leading-tight">{t('Your voice can improve your neighbourhood.')}</h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-sky-50/80">{t('Create an account to report civic issues in your area and follow their progress.')}</p>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {['Report', 'Route', 'Resolve'].map((item, index) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/[0.07] p-3">
                <span className="text-[10px] font-bold text-orange-200">0{index + 1}</span>
                <p className="mt-2 text-sm font-bold">{t(item)}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="p-6 sm:p-10 md:p-12">
          <p className="eyebrow">{t('Citizen registration')}</p>
          <h1 className="mt-2 font-['Manrope'] text-3xl font-extrabold tracking-tight text-slate-900">{t('Create your account')}</h1>
          <p className="mt-2 text-sm text-slate-500">{t('Create an account to submit and track civic reports.')}</p>

          {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="register-name" className="field-label">{t('Name')}</label>
              <input id="register-name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className="field-control" placeholder={t('Enter your name')} />
            </div>
            <div>
              <label htmlFor="register-email" className="field-label">{t('Email address')}</label>
              <input id="register-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field-control" placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="register-password" className="field-label">{t('Password')}</label>
              <input id="register-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field-control" placeholder={t('At least 6 characters')} />
              <p className="mt-2 text-xs text-slate-400">{t('Use at least 6 characters.')}</p>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {t(loading ? 'Creating account…' : 'Create account')} <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-500">
            {t('Already have an account? ')}<Link to="/login" className="font-bold text-brand-600 hover:text-brand-700">{t('Sign in')}</Link>
          </p>
        </section>
      </div>
    </div>
  )
}
