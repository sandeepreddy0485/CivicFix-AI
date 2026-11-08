import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { confirmComplaint, getComplaint, getComplaintImageUrl, removeComplaintConfirmation } from '../services/complaintService'
import { SeverityBadge, StatusBadge } from '../components/Badges'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'

const LIFECYCLE_STEPS = ['submitted', 'ai_analyzed', 'assigned', 'in_progress', 'resolved', 'closed']

export default function ComplaintDetails() {
  const { id } = useParams()
  const { t, locale } = useLanguage()
  const { user } = useAuth()
  const [complaint, setComplaint] = useState(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    getComplaint(id)
      .then(setComplaint)
      .catch((err) => setError(err.response?.data?.detail || t('Could not load this complaint.')))
      .finally(() => setLoading(false))
  }, [id, t])

  async function handleToggleConfirmation() {
    setConfirming(true)
    setActionError('')
    try {
      const summary = complaint.confirmed_by_user
        ? await removeComplaintConfirmation(complaint.id)
        : await confirmComplaint(complaint.id)
      setComplaint((current) => ({ ...current, ...summary }))
    } catch (requestError) {
      setActionError(requestError.response?.data?.detail || t('Could not update your confirmation. Please try again.'))
    } finally {
      setConfirming(false)
    }
  }

  if (loading) return <div className="page-shell py-20 text-center text-sm text-slate-500">{t('Loading report details…')}</div>
  if (error) return <div role="alert" className="page-shell py-20 text-center text-sm text-red-600">{error}</div>
  if (!complaint) return null

  const currentStepIndex = LIFECYCLE_STEPS.indexOf(complaint.status)
  const beforeImage = complaint.images.find((img) => img.image_type === 'before')
  const afterImage = complaint.images.find((img) => img.image_type === 'after')
  const latestPrediction = complaint.predictions[complaint.predictions.length - 1]
  const canConfirm = user?.id !== complaint.user_id
    && ['submitted', 'ai_analyzed', 'assigned', 'in_progress'].includes(complaint.status)
  const isActive = !['resolved', 'closed'].includes(complaint.status)
  const deadline = complaint.due_at ? new Date(complaint.due_at) : null
  const isOverdue = isActive && deadline && deadline.getTime() < Date.now()

  return (
    <div className="page-shell max-w-4xl py-8 sm:py-12">
      <Link to="/my-complaints" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-brand-700 transition hover:gap-3">
        <span aria-hidden="true">←</span> {t('Back to my reports')}
      </Link>

      <div className="surface-card overflow-hidden">
        <div className="border-b border-slate-100 bg-white p-5 sm:p-7">
          <p className="eyebrow">Report #{complaint.id}</p>
          <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-['Manrope'] text-2xl font-extrabold capitalize tracking-tight text-slate-900 sm:text-3xl">
              {t(complaint.category.replace(/_/g, ' '))}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {t('Submitted')} {new Date(complaint.created_at).toLocaleString(locale)}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <StatusBadge status={complaint.status} />
            <SeverityBadge severity={complaint.severity} />
          </div>
          </div>
        </div>

        {complaint.description && (
          <p className="mx-5 mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700 sm:mx-7 sm:mt-6">
            {complaint.description}
          </p>
        )}

        <section className="mx-5 mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:mx-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">{t('Location')}</h2>
              <p className="mt-1 text-sm text-slate-600">{complaint.locality || t('No location provided')}</p>
              {complaint.latitude != null && complaint.longitude != null && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${complaint.latitude}&mlon=${complaint.longitude}#map=17/${complaint.latitude}/${complaint.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:text-brand-800"
                >
                  {complaint.latitude.toFixed(5)}, {complaint.longitude.toFixed(5)} · {t('Open map')}
                </a>
              )}
            </div>
          </div>
        </section>

        {deadline && (
          <section className={`mx-5 mt-4 rounded-2xl border p-4 sm:mx-7 ${isOverdue ? 'border-red-200 bg-red-50' : 'border-emerald-100 bg-emerald-50/60'}`}>
            <h2 className={`text-sm font-extrabold ${isOverdue ? 'text-red-800' : 'text-emerald-900'}`}>{t(isOverdue ? 'Resolution deadline missed' : 'Expected resolution by')}</h2>
            <p className={`mt-1 text-sm ${isOverdue ? 'text-red-700' : 'text-emerald-800'}`}>{deadline.toLocaleString(locale)}</p>
            <p className="mt-1 text-xs text-slate-500">{t('Deadline target is based on the report priority and may be updated by the municipal team.')}</p>
          </section>
        )}

        {complaint.moderation_status === 'hidden' && (
          <div role="status" className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:mx-7">
            {t('This report is hidden from public matching while a municipal administrator reviews it.')}
          </div>
        )}

        <section className="mx-5 mt-4 rounded-2xl border border-brand-100 bg-brand-50/50 p-4 sm:mx-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">{t('Community confirmations')}</h2>
              <p className="mt-1 text-xs text-slate-600">{t('Confirm this is still an active issue in your area.')}</p>
              <p className="mt-2 text-sm font-bold text-brand-800">{complaint.confirmation_count || 0} {t('community confirmations')}</p>
            </div>
            {canConfirm && (
              <button type="button" onClick={handleToggleConfirmation} disabled={confirming} className="btn-secondary !py-2.5">
                {t(confirming ? 'Confirming…' : complaint.confirmed_by_user ? 'Remove confirmation' : 'Confirm issue')}
              </button>
            )}
          </div>
        </section>

        {actionError && <div role="alert" className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-7">{actionError}</div>}

        {/* Lifecycle progress */}
        <div className="px-5 pt-6 sm:px-7">
          <div className="mb-4 flex items-end justify-between">
            <div><p className="eyebrow">{t('Report lifecycle')}</p><h2 className="mt-1 text-lg font-extrabold text-slate-800">{t('Progress')}</h2></div>
            <p className="text-xs font-semibold capitalize text-brand-700">{t(complaint.status.replace(/_/g, ' '))}</p>
          </div>
          <div className="flex items-center">
            {LIFECYCLE_STEPS.map((step, idx) => (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                <div
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    idx <= currentStepIndex ? 'bg-brand-600 ring-4 ring-brand-100' : 'bg-slate-200'
                  }`}
                  title={t(step.replace(/_/g, ' '))}
                />
                {idx < LIFECYCLE_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 ${idx < currentStepIndex ? 'bg-brand-500' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between gap-1 text-[9px] text-slate-400 sm:text-[10px]">
            {LIFECYCLE_STEPS.map((step, idx) => (
              <span key={step} className={`max-w-[72px] capitalize ${idx <= currentStepIndex ? 'font-bold text-brand-700' : ''}`}>{t(step.replace(/_/g, ' '))}</span>
            ))}
          </div>
        </div>

        {/* Images */}
        <div className="grid grid-cols-1 gap-4 px-5 pt-7 sm:grid-cols-2 sm:px-7">
          {beforeImage && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{t('Reported photo')}</p>
              <img src={getComplaintImageUrl(beforeImage.image_url)} alt={t('Reported issue')} className="h-52 w-full rounded-xl border border-slate-100 object-cover" />
            </div>
          )}
          {afterImage && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{t('Resolution photo')}</p>
              <img src={getComplaintImageUrl(afterImage.image_url)} alt={t('Resolved issue')} className="h-52 w-full rounded-xl border border-slate-100 object-cover" />
            </div>
          )}
        </div>

        {/* AI prediction */}
        {latestPrediction && (
          <div className="mx-5 mt-7 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:mx-7 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-extrabold text-brand-900">{t('Photo analysis')}</p><p className="mt-1 text-xs text-brand-700">{t('AI-assisted issue identification')}</p></div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700">{(latestPrediction.confidence * 100).toFixed(1)}%{t(' confidence')}</span>
            </div>
            <p className="mt-4 text-sm text-slate-700">{t('Detected category: ')}<span className="font-bold capitalize">{t(latestPrediction.predicted_category.replace(/_/g, ' '))}</span></p>
            <p className="mt-2 break-all text-[10px] text-slate-400">{t('Model: ')}{latestPrediction.model_version}</p>
          </div>
        )}

        {/* Status history */}
        {complaint.history?.length > 0 && (
          <div className="px-5 py-7 sm:px-7">
            <h2 className="text-lg font-extrabold text-slate-800">{t('Update history')}</h2>
            <ul className="mt-4 space-y-0">
              {complaint.history.map((h, idx) => (
                <li key={idx} className="flex flex-col gap-1 border-t border-slate-100 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold capitalize text-slate-700">
                    {h.old_status ? `${t(h.old_status.replace(/_/g, ' '))} → ` : `${t('Report')} `}
                    {t(h.new_status.replace(/_/g, ' '))}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(h.updated_at).toLocaleString(locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
