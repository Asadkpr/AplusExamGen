import React from 'react';
import { ArrowLeft, Phone, Mail, HelpCircle, PlayCircle, ChevronRight, MapPin, Facebook, Info } from 'lucide-react';
import { APP_NAME, COPYRIGHT_TEXT } from '../constants';

interface HelpSupportProps {
  onBack: () => void;
}

export const HelpSupport: React.FC<HelpSupportProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col selection:bg-gold-500 selection:text-black font-sans transition-colors duration-300">
      <header className="bg-gray-800 shadow-sm border-b border-gray-700 sticky top-0 z-10 h-16 flex items-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
          <button 
            onClick={onBack} 
            className="text-theme-text-muted hover:text-gold-500 flex items-center transition-colors"
          >
            <ArrowLeft size={20} className="mr-1" />
            <span className="font-medium">Dashboard</span>
          </button>
          <div className="text-xl font-bold text-theme-text-main tracking-wider uppercase">
             Help & Support
          </div>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* App Overview */}
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-xl">
            <h2 className="text-xl font-bold text-theme-text-main mb-4 flex items-center">
              <Info className="text-gold-500 mr-3" /> App Overview
            </h2>
            <p className="text-theme-text-muted leading-relaxed">
              Welcome to <strong className="text-theme-text-main">{APP_NAME}</strong> — Pakistan’s most reliable and intelligent exam generator designed for teachers. 
              Our mission is to make paper-making fast, accurate, and effortless for every teacher in Pakistan. 
              We provide smart tools to save time and improve assessment quality, empowering you to focus on what matters most: teaching.
            </p>
          </div>

          {/* Contact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Email */}
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-xl text-center hover:border-gold-500 transition-colors group flex flex-col items-center shadow-lg">
              <div className="w-10 h-10 bg-purple-900/30 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-500/20 border border-purple-500/20">
                <Mail className="text-purple-500" size={20} />
              </div>
              <h3 className="text-theme-text-main font-bold mb-1 text-sm">Email</h3>
              <a href="mailto:aplus.examgen@gmail.com" className="text-theme-text-sub text-xs hover:text-gold-500 break-all transition-colors">aplus.examgen@gmail.com</a>
            </div>

            {/* Phone/WhatsApp */}
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-xl text-center hover:border-gold-500 transition-colors group flex flex-col items-center shadow-lg">
              <div className="w-10 h-10 bg-green-900/30 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-500/20 border border-green-500/20">
                <Phone className="text-green-500" size={20} />
              </div>
              <h3 className="text-theme-text-main font-bold mb-1 text-sm">Phone / WhatsApp</h3>
              <a href="https://wa.me/923007634001" className="text-theme-text-sub text-xs hover:text-gold-500 transition-colors">0300-7634001</a>
            </div>

            {/* Facebook */}
            <div className="bg-gray-800 border border-gray-700 p-5 rounded-xl text-center hover:border-gold-500 transition-colors group flex flex-col items-center shadow-lg">
              <div className="w-10 h-10 bg-blue-900/30 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-500/20 border border-blue-500/20">
                <Facebook className="text-blue-500" size={20} />
              </div>
              <h3 className="text-theme-text-main font-bold mb-1 text-sm">Facebook</h3>
              <a href="https://www.facebook.com/profile.php?id=61584648867531" target="_blank" rel="noreferrer" className="text-theme-text-sub text-xs hover:text-gold-500 transition-colors">APlus ExamGen</a>
            </div>

             {/* Address */}
             <div className="bg-gray-800 border border-gray-700 p-5 rounded-xl text-center hover:border-gold-500 transition-colors group flex flex-col items-center shadow-lg">
              <div className="w-10 h-10 bg-red-900/30 rounded-full flex items-center justify-center mb-3 group-hover:bg-red-500/20 border border-red-500/20">
                <MapPin className="text-red-500" size={20} />
              </div>
              <h3 className="text-theme-text-main font-bold mb-1 text-sm">Address</h3>
              <p className="text-theme-text-sub text-xs">Pull Sunny, Rahim Yar Khan</p>
            </div>
          </div>

          {/* Video Tutorials */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-theme-text-main mb-6 flex items-center">
              <PlayCircle className="text-red-500 mr-3" /> Video Tutorials
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {[
                 "How to Generate a Paper in 2 Minutes", 
                 "Uploading your Institute Logo",
                 "Using Multi-Test per Page Feature",
                 "Importing Questions via Excel"
               ].map((title, i) => (
                 <div key={i} className="flex items-center p-3 bg-gray-950/40 rounded-lg cursor-pointer hover:bg-gray-750 border border-gray-700 hover:border-gold-500/40 transition-all">
                    <div className="w-10 h-10 bg-red-900/20 rounded flex items-center justify-center mr-3 flex-shrink-0 border border-red-500/10">
                      <PlayCircle size={20} className="text-red-500" />
                    </div>
                    <span className="text-sm text-theme-text-muted font-medium transition-colors">{title}</span>
                 </div>
               ))}
            </div>
          </div>

          {/* FAQs */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-theme-text-main mb-6 flex items-center">
              <HelpCircle className="text-gold-500 mr-3" /> Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {[
                { q: "Can I use my own questions?", a: "Yes! If you are an admin, you can use the 'Upload Paper' feature to bulk import questions via Excel." },
                { q: "How do I change my Institute Logo?", a: "Go to Profile Setup from the Dashboard sidebar to update your logo and address details." },
                { q: "Does the app work offline?", a: "Currently, APLUS ExamGen requires an active internet connection to authenticate and fetch questions." },
                { q: "What is the 'Smart Warning' feature?", a: "If you select a paper pattern that requires questions (like Essays) which aren't in your selected chapters, the system warns you to prevent generating an incomplete paper." }
              ].map((faq, i) => (
                <div key={i} className="border-b border-gray-700 pb-4 last:border-0 last:pb-0">
                  <h3 className="font-bold mb-1 flex items-start">
                    <ChevronRight size={16} className="mt-1 mr-1 text-gold-500 shrink-0" />
                    <span className="text-theme-text-main leading-tight">{faq.q}</span>
                  </h3>
                  <p className="text-sm text-theme-text-muted pl-5 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center pt-8 text-theme-text-sub text-xs pb-8">
             <p className="font-bold">{APP_NAME} v1.0.3</p>
             <p>{COPYRIGHT_TEXT}</p>
          </div>

        </div>
      </main>
    </div>
  );
};