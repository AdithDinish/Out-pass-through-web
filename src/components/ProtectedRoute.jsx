import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';

export default function ProtectedRoute({ role, children }) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [redirectError, setRedirectError] = useState('');
  const location = useLocation();

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (!session?.user) {
        setRedirectError('Please log in to continue.');
        setAllowed(false);
        setChecking(false);
        return;
      }

      const tableName = role === 'warden' ? 'wardens' : 'students';
      const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error) {
        setRedirectError('Unable to verify your account. Please log in again.');
        setAllowed(false);
        setChecking(false);
        return;
      }

      if (!data) {
        setRedirectError(`You are signed in, but not registered as a ${role}.`);
        setAllowed(false);
        setChecking(false);
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    verifyAccess();

    return () => {
      active = false;
    };
  }, [role]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-sm border border-slate-200 text-sm font-medium">
          Checking access...
        </div>
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/" replace state={{ error: redirectError || location.state?.error }} />;
  }

  return children;
}