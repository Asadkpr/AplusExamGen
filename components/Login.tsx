import React, { useState } from 'react';
import { APP_NAME, APP_TAGLINE, COPYRIGHT_TEXT } from '../constants';
import { loginUser, resetUserPassword } from '../services/authService';
import { Input } from './Input';
import { Button } from './Button';
import { Eye, EyeOff, Lock, HelpCircle, ArrowLeft, Building2 } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onNavigateSignUp: () => void;
  onSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateSignUp, onSuccess }) => {
  // Views: 'LOGIN' | 'FORGOT_PASSWORD'
  const [view, setView] = useState<'LOGIN' | 'FORGOT_PASSWORD'>('LOGIN');

  // Login State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Forgot Password State
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState(''); // Institute Name
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  // Common State
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- HANDLERS ---

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError('');

    // Removed artificial delay for speed
    const result = await loginUser(identifier, password);
    setIsLoading(false);

    if (result.success && result.user) {
      onSuccess(result.user);
    } else {
      setError(result.message);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetIdentifier || !securityAnswer || !newPassword || !confirmNewPassword) {
      setError("All fields are required.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    // Removed artificial delay for speed
    const result = await resetUserPassword(resetIdentifier, securityAnswer, newPassword);
    
    setIsLoading(false);

    if (result.success) {
      setSuccessMsg(result.message);
      // Auto switch back to login after short delay
      setTimeout(() => {
        setSuccessMsg('');
        setIdentifier(resetIdentifier); // Pre-fill login
        setPassword('');
        setView('LOGIN');
      }, 2000);
    } else {
      setError(result.message);
    }
  };

  // --- RENDERERS ---

  const renderLoginForm = () => (
    <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-fadeIn">
      <div className="bg-gray-800 py-8 px-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-gray-700 sm:rounded-xl sm:px-10">
        <form className="space-y-6" onSubmit={handleLoginSubmit}>
          
          {error && (
            <div className="bg-red-900/20 border-l-4 border-red-500 p-4 animate-scaleIn">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {successMsg && (
            <div className="bg-green-900/20 border-l-4 border-green-500 p-4 animate-scaleIn">
              <p className="text-sm text-green-400">{successMsg}</p>
            </div>
          )}

          <Input 
            label="Email or Mobile Number"
            type="text"
            placeholder="Enter your registered ID"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />

          <div>
            <Input 
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="focus:outline-none">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
            <div className="flex items-center justify-between -mt-2 mb-4">
              <div className="flex items-center">
                <input
                  id="remember_me"
                  name="remember_me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-black focus:ring-gold-500 border-gray-600 rounded bg-gray-700 accent-gold-500 cursor-pointer"
                />
                <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-400 font-medium cursor-pointer select-none">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <button 
                  type="button" 
                  onClick={() => { setError(''); setSuccessMsg(''); setView('FORGOT_PASSWORD'); }} 
                  className="font-bold text-gold-600 hover:text-gold-500"
                >
                  Forgot password?
                </button>
              </div>
            </div>
          </div>

          <Button type="submit" isLoading={isLoading}>Log In</Button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-500 font-medium">
                Don't have an account?
              </span>
            </div>
          </div>

          <div className="mt-4 text-center">
            <button onClick={onNavigateSignUp} className="font-bold text-gold-600 hover:text-gold-500 transition-colors uppercase tracking-widest text-xs">
              Create New Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderForgotForm = () => (
    <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-fadeIn">
      <div className="bg-gray-800 py-8 px-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-gray-700 sm:rounded-xl sm:px-10">
        <div className="mb-6 text-center">
           <h3 className="text-xl font-bold text-white mb-2">Reset Password</h3>
           <p className="text-sm text-gray-500">Answer the security question to reset your password.</p>
        </div>

        <form className="space-y-4" onSubmit={handleResetSubmit}>
          
          {error && (
            <div className="bg-red-900/20 border-l-4 border-red-500 p-4 mb-2 animate-scaleIn">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          
          {successMsg && (
            <div className="bg-green-900/20 border-l-4 border-green-500 p-4 mb-2 animate-scaleIn">
              <p className="text-sm text-green-400">{successMsg}</p>
            </div>
          )}

          <Input 
            label="Registered ID (Email or Mobile)"
            type="text"
            placeholder="e.g. 03001234567"
            value={resetIdentifier}
            onChange={(e) => setResetIdentifier(e.target.value)}
          />

          <div className="relative">
            <div className="absolute -top-6 right-0 text-[10px] text-gold-600 font-bold italic">
               * Security Question
            </div>
            <Input 
              label="Institute / School Name"
              type="text"
              placeholder="e.g. Government High School"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              icon={<Building2 size={18} />}
            />
            <p className="text-[10px] text-gray-500 -mt-3 mb-3">Enter the exact name used in your profile setup.</p>
          </div>

          <div className="border-t border-gray-700 pt-4 mt-2">
             <Input 
              label="New Password"
              type="password"
              placeholder="Min 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            
            <Input 
              label="Confirm New Password"
              type="password"
              placeholder="Re-enter new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />
          </div>

          <div className="pt-2">
             <Button type="submit" isLoading={isLoading}>Reset & Save Password</Button>
          </div>

          <button 
             type="button" 
             onClick={() => { setError(''); setSuccessMsg(''); setView('LOGIN'); }}
             className="w-full flex items-center justify-center gap-2 mt-4 text-gray-500 hover:text-white font-bold transition-colors uppercase tracking-widest text-[10px]"
          >
             <ArrowLeft size={16} /> Back to Login
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-900 selection:bg-gold-500 selection:text-black">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gray-800 rounded-full border-2 border-gold-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            {view === 'LOGIN' ? <Lock className="w-8 h-8 text-gold-500" /> : <HelpCircle className="w-8 h-8 text-gold-500" />}
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-gold-500 tracking-wider uppercase">{APP_NAME}</h2>
        <p className="mt-2 text-sm text-gray-400 font-bold tracking-tight">{APP_TAGLINE}</p>
      </div>

      {view === 'LOGIN' ? renderLoginForm() : renderForgotForm()}

      <footer className="mt-8 text-center text-xs text-gray-500 pb-4">
        <p>{COPYRIGHT_TEXT}</p>
      </footer>
    </div>
  );
};