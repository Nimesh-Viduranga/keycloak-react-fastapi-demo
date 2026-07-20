import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Callback from './pages/Callback'
import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-shell">
          <header className="topbar">
            <a href="/" className="brand">
              Keycloak SPA Demo
            </a>
            <nav>
              <a href="/">Home</a>
              <a href="/dashboard">Dashboard</a>
            </nav>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/callback" element={<Callback />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
