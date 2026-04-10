import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { supabase } from '../supabase';

export default function PassView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [passData, setPassData] = useState(null);
  const [student, setStudent] = useState(null);
  const [wardenName, setWardenName] = useState('Warden');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const formatDateTime12 = (value) => new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
  }).format(new Date(value));

  useEffect(() => {
    async function loadPass() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
        return;
      }

      const { data: request, error: requestError } = await supabase
        .from('outpass_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (requestError || !request) {
        setError(requestError?.message || 'Pass not found.');
        setLoading(false);
        return;
      }

      setPassData(request);

      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .eq('id', request.student_id)
        .single();

      setStudent(studentData || null);

      if (request.warden_id) {
        const { data: wardenData } = await supabase
          .from('wardens')
          .select('name')
          .eq('id', request.warden_id)
          .single();

        setWardenName(wardenData?.name || 'Warden');
      }

      setLoading(false);
    }

    loadPass();
  }, [id, navigate]);

  const downloadPass = async () => {
    const passElement = document.getElementById('pass-card');
    if (!passElement) return;

    const canvas = await html2canvas(passElement, {
      scale: 3,
      backgroundColor: '#f8fafc',
      useCORS: true,
    });

    const link = document.createElement('a');
    link.download = `outpass-${passData?.pass_code || id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-600 font-medium">Loading pass...</div>
      </div>
    );
  }

  if (error || !passData || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 max-w-md w-full text-center">
          <p className="text-lg font-bold text-slate-900 mb-2">Unable to load pass</p>
          <p className="text-sm text-slate-600 mb-5">{error || 'The pass details are missing.'}</p>
          <Link to="/student" className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isApproved = passData.status === 'approved';

  return (
    <div className="pass-page min-h-screen bg-slate-100 py-8 px-4 sm:px-6 flex flex-col items-center justify-center font-sans">
      <div className="print-hidden w-full max-w-sm mb-6 flex justify-between items-center">
        <Link to="/student" className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
          <svg className="mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Dashboard
        </Link>
      </div>

      <div id="pass-card" className="pass-card w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative">
        <div className={`h-3 w-full absolute top-0 left-0 ${isApproved ? 'bg-green-500' : 'bg-amber-500'}`}></div>

        <div className="pass-header px-5 pt-6 pb-3 text-center border-b border-slate-100 border-dashed">
          <div className="mx-auto w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-2.5 shadow-lg shadow-slate-900/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          </div>
          <h1 className="text-lg font-black tracking-widest text-slate-900 uppercase">Hostel Outpass</h1>
          <p className="text-slate-400 font-medium text-xs mt-1">OFFICIAL DOCUMENT</p>
        </div>

        <div className="pass-section p-4 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Student Name</p>
              <p className="text-base font-bold text-slate-900">{student.name}</p>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Room No</p>
              <p className="text-sm font-bold text-slate-800">{student.room_no || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Department</p>
              <p className="text-sm font-bold text-slate-800">{student.department || '-'}</p>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Year of Study</p>
              <p className="text-sm font-medium text-slate-800">{student.year || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</p>
              <p className="text-sm font-medium text-slate-800">{student.phone || '-'}</p>
            </div>
          </div>
        </div>

        <div className="pass-section p-4 border-t border-slate-100 border-dashed">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Destination</p>
              <p className="text-base font-bold text-indigo-900">{passData.destination}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Reason</p>
              <p className="text-sm font-medium text-slate-700">{passData.reason}</p>
            </div>
            <div className="bg-slate-100/80 p-2.5 rounded-2xl flex flex-col items-center justify-center space-y-0.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Valid From</p>
              <p className="font-bold text-slate-800 text-sm text-center">{formatDateTime12(passData.from_datetime)}</p>
            </div>
            <div className="bg-slate-100/80 p-2.5 rounded-2xl flex flex-col items-center justify-center space-y-0.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Valid Until</p>
              <p className="font-bold text-slate-800 text-sm text-center">{formatDateTime12(passData.to_datetime)}</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center pt-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Pass Code</p>
            <div className="bg-slate-900 px-4 py-2.5 rounded-xl shadow-inner mb-3 w-full text-center">
              <p className="text-xl font-mono font-bold tracking-widest text-white">{passData.pass_code}</p>
            </div>

            {isApproved ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold uppercase tracking-wider mb-2 border border-green-200 text-xs">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Approved
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">By {wardenName}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center bg-amber-100 text-amber-700 px-4 py-2 rounded-full font-bold uppercase tracking-wider border border-amber-200 text-xs">
                  Pending Approval
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="print-hidden mt-8 text-center flex flex-col items-center gap-4">
        <button
          onClick={downloadPass}
          className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:-translate-y-0.5"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          Download Pass as Image
        </button>

        <button
          onClick={() => window.print()}
          className="text-slate-500 font-medium hover:text-indigo-600 transition-colors text-sm underline underline-offset-4"
        >
          Or save as PDF (Print)
        </button>
      </div>
    </div>
  );
}
