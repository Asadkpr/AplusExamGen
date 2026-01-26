import React from 'react';
import { ArrowLeft, User, Mail, Phone, MapPin, Facebook } from 'lucide-react';
import { APP_NAME, COPYRIGHT_TEXT } from '../constants';

interface AboutUsProps {
  onBack: () => void;
}

export const AboutUs: React.FC<AboutUsProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col selection:bg-gold-500 selection:text-black font-sans transition-colors duration-300">
      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700 sticky top-0 z-10 h-16 flex items-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
          <button 
            onClick={onBack} 
            className="text-theme-text-muted hover:text-gold-500 flex items-center transition-colors"
          >
            <ArrowLeft size={20} className="mr-1" />
            <span className="font-medium">Dashboard</span>
          </button>
          <div className="text-xl font-bold text-theme-text-main tracking-wider">
             ABOUT US
          </div>
          <div className="w-20"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 sm:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          
          {/* CEO Section */}
<div className="bg-gray-800 border border-gold-600/30 rounded-2xl shadow-2xl overflow-hidden">
  <div className="bg-gray-950/50 p-8 text-center border-b border-gray-700 relative">

    {/* CEO Image */}
   {/* CEO Image */}
<div className="w-32 h-32 rounded-full border-4 border-gold-500 mx-auto mb-4 overflow-hidden bg-gray-700 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
  <img
    src="/ceo.jpeg"
    alt="Nauman Ali - CEO"
    className="w-full h-full object-cover object-[center_20%]"
  />
</div>


    <h2 className="text-2xl font-bold text-theme-text-main tracking-wide">
      NAUMAN ALI
    </h2>
    <p className="text-gold-500 font-medium uppercase tracking-widest text-sm mt-1">
      Founder & CEO
    </p>
    <div className="w-16 h-1 bg-gold-500 mx-auto mt-4 rounded-full"></div>
  </div>

  <div className="p-8 text-theme-text-muted leading-relaxed text-center space-y-4">
    <h3 className="text-xl font-semibold text-theme-text-main mb-2">
      Welcome to APlus ExamGen
    </h3>
    <p className="italic text-theme-text-muted">
      “Pakistan’s most reliable and intelligent exam generator designed for teachers.”
    </p>

    <div className="text-left text-sm md:text-base space-y-4 mt-6 px-4 md:px-12">
      <p className="text-theme-text-main">
        I am <strong className="text-gold-600">Nauman Ali</strong>, founder of APlus ExamGen and passionate about empowering educators with modern digital tools.
        After years of teaching and managing academic systems, I realized how much time teachers spend preparing papers.
      </p>

      <p className="text-theme-text-muted">
        APlus ExamGen is created with a single purpose:
      </p>

      <div className="bg-gold-500/10 border-l-4 border-gold-500 p-4 rounded-r-lg my-4">
        <p className="font-bold text-gold-600 text-center">
          To save teachers’ time and improve the quality of assessments.
        </p>
      </div>

      <p className="text-theme-text-muted">
        Every feature — from automated test generation to customizable patterns — is built after carefully studying real classroom needs.
        Our mission is to make paper-making fast, accurate, and effortless for every teacher in Pakistan.
      </p>

      <p className="font-medium text-theme-text-main text-center pt-2">
        Welcome to the future of smart paper creation.
      </p>
    </div>
  </div>
</div>

          {/* Contact Section */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 shadow-xl">
             <h3 className="text-xl font-bold text-theme-text-main mb-6 text-center uppercase tracking-wide">Contact Information</h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center p-4 bg-gray-950/40 rounded-lg border border-gray-700 hover:border-gold-500 transition-colors group">
                   <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mr-4 group-hover:bg-gold-500/20 transition-colors border border-gray-700">
                     <Mail className="text-gold-500" size={24} />
                   </div>
                   <div>
                     <p className="text-xs text-theme-text-sub uppercase font-bold">Email</p>
                     <a href="mailto:aplus.examgen@gmail.com" className="text-theme-text-main hover:text-gold-500 font-medium transition-colors">aplus.examgen@gmail.com</a>
                   </div>
                </div>

                <div className="flex items-center p-4 bg-gray-950/40 rounded-lg border border-gray-700 hover:border-gold-500 transition-colors group">
                   <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mr-4 group-hover:bg-gold-500/20 transition-colors border border-gray-700">
                     <Phone className="text-gold-500" size={24} />
                   </div>
                   <div>
                     <p className="text-xs text-theme-text-sub uppercase font-bold">Phone & WhatsApp</p>
                     <a href="https://wa.me/923007634001" className="text-theme-text-main hover:text-gold-500 font-medium transition-colors">0300-7634001</a>
                   </div>
                </div>

                <div className="flex items-center p-4 bg-gray-950/40 rounded-lg border border-gray-700 hover:border-gold-500 transition-colors group">
                   <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mr-4 group-hover:bg-gold-500/20 transition-colors border border-gray-700">
                     <Facebook className="text-gold-500" size={24} />
                   </div>
                   <div>
                     <p className="text-xs text-theme-text-sub uppercase font-bold">Facebook Page</p>
                     <a href="https://www.facebook.com/profile.php?id=61584648867531" target="_blank" rel="noreferrer" className="text-theme-text-main hover:text-gold-500 font-medium transition-colors">APlus ExamGen</a>
                   </div>
                </div>

                <div className="flex items-center p-4 bg-gray-950/40 rounded-lg border border-gray-700 hover:border-gold-500 transition-colors group">
                   <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mr-4 group-hover:bg-gold-500/20 transition-colors border border-gray-700">
                     <MapPin className="text-gold-500" size={24} />
                   </div>
                   <div>
                     <p className="text-xs text-theme-text-sub uppercase font-bold">Address</p>
                     <p className="text-theme-text-main font-medium">Pull Sunny, Rahim Yar Khan, Pakistan</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="text-center text-xs text-theme-text-sub pb-8">
             <p className="font-bold">{APP_NAME}</p>
             <p>{COPYRIGHT_TEXT}</p>
          </div>

        </div>
      </main>
    </div>
  );
};