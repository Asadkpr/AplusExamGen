import React, { useState } from 'react';
import { APP_NAME, COPYRIGHT_TEXT, INSTITUTE_TYPES, PUNJAB_CITIES } from '../constants';
import { updateUser } from '../services/authService';
import { User, InstituteProfile } from '../types';
import { Input } from './Input';
import { Select } from './Select';
import { Button } from './Button';
import { Upload, Building2, AlertCircle, X, MapPin } from 'lucide-react';

interface InstituteSetupProps {
  user: User;
  onSuccess: (updatedUser: User) => void;
}

export const InstituteSetup: React.FC<InstituteSetupProps> = ({ user, onSuccess }) => {
  const [formData, setFormData] = useState<Omit<InstituteProfile, 'logoUrl'>>({
    instituteName: user.instituteProfile?.instituteName || '',
    instituteType: user.instituteProfile?.instituteType || '',
    address: user.instituteProfile?.address || '',
    city: user.instituteProfile?.city || '',
    contactNumber: user.instituteProfile?.contactNumber || '',
    showLogoOnPapers: user.instituteProfile?.showLogoOnPapers ?? true,
    showContactOnPapers: user.instituteProfile?.showContactOnPapers ?? true,
    saveAsDefault: user.instituteProfile?.saveAsDefault ?? true,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(user.instituteProfile?.logoUrl || null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        setErrors(prev => ({ ...prev, logo: '' }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!logoPreview) newErrors.logo = "Institute Logo is required";
    if (!formData.instituteName.trim()) newErrors.instituteName = "Institute Name is required";
    if (!formData.instituteType) newErrors.instituteType = "Please select an Institute Type";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.city.trim()) newErrors.city = "City name is required";
    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = "Contact Number is required";
    } else if (!/^03\d{9}$/.test(formData.contactNumber)) {
      newErrors.contactNumber = "Must be 11 digits (03XXXXXXXXX)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIsLoading(true);
    const updatedUser: User = {
      ...user,
      instituteProfile: {
        ...formData,
        logoUrl: logoPreview || undefined,
      }
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

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-900 text-theme-text-main transition-colors duration-300">
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
                       <img src={logoPreview} alt="Logo Preview" className="h-24 w-24 object-contain mx-auto rounded-md bg-white p-1" />
                       <button type="button" onClick={() => { setLogoPreview(null); setLogoFile(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg"><X size={14} /></button>
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
                      <p className="text-[10px] text-theme-text-muted uppercase tracking-widest font-bold">Required • PNG/JPG max 150KB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Input label="Institute Name *" name="instituteName" placeholder="e.g. Government High School Lahore" value={formData.instituteName} onChange={handleChange} error={errors.instituteName} />
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

            <Input label="Institute Contact Number *" name="contactNumber" type="tel" placeholder="03XXXXXXXXX" value={formData.contactNumber} onChange={handleChange} error={errors.contactNumber} maxLength={11} />

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between py-2 border-t border-b border-gray-700">
                <span className="text-sm font-bold text-theme-text-muted uppercase tracking-tight">Show Logo on Papers</span>
                <button type="button" onClick={() => handleToggle('showLogoOnPapers')} className={`${formData.showLogoOnPapers ? 'bg-gold-500' : 'bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}><span className={`${formData.showLogoOnPapers ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} /></button>
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

            <div className="pt-4"><Button type="submit" isLoading={isLoading} className="shadow-xl">Complete Setup & Go to Dashboard</Button></div>
          </form>
        </div>
        <footer className="mt-8 text-center text-xs text-theme-text-muted pb-4"><p>{COPYRIGHT_TEXT}</p></footer>
      </div>
    </div>
  );
};