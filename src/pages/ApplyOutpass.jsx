import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function ApplyOutpass() {
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [fromHour, setFromHour] = useState('09');
  const [fromMinute, setFromMinute] = useState('00');
  const [fromPeriod, setFromPeriod] = useState('AM');
  const [toDate, setToDate] = useState('');
  const [toHour, setToHour] = useState('09');
  const [toMinute, setToMinute] = useState('00');
  const [toPeriod, setToPeriod] = useState('PM');
  const [isWorkingDay, setIsWorkingDay] = useState(false);
  const [leaveDoc, setLeaveDoc] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
      } else {
        navigate('/');
      }
    });
  }, [navigate]);

  const generatePassCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'OUT-';
    for (let i = 0; i < 4; i += 1) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

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

  const getDayName = (value) => new Date(value).toLocaleDateString('en-US', { weekday: 'long' });

  const getMinutesFromTime = (value) => {
    const [hours, minutes] = value.split(':').map(Number);
    return (hours * 60) + minutes;
  };

  const composeDateTime = (date, hour, minute, period) => {
    const parsedHour = Number(hour);
    let hour24 = parsedHour;

    if (period === 'AM') {
      hour24 = parsedHour === 12 ? 0 : parsedHour;
    } else {
      hour24 = parsedHour === 12 ? 12 : parsedHour + 12;
    }

    const hh = String(hour24).padStart(2, '0');
    return `${date}T${hh}:${minute}:00`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const fromDatetime = composeDateTime(fromDate, fromHour, fromMinute, fromPeriod);
    const toDatetime = composeDateTime(toDate, toHour, toMinute, toPeriod);

    if (!destination || !reason || !fromDate || !toDate) {
      setError('Please fill all mandatory fields (Destination, Reason, Dates).');
      return;
    }

    if (new Date(fromDatetime) >= new Date(toDatetime)) {
      setError('Return date and time must be later than departure date and time.');
      return;
    }

    if (isWorkingDay && !leaveDoc) {
      setError('Please upload the leave form since it is during college working hours.');
      return;
    }

    setLoading(true);

    try {
      let docUrl = null;

      if (isWorkingDay && leaveDoc) {
        const fileExt = leaveDoc.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('leave-docs')
          .upload(fileName, leaveDoc, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error('Failed to upload document: ' + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from('leave-docs')
          .getPublicUrl(fileName);

        docUrl = publicUrlData.publicUrl;
      }

      const passCode = generatePassCode();

      const { data: insertedRequest, error: insertError } = await supabase
        .from('outpass_requests')
        .insert({
          student_id: userId,
          destination,
          reason,
          from_datetime: fromDatetime,
          to_datetime: toDatetime,
          is_working_day: isWorkingDay,
          leave_doc_url: docUrl,
          pass_code: passCode,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) {
        throw new Error('Database Error: ' + insertError.message);
      }

      const { data: rulesData, error: rulesError } = await supabase
        .from('auto_approval_rules')
        .select('*')
        .eq('enabled', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (rulesError) {
        throw new Error('Failed to load auto-approval rules: ' + rulesError.message);
      }

      const autoRules = rulesData?.[0] || null;

      if (autoRules && insertedRequest?.id) {
        const departureDay = getDayName(fromDatetime);
        const latestReturnMinutes = getMinutesFromTime((autoRules.latest_return_time || '21:00:00').slice(0, 5));
        const returnTime = new Date(toDatetime);
        const returnMinutes = (returnTime.getHours() * 60) + returnTime.getMinutes();
        const { start: weekStart, end: weekEnd } = getWeekRange(new Date());

        const { count: approvedCount, error: countError } = await supabase
          .from('outpass_requests')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', userId)
          .eq('status', 'approved')
          .gte('from_datetime', weekStart.toISOString())
          .lt('from_datetime', weekEnd.toISOString());

        if (countError) {
          throw new Error('Failed to check weekly pass count: ' + countError.message);
        }

        const allowedDays = autoRules.allowed_days || [];
        const weeklyLimit = autoRules.max_passes_per_week ?? 3;
        const fitsRules =
          allowedDays.includes(departureDay) &&
          returnMinutes <= latestReturnMinutes &&
          (!autoRules.block_working_day_passes || !isWorkingDay || Boolean(docUrl)) &&
          (approvedCount ?? 0) < weeklyLimit;

        if (fitsRules) {
          const { error: updateError } = await supabase
            .from('outpass_requests')
            .update({ status: 'approved' })
            .eq('id', insertedRequest.id);

          if (updateError) {
            throw new Error('Failed to finalize approval: ' + updateError.message);
          }
        }
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/student');
      }, 2000);
    } catch (submitError) {
      setError(submitError.message || 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans text-slate-900 flex justify-center">
      <div className="max-w-2xl w-full">
        <div className="mb-6">
          <Link to="/student" className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:-translate-x-1 transition-transform">
            <svg className="mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
          <div className="h-2 w-full bg-indigo-500 absolute top-0 left-0"></div>

          <div className="px-6 py-8 border-b border-slate-100 mt-2">
            <h2 className="text-3xl font-extrabold text-slate-900">Apply for Outpass</h2>
            <p className="mt-2 text-sm text-slate-500">Fill in the details below to request a new outpass. All requests must be approved by the warden.</p>
          </div>

          <div className="p-6 sm:p-8 bg-slate-50/50">
            {success ? (
              <div className="bg-green-50 text-green-700 p-8 rounded-2xl flex flex-col items-center justify-center text-center border border-green-200 shadow-sm animate-pulse">
                <div className="rounded-full bg-green-100 p-4 mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Request Submitted!</h3>
                <p className="text-green-600 font-medium">Redirecting to your dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Destination</label>
                      <input
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="Where are you going?"
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Reason</label>
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Family function, Medical, etc."
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">From Date & Time</label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        <input
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="col-span-3 sm:col-span-2 px-3 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-700 font-medium"
                        />
                        <select
                          value={fromHour}
                          onChange={(e) => setFromHour(e.target.value)}
                          className="px-3 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-700"
                        >
                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((hour) => (
                            <option key={hour} value={hour}>{hour}</option>
                          ))}
                        </select>
                        <select
                          value={fromMinute}
                          onChange={(e) => setFromMinute(e.target.value)}
                          className="px-3 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-700"
                        >
                          {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((minute) => (
                            <option key={minute} value={minute}>{minute}</option>
                          ))}
                        </select>
                        <select
                          value={fromPeriod}
                          onChange={(e) => setFromPeriod(e.target.value)}
                          className="px-3 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-700"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">To Date & Time</label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        <input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="col-span-3 sm:col-span-2 px-3 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-700 font-medium"
                        />
                        <select
                          value={toHour}
                          onChange={(e) => setToHour(e.target.value)}
                          className="px-3 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-700"
                        >
                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((hour) => (
                            <option key={hour} value={hour}>{hour}</option>
                          ))}
                        </select>
                        <select
                          value={toMinute}
                          onChange={(e) => setToMinute(e.target.value)}
                          className="px-3 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-700"
                        >
                          {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((minute) => (
                            <option key={minute} value={minute}>{minute}</option>
                          ))}
                        </select>
                        <select
                          value={toPeriod}
                          onChange={(e) => setToPeriod(e.target.value)}
                          className="px-3 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-700"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className={`p-5 rounded-2xl border transition-colors duration-200 ${isWorkingDay ? 'bg-white border-indigo-200 shadow-sm' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex items-start">
                      <div className="flex items-center h-5 mt-0.5">
                        <input
                          id="working_day"
                          type="checkbox"
                          checked={isWorkingDay}
                          onChange={(e) => setIsWorkingDay(e.target.checked)}
                          className="w-5 h-5 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="working_day" className="font-semibold text-slate-800 cursor-pointer">
                          Is this during college working hours?
                        </label>
                        <p className="text-slate-500 mt-1">If yes, you must upload an approved leave form.</p>
                      </div>
                    </div>

                    {isWorkingDay && (
                      <div className="mt-5 pt-5 border-t border-slate-100">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                          Upload leave form <span className="font-normal text-slate-500">(Photo or PDF)</span>
                        </label>
                        <div className="flex items-center justify-center w-full">
                          <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-indigo-200 border-dashed rounded-xl cursor-pointer bg-indigo-50/30 hover:bg-indigo-50 transition-colors">
                            <div className="flex flex-col items-center justify-center text-center p-4">
                              {leaveDoc ? (
                                <>
                                  <svg className="w-10 h-10 text-indigo-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  <p className="text-sm font-semibold text-indigo-900 truncate max-w-[250px]">{leaveDoc.name}</p>
                                  <p className="text-xs text-indigo-500 mt-1 font-medium">Click to change file</p>
                                </>
                              ) : (
                                <>
                                  <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                                    <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                  </div>
                                  <p className="text-sm text-slate-600"><span className="font-bold text-indigo-600">Click to upload</span> or drag and drop</p>
                                  <p className="text-xs text-slate-400 mt-1">PNG, JPG or PDF (MAX. 10MB)</p>
                                </>
                              )}
                            </div>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,.pdf"
                              onChange={(e) => setLeaveDoc(e.target.files[0])}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl flex items-start border border-red-200 font-medium">
                    <svg className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden group text-lg mt-4"
                >
                  <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 ease-out"></div>
                  <span className="relative flex items-center">
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </>
                    ) : 'Submit Request'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
