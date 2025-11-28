import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

interface PasswordResetProps {
  uidb64: string;
  token: string;
  onSuccess?: () => void;
}

const PasswordReset: React.FC<PasswordResetProps> = ({ uidb64, token, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Verify token on mount
    const verifyToken = async () => {
      try {
        const BASE_URL = import.meta.env.VITE_API_URL || 'https://neela-backend.onrender.com';
        const response = await fetch(`${BASE_URL}/accounts/verify-reset-token/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uidb64, token }),
        });

        if (response.ok) {
          const data = await response.json();
          setIsValid(true);
          setUserEmail(data.email || '');
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Invalid or expired token' }));
          console.error('Token verification error:', errorData);
          setError(errorData.error || errorData.detail || 'Invalid or expired token');
          setIsValid(false);
        }
      } catch (error) {
        console.error('Token verification exception:', error);
        setError('Failed to verify token. Please try again.');
        setIsValid(false);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [uidb64, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const BASE_URL = import.meta.env.VITE_API_URL || 'https://neela-backend.onrender.com';
      const response = await fetch(`${BASE_URL}/accounts/reset-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uidb64,
          token,
          new_password: password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // If tokens are returned, store them for automatic login
        if (data.access && data.refresh && data.user) {
          // Store tokens and user data
          localStorage.setItem('access_token', data.access);
          localStorage.setItem('refresh_token', data.refresh);
          localStorage.setItem('user_data', JSON.stringify(data.user));
        }
        
        setSuccess(true);
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            window.location.href = '/';
          }
        }, 2000);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to reset password' }));
        console.error('Password reset error:', errorData);
        const errorMessage = errorData.error || errorData.detail || errorData.details?.[0] || 'Failed to reset password';
        setError(Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage);
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Verifying reset token...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Invalid or Expired Link</h1>
            <p className="text-slate-600">{error || 'This password reset link is invalid or has expired.'}</p>
          </div>
          <a
            href="/"
            className="block w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 text-center"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Password Reset Successful!</h1>
          <p className="text-slate-600 mb-6">Your password has been updated. Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Set Your Password</h1>
          <p className="text-slate-600">Enter a new password for {userEmail}</p>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Enter new password"
              required
              minLength={8}
            />
            <p className="text-xs text-slate-500 mt-1">Must be at least 8 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Confirm new password"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Resetting Password...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Reset Password
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-slate-600 hover:text-slate-800 flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Return to Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default PasswordReset;

