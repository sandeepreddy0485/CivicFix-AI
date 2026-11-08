import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyComplaints } from '../services/complaintService'
import { SeverityBadge, StatusBadge } from '../components/Badges'
import { useLanguage } from '../context/LanguageContext'

export default function MyComplaints() {
  const { t, locale } = useLanguage()
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyComplaints()
      .then(setComplaints)
      .catch(() => setError(t('Could not load your complaints.')))
      .finally(() => setLoading(false))
  }, [t])

  return (
    <div className="page-shell max-w-5xl py-10 sm:py-14">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">{t('Citizen services')}</p>
          <h1 className="mt-2 font-['Manrope'] text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t('Track your reports')}</h1>
          <p className="mt-2 text-sm text-slate-500">{t('View the status and latest updates for issues you have reported.')}</p>
        </div>
        <Link to="/report" className="btn-primary self-start sm:self-auto"><span aria-hidden="true">+</span> {t('Report an issue')}</Link>
      </div>

      <div className="mt-8">
        {loading && <div className="surface-card p-8 text-center text-sm text-slate-500">{t('Loading your reports…')}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {!loading && !error && complaints.length === 0 && (
          <div className="surface-card px-6 py-14 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl text-brand-700">+</span>
            <h2 className="mt-5 text-lg font-extrabold text-slate-800">{t('Nothing reported yet')}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{t('When you spot an issue in your neighborhood, submit a report here to start tracking its progress.')}</p>
            <Link to="/report" className="btn-primary mt-6">{t('Make your first report')} <span aria-hidden="true">→</span></Link>
          </div>
        )}

        <div className="space-y-3">
          {complaints.map((c) => (
            <Link key={c.id} to={`/complaints/${c.id}`} className="surface-card group block p-4 transition hover:-translate-y-0.5 hover:border-brand-100 hover:shadow-lg hover:shadow-brand-900/5 sm:p-5">
              <div className="flex items-start gap-4">
                <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-extrabold text-brand-700 sm:grid">{String(c.id).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className="font-bold capitalize text-slate-800 group-hover:text-brand-700">{t(c.category.replace(/_/g, ' '))}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{c.description || t('No description provided.')}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <StatusBadge status={c.status} />
                      <SeverityBadge severity={c.severity} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-400">{t('Report')} #{c.id} · {t('Submitted')} {new Date(c.created_at).toLocaleString(locale)}</p>
                    <span className="text-xs font-bold text-brand-600 transition group-hover:translate-x-1">{t('View details →')}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
