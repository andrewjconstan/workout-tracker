import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Login from './pages/Login'
import Home from './pages/Home'
import Log from './pages/Log'
import HistoryIndex from './pages/HistoryIndex'
import RoutineHistory from './pages/RoutineHistory'
import WorkoutDetail from './pages/WorkoutDetail'
import Exercises from './pages/Exercises'
import ExerciseDetail from './pages/ExerciseDetail'
import Plan from './pages/Plan'
import Settings from './pages/Settings'

export default function App() {
  const { session, loading } = useAuth()
  const { pathname } = useLocation()

  if (loading) return <div className="center muted">Loading…</div>
  if (!session) return <Login />

  const logging = pathname.startsWith('/log/')

  return (
    <div className="app">
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/log/:workoutId" element={<Log />} />
          <Route path="/history" element={<HistoryIndex />} />
          <Route path="/history/:routineId" element={<RoutineHistory />} />
          <Route path="/workout/:workoutId" element={<WorkoutDetail />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercises/:exerciseId" element={<ExerciseDetail />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      {!logging && (
        <nav className="tabbar">
          <NavLink to="/" end>Today</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/exercises">Exercises</NavLink>
          <NavLink to="/plan">Plan</NavLink>
          <NavLink to="/settings">More</NavLink>
        </nav>
      )}
    </div>
  )
}
