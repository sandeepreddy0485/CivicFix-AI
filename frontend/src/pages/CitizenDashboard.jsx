import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

const CATEGORIES = [
  { icon: '01', name: 'Waste & sanitation', detail: 'Garbage, litter and illegal dumping', dept: 'Sanitation', image: '/images/civic-issues/sanitation.webp', color: 'bg-amber-50 text-amber-700' },
  { icon: '02', name: 'Water services', detail: 'Leaks, water supply and damaged pipes', dept: 'Water Works', image: '/images/civic-issues/water-services.webp', color: 'bg-sky-50 text-sky-700' },
  { icon: '03', name: 'Roads & footpaths', detail: 'Potholes and damaged public roads', dept: 'Roads & Infrastructure', image: '/images/civic-issues/road-damage.webp', color: 'bg-orange-50 text-orange-700' },
  { icon: '04', name: 'Street lighting', detail: 'Broken or malfunctioning streetlights', dept: 'Electrical', image: '/images/civic-issues/street-lighting.webp', color: 'bg-violet-50 text-violet-700' },
  { icon: '05', name: 'Drainage', detail: 'Blocked drains and waterlogging', dept: 'Drainage', image: '/images/civic-issues/drainage.webp', color: 'bg-teal-50 text-teal-700' },
]

const STEPS = [
  { number: '01', title: 'Share the issue', text: 'Upload a photo and mention a nearby landmark or area.' },
  { number: '02', title: 'It reaches the right team', text: 'Your report is categorised and routed to the relevant department.' },
  { number: '03', title: 'Follow updates', text: 'Check the status of your report from submission to resolution.' },
]

export default function CitizenDashboard() {
  const { user } = useAuth()
  const { t } = useLanguage()

  return (
    <>
      <section className="relative overflow-hidden bg-[#153c55] text-white">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#e77b24] via-white to-[#16834b]" />
        <div className="pointer-events-none absolute -right-36 -top-56 h-[36rem] w-[36rem] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-20 -top-40 h-[28rem] w-[28rem] rounded-full border border-white/10" />
        <div className="page-shell relative grid min-h-[510px] items-center gap-10 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-20">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-3.5 py-2 text-xs font-semibold tracking-wide text-white">
              <span className="h-2 w-2 rounded-full bg-[#f3a45f]" />
              {t('A CIVIC SERVICE FOR YOUR AREA')}
            </div>
            <h1 className="max-w-xl font-['Manrope'] text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.6rem]">
              {t('A better neighbourhood ')}<span className="text-[#b9edc3]">{t('starts with you.')}</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-emerald-50/75 sm:text-lg">
              {t('Report local civic issues to the relevant municipal or ward team. Share a photo, add a nearby landmark, and follow updates in one place.')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? '/report' : '/register'} className="inline-flex items-center gap-3 rounded-xl bg-[#e77b24] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#d56813]">
                {t('Report a civic issue')} <span aria-hidden="true">→</span>
              </Link>
              {user ? (
                <Link to="/my-complaints" className="inline-flex items-center rounded-xl border border-white/25 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">{t('Track a report')}</Link>
              ) : (
                <Link to="/login" className="inline-flex items-center rounded-xl border border-white/25 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">{t('Already registered? Sign in')}</Link>
              )}
            </div>
            <div className="mt-10 flex items-center gap-3 text-sm text-emerald-50/70">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/[0.07] text-[#b9edc3]" aria-hidden="true">✓</span>
              <span>{t('Simple, accessible reporting for residents across India.')}</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[410px]">
            <div className="absolute -inset-5 rotate-3 rounded-[2rem] bg-[#b9edc3]/10" />
            <div className="relative rounded-[1.6rem] border border-white/10 bg-[#f7faf5] p-5 text-slate-800 shadow-2xl shadow-black/25 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">{t('Example report')}</p>
                  <p className="mt-1 text-lg font-extrabold">{t('Pothole near a bus stop')}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('A preview of issue tracking')}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">{t('Example')}</span>
              </div>
              <div className="relative mt-5 flex h-48 items-end overflow-hidden rounded-xl bg-slate-200 p-4">
                <img src="/images/civic-issues/road-damage.webp" alt={t('Example of potholes on an Indian road')} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
                <span className="relative inline-flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-lg">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-orange-50 text-orange-600">!</span>
                  {t('Municipal team assigned')}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-200 pt-4">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('Department')}</p><p className="mt-1 text-xs font-bold text-slate-700">{t('Roads & works')}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('Priority')}</p><p className="mt-1 text-xs font-bold text-orange-700">{t('High priority')}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('Status')}</p><p className="mt-1 text-xs font-bold text-slate-700">{t('Updates available')}</p></div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-7 hidden items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-xl sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">✓</span>
              <span><span className="block text-xs font-bold text-slate-800">{t('Track your report')}</span><span className="mt-0.5 block text-[10px] text-slate-500">{t('From submission to resolution')}</span></span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-16 sm:py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">{t('Civic services')}</p>
            <h2 className="section-title mt-3">{t('What would you like to report?')}</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-500">{t('Choose the issue that best describes what you have noticed in your area.')}</p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORIES.map((category) => (
            <article key={category.name} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition hover:-translate-y-1 hover:border-brand-100 hover:shadow-lg hover:shadow-brand-900/5">
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                <img
                  src={category.image}
                  alt={t(category.name)}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className={`absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-xs font-extrabold shadow-sm ${category.color}`}>{category.icon}</span>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-slate-800">{t(category.name)}</h3>
                <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{t(category.detail)}</p>
                <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('Relevant department · ')}{t(category.dept)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/70">
        <div className="page-shell py-16 sm:py-20">
          <div className="mx-auto max-w-xl text-center">
            <p className="eyebrow">{t('How it works')}</p>
            <h2 className="section-title mt-3">{t('Three simple steps')}</h2>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="relative border-t-2 border-brand-100 pt-5">
                <span className="absolute -top-[17px] left-0 grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-[10px] font-extrabold text-white">{step.number}</span>
                <h3 className="mt-2 text-lg font-extrabold text-slate-800">{t(step.title)}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{t(step.text)}</p>
              </div>
            ))}
          </div>
          <div className="mt-11 text-center">
            <Link to={user ? '/report' : '/register'} className="btn-primary">{t('Make your first report')} <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#123d2a]">
        <div className="page-shell flex flex-col gap-3 py-7 text-xs text-emerald-50/65 sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-bold text-white">CivicFix AI</span> · {t('A community civic reporting platform for India.')}</p>
          <p>{t('This is an independent platform, not an official government website.')}</p>
        </div>
      </footer>
    </>
  )
}
