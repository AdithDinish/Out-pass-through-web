import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function WardenDashboard() {
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [remarks, setRemarks] = useState({}); // Stores remark for each request id
  const [wardenId, setWardenId] = useState(null);
  const navigate = useNavigate();

  const formatDateTime12 = (value) => new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
  }).format(new Date(value));

  useEffect(() => {
    async function checkAuthAndFetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setWardenId(user.id);
      
      // Fetch all outpass requests for tabbed history
      const { data: outpassData, error: outpassError } = await supabase
        .from('outpass_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (outpassError) {
        console.error("Error fetching outpasses:", outpassError);
        setLoading(false);
        return;
      }

      if (!outpassData || outpassData.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      // Safely fetch corresponding student profiles
      const studentIds = [...new Set(outpassData.map(req => req.student_id))];
      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .in('id', studentIds);

      // Merge together
      const mergedRequests = outpassData.map(req => {
        const student = studentData?.find(s => s.id === req.student_id) || {};
        return { ...req, student };
      });

      setRequests(mergedRequests);
      setLoading(false);
    }
    
    checkAuthAndFetch();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleRemarkChange = (id, value) => {
    setRemarks(prev => ({ ...prev, [id]: value }));
  };

  const handleAction = async (id, action) => {
    const remark = remarks[id] || '';
    
    if (action === 'declined' && !remark.trim()) {
      alert("A remark is required when declining an outpass request.");
      return;
    }

    try {
      let { error } = await supabase
        .from('outpass_requests')
        .update({
          status: action,
          warden_remark: remark,
          warden_id: wardenId,
        })
        .eq('id', id);

      // Backward compatible for schemas that do not yet have outpass_requests.warden_id.
      if (error?.message?.includes('warden_id')) {
        const fallback = await supabase
          .from('outpass_requests')
          .update({
            status: action,
            warden_remark: remark,
          })
          .eq('id', id);

        error = fallback.error;
      }

      if (error) throw error;

      // Update request in place so it appears under the correct tab history
      setRequests(current => current.map(req => (
        req.id === id ? { ...req, status: action, warden_remark: remark } : req
      )));
      
      // Clean up remark state
      setRemarks(prev => {
        const newRemarks = { ...prev };
        delete newRemarks[id];
        return newRemarks;
      });

    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-600 font-medium">Loading...</div>
      </div>
    );
  }

  const tabConfig = [
    { key: 'pending', label: 'Pending', match: (status) => status === 'pending' },
    { key: 'approved', label: 'Approved', match: (status) => status === 'approved' },
    { key: 'declined', label: 'Declined', match: (status) => status === 'declined' || status === 'rejected' },
  ];

  const tabCounts = tabConfig.reduce((acc, tab) => {
    acc[tab.key] = requests.filter((req) => tab.match(req.status)).length;
    return acc;
  }, {});

  const visibleRequests = requests.filter((req) => {
    const tab = tabConfig.find((item) => item.key === activeTab);
    return tab ? tab.match(req.status) : false;
  });

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-12">
      {/* Top Navbar */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-indigo-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              <span className="text-xl font-bold text-white tracking-wide">
                Warden Dashboard
              </span>
            </div>
            <div className="flex items-center">
              <Link
                to="/warden-rules"
                className="text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-indigo-500/20 px-4 py-2 rounded-lg font-medium transition-all mr-3"
              >
                Auto-Approval Rules
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-red-500/20 px-4 py-2 rounded-lg font-medium transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        <div className="mb-8 border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-extrabold text-slate-900">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Requests
          </h1>
          <p className="text-slate-500 mt-1">Review and process student outpass requests.</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label} ({tabCounts[tab.key] || 0})
            </button>
          ))}
        </div>

        {visibleRequests.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center">
            <div className="bg-slate-50 p-6 rounded-full mb-4">
              <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800">No requests in this tab</h3>
            <p className="text-slate-500 mt-2">Switch tabs to view requests in other states.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visibleRequests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative group hover:shadow-md transition-shadow">
                
                {req.is_working_day && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg z-10 shadow-sm">
                    Working Day
                  </div>
                )}

                <div className="p-6 flex-grow flex flex-col">
                  {/* Student Info */}
                  <div className="flex items-start space-x-4 mb-5 border-b border-slate-100 pb-5">
                    <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 font-bold text-xl uppercase">
                      {req.student?.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">{req.student?.name || 'Unknown Student'}</h3>
                      <div className="flex flex-wrap items-center mt-1 text-sm text-slate-500 gap-x-3 gap-y-1">
                        <span className="flex items-center"><span className="font-semibold text-slate-700 mr-1">Room:</span> {req.student?.room_no || '-'}</span>
                        <span>•</span>
                        <span className="flex items-center"><span className="font-semibold text-slate-700 mr-1">Dept:</span> {req.student?.department || '-'}</span>
                        <span>•</span>
                        <span className="flex items-center"><span className="font-semibold text-slate-700 mr-1">Year:</span> {req.student?.year || '-'}</span>
                        <span>•</span>
                        <span className="flex items-center text-slate-600">
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                          {req.student?.phone || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Trip Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Destination</p>
                      <p className="font-bold text-slate-800 truncate" title={req.destination}>{req.destination}</p>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Reason</p>
                      <p className="font-medium text-slate-700 truncate" title={req.reason}>{req.reason}</p>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center justify-between text-sm bg-indigo-50/50 px-4 py-3 rounded-lg border border-indigo-100/50 mb-5">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase mb-0.5">Leaving</p>
                      <p className="font-medium text-indigo-900">{formatDateTime12(req.from_datetime)}</p>
                    </div>
                    <div className="px-2 text-indigo-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase mb-0.5">Returning</p>
                      <p className="font-medium text-indigo-900">{formatDateTime12(req.to_datetime)}</p>
                    </div>
                  </div>

                  {/* Document Link */}
                  {req.leave_doc_url && (
                    <div className="mb-4">
                      <a 
                        href={req.leave_doc_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        View Attached Leave Form
                      </a>
                    </div>
                  )}
                  
                  <div className="flex-grow"></div>
                </div>

                {/* Actions Footer */}
                {activeTab === 'pending' ? (
                  <div className="bg-slate-50 border-t border-slate-200 p-5">
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 ml-1">Warden Remark (Req. for decline)</label>
                      <input
                        type="text"
                        value={remarks[req.id] || ''}
                        onChange={(e) => handleRemarkChange(req.id, e.target.value)}
                        placeholder="Add a remark before approving or declining..."
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                      />
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleAction(req.id, 'approved')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center"
                      >
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'declined')}
                        className="flex-1 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 font-bold py-2.5 px-4 rounded-xl transition-colors border border-red-200 flex items-center justify-center"
                      >
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Decline
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border-t border-slate-200 p-5 text-sm text-slate-600">
                    {req.warden_remark ? `Remark: ${req.warden_remark}` : 'No remark added.'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
