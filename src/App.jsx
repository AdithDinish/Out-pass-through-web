import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import WardenRegister from './pages/WardenRegister';
import WardenRules from './pages/WardenRules';
import ProtectedRoute from './components/ProtectedRoute';
import StudentDashboard from './pages/StudentDashboard';
import WardenDashboard from './pages/WardenDashboard';
import ApplyOutpass from './pages/ApplyOutpass';
import PassView from './pages/PassView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/warden-register" element={<WardenRegister />} />
        <Route
          path="/student"
          element={(
            <ProtectedRoute role="student">
              <StudentDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/apply"
          element={(
            <ProtectedRoute role="student">
              <ApplyOutpass />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/pass/:id"
          element={(
            <ProtectedRoute role="student">
              <PassView />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/warden"
          element={(
            <ProtectedRoute role="warden">
              <WardenDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/warden-rules"
          element={(
            <ProtectedRoute role="warden">
              <WardenRules />
            </ProtectedRoute>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
