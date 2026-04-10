import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayLabels = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

const defaultRules = {
  enabled: false,
  allowed_days: ['Saturday', 'Sunday'],
  latest_return_time: '21:00',
  block_working_day_passes: true,
  max_passes_per_week: 3,
};

export default function WardenRules() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [wardenId, setWardenId] = useState(null);
  const [rulesId, setRulesId] = useState(null);
  const [enabled, setEnabled] = useState(defaultRules.enabled);
  const [allowedDays, setAllowedDays] = useState(defaultRules.allowed_days);
  const [latestReturnTime, setLatestReturnTime] = useState(defaultRules.latest_return_time);
  const [blockWorkingDayPasses, setBlockWorkingDayPasses] = useState(defaultRules.block_working_day_passes);
  const [maxPassesPerWeek, setMaxPassesPerWeek] = useState(defaultRules.max_passes_per_week);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadRules() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate('/');
        return;
      }

      setWardenId(user.id);

      const { data, error: fetchError } = await supabase
        .from('auto_approval_rules')
        .select('*')
        .eq('warden_id', user.id)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setRulesId(data.id);
        setEnabled(Boolean(data.enabled));
        setAllowedDays(Array.isArray(data.allowed_days) && data.allowed_days.length > 0 ? data.allowed_days : defaultRules.allowed_days);
        setLatestReturnTime((data.latest_return_time || defaultRules.latest_return_time).slice(0, 5));
        setBlockWorkingDayPasses(Boolean(data.block_working_day_passes));
        setMaxPassesPerWeek(data.max_passes_per_week ?? defaultRules.max_passes_per_week);
      }

      setLoading(false);
    }

    loadRules();
  }, [navigate]);

  const toggleDay = (label) => {
    setAllowedDays((current) => {
      if (current.includes(label)) {
        return current.filter((day) => day !== label);
      }

      return [...current, label];
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);

    try {
      if (!wardenId) {
        throw new Error('Unable to identify warden account.');
      }

      const payload = {
        warden_id: wardenId,
        enabled,
        allowed_days: allowedDays,
        latest_return_time: `${latestReturnTime}:00`,
        block_working_day_passes: blockWorkingDayPasses,
        max_passes_per_week: Number(maxPassesPerWeek),
      };

      const ruleRecord = rulesId
        ? await supabase.from('auto_approval_rules').update(payload).eq('id', rulesId)
        : await supabase.from('auto_approval_rules').insert(payload);

      const { error: saveError } = ruleRecord;

      if (saveError) {
        throw saveError;
      }

      setSaved(true);
    } catch (saveError) {
      setError(saveError.message || 'Failed to save rules.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-sm border border-slate-200 text-sm font-medium">
          Loading rules...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans text-slate-900 flex justify-center">
      <div className="max-w-3xl w-full">
        <div className="mb-6">
          <Link to="/warden" className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:-translate-x-1 transition-transform">
            <svg className="mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
          <div className="h-2 w-full bg-indigo-500 absolute top-0 left-0"></div>

          <div className="px-6 py-8 border-b border-slate-100 mt-2">
            <h2 className="text-3xl font-extrabold text-slate-900">Auto-Approval Rules</h2>
            <p className="mt-2 text-sm text-slate-500">Control which outpasses can be approved automatically for your students.</p>
          </div>

          <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6">
            <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50">
              <div>
                <p className="font-semibold text-slate-900">Enable auto-approval</p>
                <p className="text-sm text-slate-500">When enabled, matching requests are approved automatically.</p>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <div>
              <div className="mb-3">
                <p className="font-semibold text-slate-900">Allowed days for auto-approval</p>
                <p className="text-sm text-slate-500">Select the departure days that can be auto-approved.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {days.map((day) => {
                  const checked = allowedDays.includes(dayLabels[day]);

                  return (
                    <label key={day} className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDay(dayLabels[day])}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700">{day}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <span className="block font-semibold text-slate-900 mb-2">Latest allowed return time</span>
                <input
                  type="time"
                  value={latestReturnTime}
                  onChange={(e) => setLatestReturnTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="block p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <span className="block font-semibold text-slate-900 mb-2">Max passes per week per student</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxPassesPerWeek}
                  onChange={(e) => setMaxPassesPerWeek(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
            </div>

            <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50">
              <div>
                <p className="font-semibold text-slate-900">Block passes that fall on working days without a leave form</p>
                <p className="text-sm text-slate-500">Require a leave form whenever the request overlaps working hours.</p>
              </div>
              <input
                type="checkbox"
                checked={blockWorkingDayPasses}
                onChange={(e) => setBlockWorkingDayPasses(e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl flex items-start border border-red-200 font-medium">
                <svg className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                <span>{error}</span>
              </div>
            )}

            {saved && !error && (
              <div className="bg-green-50 text-green-700 text-sm p-4 rounded-xl flex items-center border border-green-200 font-medium">
                <svg className="h-5 w-5 mr-3 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                Rules saved!
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden group text-lg"
            >
              <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 ease-out"></div>
              <span className="relative">{saving ? 'Saving...' : 'Save Rules'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}