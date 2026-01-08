import React, { useState, useEffect } from 'react';
import { APP_NAME, APP_TAGLINE, COPYRIGHT_TEXT } from '../constants';
import { registerUser } from '../services/authService';
import { Input } from './Input';
import { Button } from './Button';
import { Eye, EyeOff, UserPlus, ArrowLeft } from 'lucide-react';
import { User } from '../types';

interface SignUpProps {
  onNavigateLogin: () => void;
  onSuccess: (user: User) => void;
}

export const SignUp: React.FC<SignUpProps> = ({ onNavigateLogin, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    whatsapp: '',
    password: '',
    confirmPassword: '',
  });

  const [sameAsMobile, setSameAsMobile] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Effect to sync WhatsApp with Mobile if checkbox is checked
  useEffect(() => {
    if (sameAsMobile) {
      setFormData(prev => ({ ...prev, whatsapp: prev.mobile }));
    }
  }, [formData.mobile, sameAsMobile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear specific error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSameAsMobile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setSameAsMobile(isChecked);
    if (isChecked) {
      setFormData(prev => ({ ...prev, whatsapp: prev.mobile }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (formData.name.trim().length < 3) newErrors.name = "Teacher Name must be at least 3 characters";
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) newErrors.email = "Invalid email format";
    
    const phoneRegex = /^03\d{9}$/;
    if (!phoneRegex.test(formData.mobile)) newErrors.mobile = "Must be 11 digits starting with 03 (e.g. 03001234567)";
    
    if (!sameAsMobile && formData.whatsapp && !phoneRegex.test(formData.whatsapp)) {
       newErrors.whatsapp = "Invalid WhatsApp number format";
    }

    if (formData.password.length < 6) newErrors.password = "Password must be at least 6 characters";
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    
    if (!agreed) {
      newErrors.terms = "You must agree to the Terms & Conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsLoading(true);
    
    // 1. Register User
    const registerResult = await registerUser({
      name: formData.name,
      email: formData.email,
      mobile: formData.mobile,
      whatsapp: formData.whatsapp || formData.mobile,
      password: formData.password
    });

    if (registerResult.success && registerResult.user) {
      // 2. Auto Login (Optimization: Don't call loginUser API again, just use the user object)
      // Firebase automatically logs in the user after creation.
      
      // Removed artificial delay
      setIsLoading(false);
      onSuccess(registerResult.user!);
      
    } else {
      setIsLoading(false);
      setErrors(prev => ({ ...prev, api: registerResult.message }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-900 selection:bg-gold-500 selection:text-black">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gray-800 rounded-full border-2 border-gold-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <UserPlus className="w-8 h-8 text-gold-500" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-gold-500 tracking-wider uppercase">{APP_NAME}</h2>
        <p className="mt-2 text-sm text-gold-100/70">{APP_TAGLINE}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-fadeIn">
        <div className="bg-gray-800 py-8 px-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-gray-700 sm:rounded-xl sm:px-10">
          <div className="mb-6 text-center">
             <h3 className="text-xl font-bold text-white">Create New Account</h3>
             <p className="text-sm text-gray-400">Please fill in your details below</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            
            {errors.api && (
              <div className="bg-red-900/20 border-l-4 border-red-500 p-4 mb-4 animate-scaleIn">
                <p className="text-sm text-red-400">{errors.api}</p>
              </div>
            )}

            <Input 
              label="Teacher Name"
              name="name"
              type="text"
              placeholder="e.g. Muhammad Ali"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
            />

            <Input 
              label="Email Address"
              name="email"
              type="email"
              placeholder="teacher@example.com"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
            />

            <Input 
              label="Mobile Number"
              name="mobile"
              type="tel"
              placeholder="03XXXXXXXXX"
              value={formData.mobile}
              onChange={handleChange}
              error={errors.mobile}
              maxLength={11}
            />

            <div className="mb-4 bg-gray-750/30 p-3 rounded-lg border border-gray-700">
              <label className="flex items-center space-x-2 text-sm text-gold-100 mb-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={sameAsMobile} 
                  onChange={handleSameAsMobile}
                  className="rounded bg-gray-700 border-gray-600 text-gold-500 focus:ring-gold-500 accent-gold-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-medium">WhatsApp (Same as Mobile)</span>
              </label>
              <Input 
                label="WhatsApp Number"
                name="whatsapp"
                type="tel"
                placeholder="03XXXXXXXXX"
                value={formData.whatsapp}
                onChange={handleChange}
                disabled={sameAsMobile}
                className={`mb-0 ${sameAsMobile ? 'opacity-50 cursor-not-allowed bg-gray-900' : ''}`}
                error={errors.whatsapp}
              />
            </div>

            <Input 
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              placeholder="Min 6 characters"
              icon={
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="focus:outline-none">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <Input 
              label="Confirm Password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              placeholder="Re-enter password"
            />

            <div className="flex items-start bg-gray-900/50 p-3 rounded border border-gray-700">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="h-4 w-4 text-gold-500 bg-gray-700 border-gray-600 rounded focus:ring-gold-500 accent-gold-500 cursor-pointer"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="font-medium text-gray-300 cursor-pointer select-none">
                  I agree to the Terms & Conditions
                </label>
                {errors.terms && <p className="text-xs text-red-400 mt-1">{errors.terms}</p>}
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" isLoading={isLoading}>Create Account</Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">
                  Already have an account?
                </span>
              </div>
            </div>

            <div className="mt-4 text-center">
              <button 
                onClick={onNavigateLogin} 
                className="flex items-center justify-center w-full gap-2 text-gold-500 hover:text-gold-400 font-medium transition-colors p-2 rounded hover:bg-gray-700/30"
              >
                <ArrowLeft size={16} /> Log in here
              </button>
            </div>
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-gray-500 pb-4">
          <p>{COPYRIGHT_TEXT}</p>
        </footer>
      </div>
    </div>
  );
};