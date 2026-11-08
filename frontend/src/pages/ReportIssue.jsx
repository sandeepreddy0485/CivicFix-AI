import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { confirmComplaint, flagComplaint, getNearbyComplaints, submitComplaint } from '../services/complaintService'
import { useLanguage } from '../context/LanguageContext'

const CATEGORY_HINTS = [
  { value: '', label: "Let AI decide (recommended)" },
  { value: 'garbage', label: 'Garbage accumulation' },
  { value: 'water_leakage', label: 'Water leakage' },
  { value: 'road_damage', label: 'Road damage / pothole' },
  { value: 'streetlight', label: 'Broken streetlight' },
  { value: 'drainage_blockage', label: 'Drainage blockage' },
]

const INDIA_CENTER = [22.5, 79]
const locationIcon = L.divIcon({
  className: 'civic-map-marker',
  html: '<span><i></i></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    },
  })
  return null
}

function MapRecenter({ coords }) {
  const map = useMap()

  useEffect(() => {
    if (coords) map.setView([coords.latitude, coords.longitude], 15)
  }, [coords, map])

  return null
}

export default function ReportIssue() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [description, setDescription] = useState('')
  const [locality, setLocality] = useState('')
  const [categoryHint, setCategoryHint] = useState('')
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [nearbyReports, setNearbyReports] = useState([])
  const [hasSearchedNearby, setHasSearchedNearby] = useState(false)
  const [checkingNearby, setCheckingNearby] = useState(false)
  const [nearbyError, setNearbyError] = useState('')
  const [confirmingId, setConfirmingId] = useState(null)
  const [flaggingId, setFlaggingId] = useState(null)
  const [submittingFlagId, setSubmittingFlagId] = useState(null)
  const [flaggedIds, setFlaggedIds] = useState([])
  const [flagReason, setFlagReason] = useState('spam')
  const [flagDetails, setFlagDetails] = useState('')
  const [error, setError] = useState('')

  function updateLocation(nextCoords) {
    setCoords(nextCoords)
    setNearbyReports([])
    setHasSearchedNearby(false)
    setNearbyError('')
  }

  function handleCategoryChange(value) {
    setCategoryHint(value)
    setNearbyReports([])
    setHasSearchedNearby(false)
    setNearbyError('')
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setLocationError(t('Geolocation is not supported by this browser.'))
      return
    }
    setLocating(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocating(false)
      },
      (err) => {
        setLocationError(t('Could not get your location: ') + err.message)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function checkNearbyReports() {
    if (!coords) {
      setNearbyError(t('Select a location on the map first.'))
      return
    }

    setCheckingNearby(true)
    setNearbyError('')
    setHasSearchedNearby(false)
    try {
      const reports = await getNearbyComplaints({
        ...coords,
        category: categoryHint,
      })
      setNearbyReports(reports)
      setHasSearchedNearby(true)
    } catch (requestError) {
      setNearbyError(requestError.response?.data?.detail || t('Could not search nearby reports. Please try again.'))
    } finally {
      setCheckingNearby(false)
    }
  }

  async function confirmNearbyReport(reportId) {
    setConfirmingId(reportId)
    setNearbyError('')
    try {
      const result = await confirmComplaint(reportId)
      setNearbyReports((reports) => reports.map((report) => (
        report.id === reportId
          ? { ...report, ...result }
          : report
      )))
    } catch (requestError) {
      setNearbyError(requestError.response?.data?.detail || t('Could not confirm this report. Please try again.'))
    } finally {
      setConfirmingId(null)
    }
  }

  async function submitReportFlag(reportId) {
    setSubmittingFlagId(reportId)
    setNearbyError('')
    try {
      await flagComplaint(reportId, { reason: flagReason, details: flagDetails })
      setFlaggedIds((ids) => [...ids, reportId])
      setFlaggingId(null)
      setFlagDetails('')
    } catch (requestError) {
      setNearbyError(requestError.response?.data?.detail || t('Could not submit this report flag. Please try again.'))
    } finally {
      setSubmittingFlagId(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!imageFile) {
      setError(t('Please attach a photo of the issue.'))
      return
    }

    setSubmitting(true)
    try {
      const complaint = await submitComplaint({
        description,
        locality,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        categoryHint: categoryHint || undefined,
        imageFile,
      })
      navigate(`/complaints/${complaint.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || t('Could not submit complaint. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-shell max-w-3xl py-10 sm:py-14">
      <div className="mb-7">
        <p className="eyebrow">{t('Citizen services · Civic reporting')}</p>
        <h1 className="mt-2 font-['Manrope'] text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t('Report an issue in your area')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          {t('Share a photo and a few details. We’ll categorise your report and route it to the relevant municipal department.')}
        </p>
      </div>

      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="surface-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-7">
          <p className="text-sm font-bold text-slate-800">{t('Issue details')}</p>
          <p className="mt-1 text-xs text-slate-500">{t('Fields marked optional can be skipped. Please do not include personal or sensitive information.')}</p>
        </div>
        <div className="space-y-6 p-5 sm:p-7">
          <div>
            <label htmlFor="issue-photo" className="field-label">{t('Photo of the issue ')}<span className="text-red-500">*</span></label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group flex min-h-48 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-5 text-center transition hover:border-brand-400 hover:bg-brand-50/40 focus:outline-none focus:ring-4 focus:ring-brand-100"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Selected issue preview" className="max-h-64 rounded-xl object-contain" />
              ) : (
                <>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-xl text-brand-600 shadow-sm">↑</span>
                  <span className="mt-4 text-sm font-bold text-slate-700">{t('Choose a photo to upload')}</span>
                  <span className="mt-1 text-xs text-slate-400">{t('JPEG, PNG or WebP · Max 8 MB')}</span>
                </>
              )}
            </button>
            <input id="issue-photo" ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="sr-only" />
            {imageFile && <p className="mt-2 text-xs font-medium text-brand-700">{imageFile.name}</p>}
          </div>

          <div>
            <label htmlFor="issue-description" className="field-label">{t('Describe the issue ')}<span className="font-normal text-slate-400">{t('(optional)')}</span></label>
            <textarea id="issue-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="field-control resize-y" placeholder={t('Mention a nearby landmark, ward or locality, when you noticed it, and how it affects the area...')} />
          </div>

          <div>
            <label htmlFor="issue-category" className="field-label">{t('Issue category')}</label>
            <select id="issue-category" value={categoryHint} onChange={(e) => handleCategoryChange(e.target.value)} className="field-control">
              {CATEGORY_HINTS.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-400">{t('Choose a category if you know it; otherwise, the system will suggest one from your photo.')}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <label className="field-label">{t('Location')} <span className="font-normal text-slate-400">{t('(optional)')}</span></label>
            <p className="mb-4 text-xs leading-5 text-slate-500">{t('Share your current location to help the municipal team locate the issue. You can also add a landmark or ward in the description.')}</p>
            <label htmlFor="issue-locality" className="field-label">{t('Ward / locality / landmark')}</label>
            <input id="issue-locality" value={locality} onChange={(event) => setLocality(event.target.value)} maxLength={160} className="field-control mb-4" placeholder={t('Example: Ward 12, Indiranagar')} />
            <p className="mb-2 text-xs font-semibold text-slate-600">{t('Tap the map to place a pin')}</p>
            <div role="region" aria-label={t('Map to select the issue location')}>
              <MapContainer
                center={coords ? [coords.latitude, coords.longitude] : INDIA_CENTER}
                zoom={coords ? 15 : 4}
                scrollWheelZoom={false}
                className="civic-location-map mb-4 h-64 w-full overflow-hidden rounded-xl border border-slate-200"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onSelect={updateLocation} />
                <MapRecenter coords={coords} />
                {coords && <Marker position={[coords.latitude, coords.longitude]} icon={locationIcon} />}
              </MapContainer>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={captureLocation} disabled={locating} className="btn-secondary !py-2.5">
                <span aria-hidden="true">⌖</span> {t(locating ? 'Getting location…' : coords ? 'Update my location' : 'Use my current location')}
              </button>
              {coords && <span className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-600">{coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</span>}
            </div>
            {locationError && <p role="alert" className="mt-3 text-xs text-red-600">{locationError}</p>}
            <div className="mt-5 border-t border-slate-200 pt-4">
              <button type="button" onClick={checkNearbyReports} disabled={!coords || checkingNearby} className="btn-secondary !py-2.5">
                {t(checkingNearby ? 'Searching nearby reports…' : 'Check for nearby reports')}
              </button>
              <p className="mt-2 text-xs leading-5 text-slate-500">{t('We’ll look for open reports within 500 metres. You can confirm a matching issue or continue with a new report.')}</p>
              {nearbyError && <p role="alert" className="mt-2 text-xs text-red-600">{nearbyError}</p>}
              {nearbyReports.length > 0 && (
                <ul className="mt-3 space-y-3">
                  {nearbyReports.map((report) => (
                    <li key={report.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{t('Report')} #{report.id} · {t(report.category.replace(/_/g, ' '))}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {report.locality ? `${report.locality} · ` : ''}{report.distance_meters} {t('m away')} · {t(report.status.replace(/_/g, ' '))}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{report.confirmation_count} {t('community confirmations')}</p>
                        </div>
                        <button
                          type="button"
                          disabled={report.confirmed_by_user || confirmingId === report.id}
                          onClick={() => confirmNearbyReport(report.id)}
                          className="btn-secondary !px-3 !py-2 text-xs"
                        >
                          {t(report.confirmed_by_user ? 'You confirmed this issue' : confirmingId === report.id ? 'Confirming…' : 'Confirm same issue')}
                        </button>
                      </div>
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        {flaggedIds.includes(report.id) ? (
                          <p role="status" className="text-xs font-semibold text-emerald-700">{t('Flag sent for administrator review.')}</p>
                        ) : flaggingId === report.id ? (
                          <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                            <select aria-label={t('Flag reason')} value={flagReason} onChange={(event) => setFlagReason(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                              {['spam', 'inappropriate', 'false_information', 'duplicate', 'other'].map((reason) => <option key={reason} value={reason}>{t(reason.replace(/_/g, ' '))}</option>)}
                            </select>
                            <input aria-label={t('Optional details')} maxLength={500} value={flagDetails} onChange={(event) => setFlagDetails(event.target.value)} placeholder={t('Optional details')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                            <button type="button" disabled={submittingFlagId === report.id} onClick={() => submitReportFlag(report.id)} className="btn-secondary !py-2 text-xs">{t(submittingFlagId === report.id ? 'Submitting…' : 'Send flag')}</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setFlaggingId(report.id)} className="text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-red-700">{t('Report inappropriate content')}</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {hasSearchedNearby && nearbyReports.length === 0 && !checkingNearby && !nearbyError && (
                <p className="mt-3 text-xs text-slate-500">{t('No matching open reports found nearby.')}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-400">{t('Your report will be routed to the relevant department.')}</p>
            <button type="submit" disabled={submitting} className="btn-primary shrink-0">
              {t(submitting ? 'Submitting & analyzing…' : 'Submit report')} <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
