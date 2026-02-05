import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, isAuthenticated } from '../services/auth';
import { Mail, Lock, Building2, Loader2, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';

const TenantLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      const userStr = localStorage.getItem('user_data');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (!user.is_staff && !user.is_superuser) {
            navigate('/', { replace: true });
          }
        } catch {
          // ignore
        }
      }
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await login(email, password);
      if (response.user?.is_staff || response.user?.is_superuser) {
        setError('Access denied. Use the admin login for staff accounts.');
        return;
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-900 text-white relative overflow-hidden flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] opacity-20 bg-cover bg-center" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 via-blue-900/80 to-indigo-900/80" aria-hidden />
      <div className="relative z-10 w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-white/90 hover:text-white font-medium mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-indigo-500/10 border border-slate-200/60 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-50 via-indigo-100 to-blue-50 text-indigo-600 shadow-lg shadow-indigo-500/20">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
                  Tenant Portal Login
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
                  Access Your Dashboard
                </p>
              </div>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
                <span className="font-semibold">{error}</span>
              </div>
            )}
            <div className="space-y-3">
              <label htmlFor="tenant-email" className="block text-sm font-bold text-slate-700">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  id="tenant-email"
                  type="email"
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white text-slate-900 placeholder-slate-400"
                  placeholder="tenant@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="space-y-3">
              <label htmlFor="tenant-password" className="block text-sm font-bold text-slate-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  id="tenant-password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-12 pr-12 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white text-slate-900 placeholder-slate-400"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white font-bold rounded-xl hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex justify-center items-center gap-2 focus:outline-none focus:ring-4 focus:ring-indigo-500/30"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In to Dashboard'
                )}
              </button>
            </div>
            <p className="text-center text-sm text-slate-600 pt-4 border-t border-slate-100">
              Don't have an account?{' '}
              <Link to="/" className="text-indigo-600 font-bold hover:text-indigo-800 hover:underline">
                Apply for a property →
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TenantLoginPage;
