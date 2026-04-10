import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function StudentDashboard() {
  const [student, setStudent] = useState(null);
  const [outpasses, setOutpasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const getWeekRange = (date = new Date()) => {
    const current = new Date(date);
    const day = current.getDay();
    const daysFromMonday = (day + 6) % 7;
    const start = new Date(current);
    start.setDate(current.getDate() - daysFromMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  };

  const formatDateTime12 = (value) => new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
  }).format(new Date(value));

  const sortedOutpasses = [...outpasses].sort(
    (a, b) => new Date(b.created_at || b.from_datetime).getTime() - new Date(a.created_at || a.from_datetime).getTime(),
  );

  const { start: weekStart, end: weekEnd } = getWeekRange();
  const weeklyPasses = outpasses.filter((pass) => {
    const passDate = new Date(pass.from_datetime);
    return passDate >= weekStart && passDate < weekEnd;
  });
  const weeklyTotal = weeklyPasses.length;
  const pendingCount = outpasses.filter((pass) => pass.status === 'pending').length;
  const approvedCount = outpasses.filter((pass) => pass.status === 'approved').length;

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      // Fetch student data
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (data) {
        setStudent(data);
      }

      // Fetch outpasses
      const { data: outpassData } = await supabase
        .from('outpass_requests')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
        
      if (outpassData) {
        setOutpasses(outpassData);
      }

      setLoading(false);
    }
    fetchUser();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600 font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#175DAA] to-[#F3772A]">
                Hostel Outpass
              </span>
            </div>
            <div className="flex items-center space-x-6">
              <span className="text-sm font-medium text-slate-600 hidden sm:block bg-slate-100 px-3 py-1.5 rounded-full">
                Welcome, {student?.name || 'Student'}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-500 hover:text-red-600 font-medium transition-colors"
                title="Logout"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8 mb-8 flex flex-col sm:flex-row items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
          <div className="mb-6 sm:mb-0 text-center sm:text-left z-10">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome, {student?.name || 'Student'}</h1>
            <p className="text-slate-500">Manage your outpass requests and view history</p>
          </div>
          <Link
            to="/apply"
            className="z-10 inline-flex items-center justify-center px-7 py-4 border border-transparent text-base font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 w-full sm:w-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Apply for Outpass
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Passes This Week</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">{weeklyTotal}</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200 p-4">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-extrabold text-amber-700 mt-2">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-2xl border border-green-200 p-4">
            <p className="text-xs font-bold text-green-500 uppercase tracking-wider">Approved</p>
            <p className="text-2xl font-extrabold text-green-700 mt-2">{approvedCount}</p>
          </div>
        </div>

        {/* My Passes Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">My Passes</h3>
          </div>
          
          {outpasses.length === 0 ? (
            <div className="p-6 text-center text-slate-500 py-20">
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                 <svg className="h-10 w-10 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
              </div>
              <p className="text-lg font-medium text-slate-900">No outpasses yet</p>
              <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">You haven't requested any outpasses. When you do, they will show up here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedOutpasses.map((pass) => (
                <div key={pass.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                    <h4 className="text-lg font-bold text-slate-900">{pass.destination}</h4>
                    <p className="text-sm text-slate-500 mt-1 font-medium">{pass.reason}</p>
                    <div className="flex flex-wrap items-center mt-3 gap-3 text-xs text-slate-500 font-medium">
                      <div className="flex items-center bg-slate-100 px-2.5 py-1 rounded-md">
                        <svg className="w-3.5 h-3.5 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        {formatDateTime12(pass.from_datetime)}
                      </div>
                      <span className="text-slate-300">to</span>
                      <div className="flex items-center bg-slate-100 px-2.5 py-1 rounded-md">
                        <svg className="w-3.5 h-3.5 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        {formatDateTime12(pass.to_datetime)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
                    <span className={`px-4 py-1.5 text-xs font-bold rounded-full w-fit flex items-center ${
                      pass.status === 'approved' ? 'bg-green-100 text-green-700 border border-green-200' :
                      (pass.status === 'declined' || pass.status === 'rejected') ? 'bg-red-100 text-red-700 border border-red-200' :
                      'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                      {pass.status === 'approved' && <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
                      {(pass.status === 'declined' || pass.status === 'rejected') && <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>}
                      {pass.status ? pass.status.toUpperCase() : 'PENDING'}
                    </span>
                    
                    {/* View Pass Button */}
                    {pass.status === 'approved' && (
                      <Link 
                        to={`/pass/${pass.id}`}
                        className="flex items-center text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors border border-indigo-100"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        View Pass
                      </Link>
                    )}

                    {/* Pending Pass code */}
                    {pass.status !== 'approved' && pass.pass_code && (
                      <div className="flex items-center mt-1 sm:mt-0 font-mono text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200" title="Pass Code">
                        {pass.pass_code}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Reason / Remarks Section for Rejected passes attached to bottom of card */}
                {(pass.status === 'declined' || pass.status === 'rejected') && pass.warden_remark && (
                  <div className="px-6 pb-6 pt-0 bg-white">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start">
                      <svg className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <div>
                        <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-0.5">Warden's Remark</p>
                        <p className="text-sm text-red-700 font-medium">{pass.warden_remark}</p>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
