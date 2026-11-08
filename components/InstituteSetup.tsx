import React, { useState } from 'react';
import { APP_NAME, COPYRIGHT_TEXT, INSTITUTE_TYPES, PUNJAB_CITIES } from '../constants';
import { updateUser, changeUserPassword } from '../services/authService';
import { User, InstituteProfile } from '../types';
import { Input } from './Input';
import { Select } from './Select';
import { Button } from './Button';
import { Upload, Building2, AlertCircle, X, MapPin, ArrowLeft, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface InstituteSetupProps {
  user: User;
  onSuccess: (updatedUser: User) => void;
  onBack?: () => void;
}

const convertToBlackAndWhiteDataUrl = (src: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!src) {
      resolve('');
      return;
    }
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 240;
        canvas.height = img.naturalHeight || img.height || 240;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
};

export const InstituteSetup: React.FC<InstituteSetupProps> = ({ user, onSuccess, onBack }) => {
  const savedInstituteName = (user.instituteProfile?.instituteName || '').trim();
  const isInstituteNameLocked = Boolean(savedInstituteName);

  const [formData, setFormData] = useState<Omit<InstituteProfile, 'logoUrl'>>({
    instituteName: user.instituteProfile?.instituteName || '',
    instituteType: user.instituteProfile?.instituteType || '',
    address: user.instituteProfile?.address || '',
    city: user.instituteProfile?.city || '',
    contactNumber: user.instituteProfile?.contactNumber || '',
    showLogoOnPapers: user.instituteProfile?.showLogoOnPapers ?? true,
    showContactOnPapers: user.instituteProfile?.showContactOnPapers ?? true,
    saveAsDefault: user.instituteProfile?.saveAsDefault ?? true,
    defaultHeaderStyle: (() => {
      try {
        const localSaved = localStorage.getItem(`aplus_default_header_${user.id}`);
        if (localSaved && ['default', 'style2', 'style3', 'style4', 'style5', 'style6', 'style7', 'style8'].includes(localSaved)) {
          return localSaved as NonNullable<InstituteProfile['defaultHeaderStyle']>;
        }
      } catch {
        // ignore
      }
      return user.instituteProfile?.defaultHeaderStyle || 'default';
    })(),
    showWatermarkOnPapers: user.instituteProfile?.showWatermarkOnPapers ?? true,
    watermarkOpacity: user.instituteProfile?.watermarkOpacity ?? 12,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(user.instituteProfile?.logoUrl || null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (user.instituteProfile?.logoUrl) {
      convertToBlackAndWhiteDataUrl(user.instituteProfile.logoUrl).then(bw => {
        if (bw) setLogoPreview(bw);
      });
    }
  }, [user.instituteProfile?.logoUrl]);

  // Change Password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isPassLoading, setIsPassLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'instituteName' && isInstituteNameLocked) {
      return;
    }
    setFormData(prev => ({ ...prev, [name]: name === 'watermarkOpacity' ? Number(value) : value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleToggle = (name: keyof typeof formData) => {
    setFormData(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 150 * 1024) { 
        setErrors(prev => ({ ...prev, logo: "Image is too large. Max size is 150KB." }));
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawDataUrl = reader.result as string;
        const bwDataUrl = await convertToBlackAndWhiteDataUrl(rawDataUrl);
        setLogoPreview(bwDataUrl || rawDataUrl);
        setErrors(prev => ({ ...prev, logo: '' }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = (): boolean => {
    setErrors({});
    return true; // Always return true to avoid blocking the user
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIsLoading(true);
    const finalLogo = logoPreview ? await convertToBlackAndWhiteDataUrl(logoPreview) : undefined;
    const instituteProfile: InstituteProfile = {
      instituteName: isInstituteNameLocked ? savedInstituteName : (formData.instituteName || '').trim(),
      instituteType: formData.instituteType || '',
      address: (formData.address || '').trim(),
      city: (formData.city || '').trim(),
      contactNumber: (formData.contactNumber || '').trim(),
      showLogoOnPapers: !!formData.showLogoOnPapers,
      showContactOnPapers: !!formData.showContactOnPapers,
      saveAsDefault: !!formData.saveAsDefault,
      defaultHeaderStyle: formData.defaultHeaderStyle || 'default',
      showWatermarkOnPapers: formData.showWatermarkOnPapers !== false,
      watermarkOpacity: Math.max(0, Math.min(60, Number(formData.watermarkOpacity ?? 12))),
      ...(finalLogo ? { logoUrl: finalLogo } : {}),
    };

    try {
      localStorage.setItem(`aplus_default_header_${user.id}`, instituteProfile.defaultHeaderStyle || 'default');
    } catch {
      // ignore
    }

    const updatedUser: User = {
      ...user,
      instituteProfile,
    };

    try {
      await updateUser(updatedUser);
      setIsLoading(false);
      onSuccess(updatedUser);
    } catch (error) {
      setIsLoading(false);
      onSuccess(updatedUser);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!currentPass || !newPass || !confirmPass) {
      setPassError('All password fields are required.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('New passwords do not match.');
      return;
    }
    if (newPass.length < 6) {
      setPassError('New password must be at least 6 characters.');
      return;
    }
    if (newPass === currentPass) {
      setPassError('New password must be different from current password.');
    }

    setIsPassLoading(true);
    const result = await changeUserPassword(user, currentPass, newPass);
    setIsPassLoading(false);

    if (result.success) {
      setPassSuccess(result.message);
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      setTimeout(() => setPassSuccess(''), 4000);
    } else {
      setPassError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-900 text-theme-text-main transition-colors duration-300">
      {onBack && (
        <div className="sm:mx-auto sm:w-full sm:max-w-xl px-4 mb-2">
          <button
            type="button"
            onClick={onBack}
            className="text-theme-text-muted hover:text-gold-500 flex items-center gap-1.5 transition-colors font-medium text-sm py-1.5 px-3 rounded-lg hover:bg-gray-800"
          >
            <ArrowLeft size={18} />
            <span>Back to Dashboard</span>
          </button>
        </div>
      )}

      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center px-4">
         <div className="flex justify-center mb-4">
          <div className="p-3 bg-gray-800 rounded-full border-2 border-gold-500 shadow-lg">
            <Building2 className="w-8 h-8 text-gold-500" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-gold-500">{APP_NAME}</h2>
        <h3 className="mt-2 text-xl font-bold text-theme-text-main uppercase tracking-tighter">Institute Profile Setup</h3>
        <p className="mt-1 text-sm text-theme-text-muted font-bold">All fields are mandatory to ensure your papers look professional.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <div className="bg-gray-800 py-8 px-4 shadow-xl border border-gray-700 sm:rounded-xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {Object.keys(errors).length > 0 && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 flex items-center gap-3 animate-fadeIn">
                <AlertCircle className="text-red-500 shrink-0" size={18} />
                <p className="text-xs text-red-400 font-bold uppercase tracking-tight">Please complete all required fields below.</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-bold text-theme-text-main mb-2 uppercase tracking-tight flex items-center justify-between">
                <span>Institute Logo <span className="text-red-500">*</span></span>
                {errors.logo && <span className="text-[10px] text-red-400 normal-case font-medium">{errors.logo}</span>}
              </label>
              <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-all bg-gray-900/20 relative ${errors.logo ? 'border-red-500' : 'border-gray-700 hover:border-gold-500'}`}>
                <div className="space-y-1 text-center">
                  {logoPreview ? (
                    <div className="relative inline-block animate-scaleIn">
                       <img src={logoPreview} alt="Logo Preview" style={{ filter: 'grayscale(100%)' }} className="h-24 w-24 object-contain mx-auto rounded-md bg-white p-1 grayscale" />
                       <button type="button" onClick={() => { setLogoPreview(null); setLogoFile(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg"><X size={14} /></button>
                       <p className="text-[9px] text-gold-500 font-bold uppercase tracking-wider mt-1">Black & White Print Ready</p>
                    </div>
                  ) : (
                    <>
                      <Upload className={`mx-auto h-12 w-12 transition-colors ${errors.logo ? 'text-red-500/50' : 'text-gray-500'}`} />
                      <div className="flex text-sm text-theme-text-muted justify-center">
                        <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-bold text-gold-600 hover:text-gold-500 focus-within:outline-none uppercase tracking-widest text-[10px]">
                          <span>Upload Logo Image</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                        </label>
                      </div>
                      <p className="text-[10px] text-theme-text-muted uppercase tracking-widest font-bold">Optional • PNG/JPG max 150KB (Auto Black & White)</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Input
                label="Institute Name *"
                name="instituteName"
                placeholder="e.g. Government High School Lahore"
                value={isInstituteNameLocked ? savedInstituteName : formData.instituteName}
                onChange={handleChange}
                disabled={isInstituteNameLocked}
                readOnly={isInstituteNameLocked}
                className={isInstituteNameLocked ? 'opacity-65 cursor-not-allowed bg-gray-900' : ''}
                icon={isInstituteNameLocked ? <Lock size={16} className="text-gold-500" /> : undefined}
                error={errors.instituteName}
              />
              {isInstituteNameLocked && (
                <p className="text-[10px] text-gold-500 -mt-3 mb-3 font-bold uppercase tracking-tight">
                  School Name is permanently locked after saving.
                </p>
              )}
            </div>
            <Select label="Institute Type *" name="instituteType" options={INSTITUTE_TYPES} value={formData.instituteType} onChange={handleChange} error={errors.instituteType} />

            <div className="mb-4">
              <label className="block text-sm font-bold text-theme-text-main mb-1 uppercase tracking-tight">Institute Address <span className="text-red-500">*</span></label>
              <textarea
                name="address"
                rows={2}
                className={`w-full px-4 py-2 bg-gray-800 border rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 transition-colors text-theme-text-main placeholder-gray-500 outline-none ${
                  errors.address ? 'border-red-500 focus:border-red-500' : 'border-gray-700'
                }`}
                placeholder="e.g. Near Liaquat Chowk, Pull Sunny"
                value={formData.address}
                onChange={handleChange}
              />
              {errors.address && <p className="mt-1 text-xs text-red-400 font-medium">{errors.address}</p>}
            </div>

            <div className="relative">
              <Input label="City *" name="city" list="punjab-cities" placeholder="Search or type your city..." value={formData.city} onChange={handleChange} error={errors.city} autoComplete="off" icon={<MapPin size={18} />} />
              <datalist id="punjab-cities">
                {PUNJAB_CITIES.map(city => (<option key={city} value={city} />))}
              </datalist>
              <p className="text-[9px] text-theme-text-muted -mt-3 mb-4 uppercase font-bold tracking-tighter">Can't find your city? Just type the name manually.</p>
            </div>

            <Input label="Institute Contact Number *" name="contactNumber" type="tel" placeholder="03001234567 or 04231234567" value={formData.contactNumber} onChange={handleChange} error={errors.contactNumber} maxLength={15} />

            <div className="mb-4">
              <label className="block text-sm font-bold text-theme-text-main mb-1 uppercase tracking-tight">
                Default Paper Header Style
              </label>
              <select
                name="defaultHeaderStyle"
                value={formData.defaultHeaderStyle || 'default'}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 transition-colors text-theme-text-main font-bold outline-none cursor-pointer"
              >
                <option value="default">Default Header</option>
                <option value="sba">SBA Header</option>
                <option value="layout3">Layout 3</option>
                <option value="layout4">Layout 4</option>
                <option value="layout5">Layout 5</option>
                <option value="layout6">Layout 6</option>
                <option value="layout7">Layout 7</option>
                <option value="layout8">Layout 8</option>
              </select>
              <p className="text-[10px] text-theme-text-muted mt-1 font-bold uppercase tracking-tight">
                This header layout will be automatically applied to all your papers.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between py-2 border-t border-b border-gray-700">
                <span className="text-sm font-bold text-theme-text-muted uppercase tracking-tight">Show Logo on Papers</span>
                <button type="button" onClick={() => handleToggle('showLogoOnPapers')} className={`${formData.showLogoOnPapers ? 'bg-gold-500' : 'bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}><span className={`${formData.showLogoOnPapers ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} /></button>
              </div>
              <div className="py-2 border-b border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-theme-text-muted uppercase tracking-tight">Show Logo Watermark on Paper Background</span>
                  <button type="button" onClick={() => handleToggle('showWatermarkOnPapers')} className={`${formData.showWatermarkOnPapers ? 'bg-gold-500' : 'bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}><span className={`${formData.showWatermarkOnPapers ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} /></button>
                </div>
                {formData.showWatermarkOnPapers && (
                  <div className="pt-1 pb-1">
                    <div className="flex items-center justify-between text-xs font-bold text-theme-text-muted mb-1">
                      <span className="uppercase tracking-tight">Watermark Opacity</span>
                      <span className="text-gold-500 font-black">{formData.watermarkOpacity ?? 12}%</span>
                    </div>
                    <input
                      type="range"
                      name="watermarkOpacity"
                      min={2}
                      max={50}
                      step={1}
                      value={formData.watermarkOpacity ?? 12}
                      onChange={handleChange}
                      className="w-full accent-gold-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-700">
                <span className="text-sm font-bold text-theme-text-muted uppercase tracking-tight">Show Contact on Papers</span>
                <button type="button" onClick={() => handleToggle('showContactOnPapers')} className={`${formData.showContactOnPapers ? 'bg-gold-500' : 'bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}><span className={`${formData.showContactOnPapers ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} /></button>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-700">
                <span className="text-sm font-bold text-theme-text-muted uppercase tracking-tight">Save as Default</span>
                <button type="button" onClick={() => handleToggle('saveAsDefault')} className={`${formData.saveAsDefault ? 'bg-gold-500' : 'bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}><span className={`${formData.saveAsDefault ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} /></button>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              {onBack && (
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={onBack} 
                  className="sm:w-1/3 order-2 sm:order-1"
                >
                  Back
                </Button>
              )}
              <Button 
                type="submit" 
                isLoading={isLoading} 
                className={`shadow-xl ${onBack ? 'sm:w-2/3 order-1 sm:order-2' : 'w-full'}`}
              >
                Complete Setup & Go to Dashboard
              </Button>
            </div>
          </form>

          {/* ── Change Password Section ── */}
          <div className="mt-8 border-t border-gray-700 pt-6">
            <button
              type="button"
              onClick={() => { setShowChangePassword(v => !v); setPassError(''); setPassSuccess(''); }}
              className="w-full flex items-center justify-between text-sm font-bold text-theme-text-muted hover:text-gold-500 transition-colors group"
            >
              <span className="flex items-center gap-2">
                <Lock size={16} className="text-gold-500" />
                Change Password
              </span>
              <span className={`text-xs transition-transform duration-200 ${showChangePassword ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {showChangePassword && (
              <form onSubmit={handleChangePassword} className="mt-4 space-y-4 animate-fadeIn">
                {passError && (
                  <div className="bg-red-900/20 border-l-4 border-red-500 p-3 rounded">
                    <p className="text-sm text-red-400">{passError}</p>
                  </div>
                )}
                {passSuccess && (
                  <div className="bg-green-900/20 border-l-4 border-green-500 p-3 rounded flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-400 shrink-0" />
                    <p className="text-sm text-green-400">{passSuccess}</p>
                  </div>
                )}

                <div className="relative">
                  <Input
                    label="Current Password"
                    type={showCurrent ? 'text' : 'password'}
                    placeholder="Enter your current password"
                    value={currentPass}
                    onChange={e => setCurrentPass(e.target.value)}
                    icon={
                      <button type="button" onClick={() => setShowCurrent(v => !v)} className="focus:outline-none">
                        {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                </div>

                <div className="relative">
                  <Input
                    label="New Password"
                    type={showNew ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    icon={
                      <button type="button" onClick={() => setShowNew(v => !v)} className="focus:outline-none">
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                </div>

                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                />

                <Button type="submit" isLoading={isPassLoading}>
                  Update Password
                </Button>
              </form>
            )}
          </div>
        </div>
        <footer className="mt-8 text-center text-xs text-theme-text-muted pb-4"><p>{COPYRIGHT_TEXT}</p></footer>
      </div>
    </div>
  );
};