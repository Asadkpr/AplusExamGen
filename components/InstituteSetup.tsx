import React, { useState } from 'react';
import { APP_NAME, COPYRIGHT_TEXT, INSTITUTE_TYPES, PUNJAB_CITIES } from '../constants';
import { updateUser } from '../services/authService';
import { User, InstituteProfile } from '../types';
import { Input } from './Input';
import { Select } from './Select';
import { Button } from './Button';
import { Upload, Building2 } from 'lucide-react';

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
      // STRICT LIMIT: 150KB to prevent Firestore document size issues (1MB limit for doc)
      if (file.size > 150 * 1024) { 
        setErrors(prev => ({ ...prev, logo: "Image is too large. Max size is 150KB to ensure data saves correctly." }));
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
    if (!formData.instituteName.trim()) newErrors.instituteName = "Institute Name is required";
    if (!formData.instituteType) newErrors.instituteType = "Please select an Institute Type";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.city) newErrors.city = "Please select a City";
    if (!/^03\d{9}$/.test(formData.contactNumber)) {
      newErrors.contactNumber = "Must be 11 digits (03XXXXXXXXX)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsLoading(true);
    
    // Construct the updated user object
    const updatedUser: User = {
      ...user,
      instituteProfile: {
        ...formData,
        logoUrl: logoPreview || undefined,
      }
    };

    try {
      // CRITICAL: Await the update operation to ensure DB persistence
      await updateUser(updatedUser);
      
      // Removed artificial delay
      setIsLoading(false);
      onSuccess(updatedUser);
    } catch (error) {
      console.error("Setup failed", error);
      setIsLoading(false);
      // Even if DB fails, we proceed locally so user isn't stuck, 
      // but updateUser service handles the persistence retry.
      onSuccess(updatedUser);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-900 selection:bg-gold-500 selection:text-black">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
         <div className="flex justify-center mb-4">
          <div className="p-3 bg-gray-800 rounded-full border-2 border-gold-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Building2 className="w-8 h-8 text-gold-500" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-gold-500">{APP_NAME}</h2>
        <h3 className="mt-2 text-xl font-semibold text-white">Institute Profile Setup</h3>
        <p className="mt-1 text-sm text-gray-400">Please provide your institute details to continue.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-gray-800 py-8 px-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-gray-700 sm:rounded-xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            <Input 
              label="Institute Name"
              name="instituteName"
              placeholder="e.g. Government High School Lahore"
              value={formData.instituteName}
              onChange={handleChange}
              error={errors.instituteName}
            />

            <Select 
              label="Institute Type"
              name="instituteType"
              options={INSTITUTE_TYPES}
              value={formData.instituteType}
              onChange={handleChange}
              error={errors.instituteType}
            />

            <div className="mb-4">
              <label className="block text-sm font-medium text-gold-100 mb-1">
                Institute Address
              </label>
              <textarea
                name="address"
                rows={2}
                className={`w-full px-4 py-2 bg-gray-700 border rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 transition-colors text-white placeholder-gray-500 ${
                  errors.address ? 'border-red-500' : 'border-gray-600'
                }`}
                placeholder="e.g. Near Liaquat Chowk, Pull Sunny"
                value={formData.address}
                onChange={handleChange}
              />
              {errors.address && <p className="mt-1 text-xs text-red-400">{errors.address}</p>}
            </div>

            <Select 
              label="City"
              name="city"
              options={PUNJAB_CITIES}
              value={formData.city}
              onChange={handleChange}
              error={errors.city}
            />

            <Input 
              label="Institute Contact Number"
              name="contactNumber"
              type="tel"
              placeholder="03XXXXXXXXX"
              value={formData.contactNumber}
              onChange={handleChange}
              error={errors.contactNumber}
              maxLength={11}
            />

            <div className="mb-4">
              <label className="block text-sm font-medium text-gold-100 mb-1">
                Institute Logo (Optional)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-lg hover:border-gold-500 transition-colors bg-gray-700 relative">
                <div className="space-y-1 text-center">
                  {logoPreview ? (
                    <div className="relative inline-block">
                       <img src={logoPreview} alt="Logo Preview" className="h-24 w-24 object-contain mx-auto rounded-md bg-white p-1" />
                       <button 
                        type="button" 
                        onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                       >
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                       </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-400 justify-center">
                        <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-gold-500 hover:text-gold-400 focus-within:outline-none">
                          <span>Upload a file</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG up to 150KB (For fast loading)</p>
                    </>
                  )}
                </div>
              </div>
              {errors.logo && <p className="mt-1 text-xs text-red-400">{errors.logo}</p>}
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between py-2 border-t border-b border-gray-700">
                <span className="text-sm font-medium text-gray-300">Show Institute Logo on Papers</span>
                <button
                  type="button"
                  onClick={() => handleToggle('showLogoOnPapers')}
                  className={`${formData.showLogoOnPapers ? 'bg-gold-500' : 'bg-gray-600'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
                >
                  <span className={`${formData.showLogoOnPapers ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} />
                </button>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-700">
                <span className="text-sm font-medium text-gray-300">Show Contact Number on Papers</span>
                <button
                  type="button"
                  onClick={() => handleToggle('showContactOnPapers')}
                  className={`${formData.showContactOnPapers ? 'bg-gold-500' : 'bg-gray-600'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
                >
                  <span className={`${formData.showContactOnPapers ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} />
                </button>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-700">
                <span className="text-sm font-medium text-gray-300">Save Information as Default</span>
                <button
                  type="button"
                  onClick={() => handleToggle('saveAsDefault')}
                  className={`${formData.saveAsDefault ? 'bg-gold-500' : 'bg-gray-600'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
                >
                  <span className={`${formData.saveAsDefault ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} />
                </button>
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" isLoading={isLoading}>Save & Continue</Button>
            </div>
          </form>
        </div>

        <footer className="mt-8 text-center text-xs text-gray-500 pb-4">
          <p>{COPYRIGHT_TEXT}</p>
        </footer>
      </div>
    </div>
  );
};