import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard, getAllComplaints, getOpenComplaintFlags, restoreComplaint, reviewComplaintFlag, updateComplaintStatus } from '../services/complaintService'
import { SeverityBadge, StatusBadge } from '../components/Badges'
import { useLanguage } from '../context/LanguageContext'

const STATUS_OPTIONS = ['submitted', 'ai_analyzed', 'assigned', 'in_progress', 'resolved', 'closed']

function StatCard({ label, value, accent, mark }) {
  const { t } = useLanguage()
  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold leading-5 text-slate-500">{t(label)}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-extrabold ${accent}`}>{mark}</span>
      </div>
      <p className={`mt-3 font-['Manrope'] text-3xl font-extrabold tracking-tight ${accent.replace(/bg-[^ ]+/, '')}`}>{value}</p>
    </div>
  )
}

function Breakdown({ title, data, emptyText }) {
  const { t } = useLanguage()
  const entries = Object.entries(data || {})
  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-sm font-extrabold text-slate-800">{t(title)}</h2>
      {entries.length ? (
        <ul className="mt-4 space-y-3">
          {entries.map(([label, count]) => {
            const max = Math.max(...entries.map(([, value]) => value), 1)
            return (
              <li key={label}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="capitalize text-slate-600">{t(label.replace(/_/g, ' '))}</span>
                  <span className="font-bold text-slate-800">{count}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max((count / max) * 100, 4)}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      ) : <p className="mt-4 text-sm text-slate-400">{t(emptyText)}</p>}
    </section>
  )
}

export default function AdminDashboard() {
  const { t, locale, language } = useLanguage()
  const [stats, setStats] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  async function loadData() {
    try {
      setError('')
      const [dashboardData, complaintsData, flagData] = await Promise.all([getDashboard(), getAllComplaints(), getOpenComplaintFlags()])
      setStats(dashboardData)
      setComplaints(complaintsData)
      setFlags(flagData)
    } catch {
      setError(t('Could not load dashboard data. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleStatusChange(id, newStatus) {
    try {
      await updateComplaintStatus(id, newStatus)
      await loadData()
    } catch {
      setError(t('Could not update status. Please try again.'))
    }
  }

  async function handleFlagReview(id, action) {
    try {
      await reviewComplaintFlag(id, { action })
      await loadData()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || t('Could not review this report flag. Please try again.'))
    }
  }

  async function handleRestore(id) {
    try {
      await restoreComplaint(id)
      await loadData()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || t('Could not restore this report. Please try again.'))
    }
  }

  if (loading) return <div className="page-shell py-20 text-center text-sm text-slate-500">{t('Loading admin dashboard…')}</div>
  if (error && !stats) {
    return <div className="page-shell max-w-3xl py-20 text-center"><div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div><button onClick={loadData} className="btn-secondary mt-5">{t('Try again')}</button></div>
  }

  const filtered = filter === 'all' ? complaints : complaints.filter((c) => c.status === filter)

  return (
    <div className="page-shell max-w-7xl py-9 sm:py-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">{t('Municipal services · Operations')}</p>
          <h1 className="mt-2 font-['Manrope'] text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t('Service dashboard')}</h1>
          <p className="mt-2 text-sm text-slate-500">{t('Review citizen reports and update their progress.')}</p>
        </div>
        <button onClick={loadData} className="btn-secondary self-start !px-4 !py-2.5 sm:self-auto"><span aria-hidden="true">↻</span> {t('Refresh data')}</button>
      </div>

      {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total reports" value={stats.total_complaints} accent="bg-brand-50 text-brand-700" mark="ALL" />
        <StatCard label="Pending" value={stats.pending_complaints} accent="bg-amber-50 text-amber-700" mark="..." />
        <StatCard label="In progress" value={stats.in_progress_complaints} accent="bg-sky-50 text-sky-700" mark="→" />
        <StatCard label="Resolved" value={stats.resolved_complaints} accent="bg-emerald-50 text-emerald-700" mark="✓" />
        <StatCard label="Critical priority" value={stats.critical_complaints} accent="bg-rose-50 text-rose-700" mark="!" />
        <StatCard label="Overdue reports" value={stats.overdue_complaints ?? 0} accent="bg-red-50 text-red-700" mark="!" />
      </div>

      <section className="surface-card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 p-4 sm:px-5">
          <h2 className="font-extrabold text-slate-800">{t('Moderation review')}</h2>
          <p className="mt-1 text-xs text-slate-500">{t('Review resident flags. Reports are never hidden automatically.')}</p>
        </div>
        {flags.length ? (
          <ul className="divide-y divide-slate-100">
            {flags.map((flag) => (
              <li key={flag.id} className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    <Link to={`/complaints/${flag.complaint_id}`} className="text-brand-700 hover:underline">{t('Report')} #{flag.complaint_id}</Link>
                    {' · '}{t(flag.category.replace(/_/g, ' '))} · {t(flag.reason.replace(/_/g, ' '))}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{flag.locality || t('No location provided')} · {flag.open_flag_count} {t('open flags')}</p>
                  {flag.details && <p className="mt-2 break-words text-sm text-slate-600">{flag.details}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => handleFlagReview(flag.id, 'dismiss')} className="btn-secondary !px-3 !py-2 text-xs">{t('Dismiss flag')}</button>
                  <button type="button" onClick={() => handleFlagReview(flag.id, 'hide')} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700">{t('Hide report')}</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="p-5 text-sm text-slate-400">{t('No reports are awaiting moderation.')}</p>}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Breakdown title="Reports by category" data={stats.category_distribution} emptyText="No category data to show yet." />
        <Breakdown title="Department workload" data={stats.department_performance} emptyText="No department data to show yet." />
      </div>

      <section className="surface-card mt-6 overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:px-5">
          <div>
            <h2 className="font-extrabold text-slate-800">{t('All reports')}</h2>
              <p className="mt-1 text-xs text-slate-500">{filtered.length} {t(filtered.length === 1 ? 'report shown' : 'reports shown')}</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            {t('Status')}
            <select aria-label={t('Filter reports by status')} value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
              <option value="all">{t('All statuses')}</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{t(s.replace(/_/g, ' '))}</option>)}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3">{t('Report')}</th>
                <th scope="col" className="px-4 py-3">{t('Category')}</th>
                <th scope="col" className="px-4 py-3">{t('Priority')}</th>
                <th scope="col" className="px-4 py-3">{t('Status')}</th>
                <th scope="col" className="px-4 py-3">{t('Submitted')}</th>
                <th scope="col" className="px-4 py-3">{t('Deadline')}</th>
                <th scope="col" className="px-4 py-3">{t('Update status')}</th>
                <th scope="col" className="px-4 py-3">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="transition hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-5 py-4 font-bold text-slate-700">#{c.id}</td>
                  <td className="px-4 py-4 capitalize text-slate-600">{t(c.category.replace(/_/g, ' '))}</td>
                  <td className="px-4 py-4"><SeverityBadge severity={c.severity} /></td>
                  <td className="px-4 py-4"><StatusBadge status={c.status} /></td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString(locale)}</td>
                  <td className={`whitespace-nowrap px-4 py-4 text-xs ${c.due_at && !['resolved', 'closed'].includes(c.status) && new Date(c.due_at).getTime() < Date.now() ? 'font-bold text-red-700' : 'text-slate-500'}`}>
                    {c.due_at ? new Date(c.due_at).toLocaleDateString(locale) : '—'}
                    {c.due_at && !['resolved', 'closed'].includes(c.status) && new Date(c.due_at).getTime() < Date.now() && <span className="ml-1">{t('Overdue')}</span>}
                  </td>
                  <td className="px-4 py-4">
                    <select aria-label={language === 'hi' ? `रिपोर्ट ${c.id} की स्थिति अपडेट करें` : `Update status for report ${c.id}`} value={c.status} onChange={(e) => handleStatusChange(c.id, e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium capitalize text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{t(s.replace(/_/g, ' '))}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Link to={`/complaints/${c.id}`} className="font-bold text-brand-600 hover:text-brand-700">{t('View →')}</Link>
                      {c.moderation_status === 'hidden' && <button type="button" onClick={() => handleRestore(c.id)} className="font-bold text-emerald-700 hover:text-emerald-800">{t('Restore')}</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-400">{t('No reports match this filter.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
