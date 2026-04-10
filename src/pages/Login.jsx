import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Login() {
  const [role, setRole] = useState('Student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const isStudentRole = role === 'Student';

  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
    }
  }, [location.state]);

  useEffect(() => {
    async function redirectIfLoggedIn() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setCheckingSession(false);
        return;
      }

      const userId = session.user.id;

      const { data: studentRow } = await supabase
        .from('students')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (studentRow) {
        navigate('/student', { replace: true });
        return;
      }

      const { data: wardenRow } = await supabase
        .from('wardens')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (wardenRow) {
        navigate('/warden', { replace: true });
        return;
      }

      setCheckingSession(false);
    }

    redirectIfLoggedIn();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      // If successful, navigate based on selected role
      if (role === 'Student') {
        navigate('/student');
      } else {
        navigate('/warden');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600 font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/40 p-8 sm:p-10 border border-slate-100">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
            Hostel Outpass
          </h1>
          <p className="text-slate-500 text-sm">
            Sign in to manage your leaves and permissions
          </p>
        </div>

        {/* Role Selector */}
        <div className="flex p-1.5 bg-slate-100/80 rounded-xl mb-8">
          <button
            type="button"
            onClick={() => setRole('Student')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500/50 ${
              role === 'Student' 
                ? 'bg-white text-indigo-900 shadow-sm ring-1 ring-slate-900/5' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => setRole('Warden')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500/50 ${
              role === 'Warden' 
                ? 'bg-white text-indigo-900 shadow-sm ring-1 ring-slate-900/5' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            Warden
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center border border-red-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center mt-2 relative overflow-hidden group"
          >
            <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 ease-out"></div>
            <span className="relative">
              {loading ? 'Signing in...' : 'Login'}
            </span>
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          {isStudentRole ? (
            <p className="text-slate-500 text-sm">
              New student?{' '}
              <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                Register here
              </Link>
            </p>
          ) : (
            <p className="text-slate-500 text-sm">
              Warden?{' '}
              <Link to="/warden-register" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                Register here
              </Link>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
