import api from './api'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
const uploadOrigin = new URL(apiBaseUrl, window.location.origin).origin

export function getComplaintImageUrl(imageUrl) {
  if (!imageUrl) return ''
  if (/^(https?:|blob:|data:)/i.test(imageUrl)) return imageUrl

  const normalisedPath = imageUrl.replace(/\\/g, '/')
  const uploadsIndex = normalisedPath.lastIndexOf('/uploads/')
  if (uploadsIndex !== -1) return `${uploadOrigin}${normalisedPath.slice(uploadsIndex)}`

  const filename = normalisedPath.split('/').pop()
  return filename ? `${uploadOrigin}/uploads/${encodeURIComponent(filename)}` : ''
}

export async function submitComplaint({ description, locality, latitude, longitude, categoryHint, imageFile }) {
  const formData = new FormData()
  if (description) formData.append('description', description)
  if (locality) formData.append('locality', locality)
  if (latitude != null) formData.append('latitude', latitude)
  if (longitude != null) formData.append('longitude', longitude)
  if (categoryHint) formData.append('category_hint', categoryHint)
  formData.append('image', imageFile)

  const { data } = await api.post('/complaints', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function getMyComplaints() {
  const { data } = await api.get('/complaints/my')
  return data
}

export async function getComplaint(id) {
  const { data } = await api.get(`/complaints/${id}`)
  return data
}

export async function getAllComplaints() {
  const { data } = await api.get('/complaints')
  return data
}

export async function updateComplaintStatus(id, newStatus) {
  const { data } = await api.patch(`/complaints/${id}/status`, { new_status: newStatus })
  return data
}

export async function getNearbyComplaints({ latitude, longitude, category }) {
  const { data } = await api.get('/complaints/nearby', {
    params: { latitude, longitude, category: category || undefined },
  })
  return data
}

export async function confirmComplaint(id) {
  const { data } = await api.post(`/complaints/${id}/confirmations`)
  return data
}

export async function removeComplaintConfirmation(id) {
  const { data } = await api.delete(`/complaints/${id}/confirmations`)
  return data
}

export async function flagComplaint(id, { reason, details }) {
  const { data } = await api.post(`/complaints/${id}/flags`, { reason, details })
  return data
}

export async function getOpenComplaintFlags() {
  const { data } = await api.get('/complaints/flags')
  return data
}

export async function reviewComplaintFlag(id, { action, reviewNotes }) {
  const { data } = await api.patch(`/complaints/flags/${id}`, {
    action,
    review_notes: reviewNotes,
  })
  return data
}

export async function restoreComplaint(id, reviewNotes = '') {
  const { data } = await api.patch(`/complaints/${id}/moderation`, { review_notes: reviewNotes })
  return data
}

export async function getNotifications() {
  const { data } = await api.get('/notifications')
  return data
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`)
  return data
}

export async function markAllNotificationsRead() {
  await api.post('/notifications/read-all')
}

export async function overrideSeverity(id, severity) {
  const { data } = await api.patch(`/complaints/${id}/severity`, { severity })
  return data
}

export async function uploadResolutionImage(id, imageFile) {
  const formData = new FormData()
  formData.append('image', imageFile)
  const { data } = await api.post(`/complaints/${id}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function getDashboard() {
  const { data } = await api.get('/admin/dashboard')
  return data
}

export async function getDepartments() {
  const { data } = await api.get('/departments')
  return data
}
