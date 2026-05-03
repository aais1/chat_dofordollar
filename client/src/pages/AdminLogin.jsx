import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Mail, Phone, Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const { adminLogin } = useAuth();
  const navigate       = useNavigate();
  const [mode, setMode]     = useState('email'); // 'email' | 'phone'
  const [form, setForm]     = useState({ email: '', phone: '', password: '', pin: '' });
  const [showPwd, setShow]  = useState(false);
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState('');

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoad(true);
    try {
      const creds = mode === 'email'
        ? { email: form.email, password: form.password }
        : { phone: form.phone, pin: form.pin };
      await adminLogin(creds);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Admin login failed');
    } finally {
      setLoad(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: 'linear-gradient(135deg, #0B141A 0%, #128C7E 100%)' }}>
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 backdrop-blur mb-4 border-2 border-green-400/50">
            <ShieldCheck size={40} className="text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Admin Portal</h1>
          <p className="text-gray-300 mt-1">Secure administrator access</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
          {/* Mode toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 mb-6">
            {['email'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === m ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500'
                }`}>
                {m === 'email' ? 'Email + Password' : 'Phone + PIN'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'email' ? (
              <>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="admin-email" type="email" value={form.email} onChange={set('email')}
                    placeholder="admin@chatapp.com" required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400 transition" />
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="admin-password" type={showPwd ? 'text' : 'password'} value={form.password} onChange={set('password')}
                    placeholder="Password" required
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400 transition" />
                  <button type="button" onClick={() => setShow(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="admin-phone" type="tel" value={form.phone} onChange={set('phone')}
                    placeholder="+92 300 0000000" required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400 transition" />
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="admin-pin" type={showPwd ? 'text' : 'password'} value={form.pin} onChange={set('pin')}
                    placeholder="Admin PIN" maxLength={8} required
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400 transition" />
                  <button type="button" onClick={() => setShow(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </>
            )}

            <button id="admin-login-submit" type="submit" disabled={loading}
              className="w-full mt-2 py-3 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
              style={{ background: loading ? '#aaa' : 'linear-gradient(90deg, #075E54, #00A884)' }}>
              {loading ? 'Signing in...' : 'Sign In as Admin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
