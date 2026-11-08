import { Routes, Route, Link } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

import CitizenDashboard from './pages/CitizenDashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import ReportIssue from './pages/ReportIssue'
import MyComplaints from './pages/MyComplaints'
import ComplaintDetails from './pages/ComplaintDetails'
import AdminDashboard from './pages/AdminDashboard'
import { useLanguage } from './context/LanguageContext'

export default function App() {
  const { t } = useLanguage()

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<CitizenDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/report"
            element={
              <ProtectedRoute>
                <ReportIssue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-complaints"
            element={
              <ProtectedRoute>
                <MyComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/complaints/:id"
            element={
              <ProtectedRoute>
                <ComplaintDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<div className="page-shell py-24 text-center"><p className="eyebrow">404 - {t('page not found')}</p><h1 className="section-title mt-3">{t("We couldn't find that page.")}</h1><p className="mt-3 text-slate-500">{t('The link may be outdated, or the page may have moved.')}</p><Link to="/" className="btn-primary mt-7">{t('Back to home')}</Link></div>} />
        </Routes>
      </main>
    </div>
  )
}
