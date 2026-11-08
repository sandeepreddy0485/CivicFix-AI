import { useLanguage } from '../context/LanguageContext'

const SEVERITY_STYLES = {
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
}

const STATUS_STYLES = {
  submitted: 'bg-slate-50 text-slate-600 border-slate-200',
  ai_analyzed: 'bg-violet-50 text-violet-700 border-violet-200',
  assigned: 'bg-sky-50 text-sky-700 border-sky-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-teal-50 text-teal-800 border-teal-200',
}

function Badge({ text, styleMap }) {
  const { t } = useLanguage()
  const classes = styleMap[text] || 'bg-gray-100 text-gray-700 border-gray-300'
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize tracking-wide ${classes}`}>
      {t(text.replace(/_/g, ' '))}
    </span>
  )
}

export function SeverityBadge({ severity }) {
  return <Badge text={severity} styleMap={SEVERITY_STYLES} />
}

export function StatusBadge({ status }) {
  return <Badge text={status} styleMap={STATUS_STYLES} />
}
