
import React, { useState, useEffect } from 'react';
import { User, Announcement } from '../types';
import { getAnnouncements, saveAnnouncement, deleteAnnouncement, updateAnnouncement } from '../services/announcementService';
import { ArrowLeft, Bell, Plus, Trash2, Edit, Save, X, Megaphone, Info, AlertTriangle, RefreshCw, Calendar, User as UserIcon } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';

interface NewsAnnouncementsProps {
  user: User;
  onBack: () => void;
}

export const NewsAnnouncements: React.FC<NewsAnnouncementsProps> = ({ user, onBack }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'general' as Announcement['type']
  });

  const isAdmin = user.email === 'admin' || user.email === 'admin@aplusexamgen.com' || user.id === 'local-admin';

  const loadData = async () => {
    setIsLoading(true);
    const data = await getAnnouncements();
    setAnnouncements(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;

    setIsActionLoading(true);
    let success = false;

    if (editingAnnouncement) {
      success = await updateAnnouncement({
        ...editingAnnouncement,
        ...formData
      });
    } else {
      success = await saveAnnouncement({
        ...formData,
        author: user.name
      });
    }

    if (success) {
      await loadData();
      setShowModal(false);
      setEditingAnnouncement(null);
      setFormData({ title: '', content: '', type: 'general' });
    } else {
      alert("Failed to save announcement.");
    }
    setIsActionLoading(false);
  };

  const handleEdit = (a: Announcement) => {
    setEditingAnnouncement(a);
    setFormData({ title: a.title, content: a.content, type: a.type });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this announcement?")) return;
    setIsActionLoading(true);
    const success = await deleteAnnouncement(id);
    if (success) {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } else {
      alert("Failed to delete.");
    }
    setIsActionLoading(false);
  };

  const getTypeStyles = (type: Announcement['type']) => {
    switch (type) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'update': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'maintenance': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans transition-colors duration-300">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={onBack} className="text-gray-400 hover:text-gold-500 flex items-center transition-colors">
            <ArrowLeft size={20} className="mr-1" /><span className="font-medium">Dashboard</span>
          </button>
          <div className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
            <Megaphone className="text-gold-500" /> NEWS & UPDATES
          </div>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-8 max-w-4xl mx-auto w-full">
        <div className="mb-8 flex justify-between items-center">
           <div>
             <h2 className="text-2xl font-bold text-theme-text-main uppercase tracking-tighter">Announcements</h2>
             <p className="text-theme-text-muted text-xs mt-1">Stay updated with the latest news from APLUS ExamGen.</p>
           </div>
           {isAdmin && (
             <Button onClick={() => setShowModal(true)} className="!w-auto py-2 px-4 text-xs">
               <Plus size={16} className="mr-1" /> New Broadcast
             </Button>
           )}
        </div>

        {isLoading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4">
             <RefreshCw className="animate-spin text-gold-500" size={32} />
             <p className="text-theme-text-muted font-bold uppercase tracking-widest text-[10px]">Syncing Feed...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-gray-800 border-2 border-dashed border-gray-700 rounded-2xl p-16 text-center text-theme-text-muted">
             <Bell size={48} className="mx-auto mb-4 opacity-10" />
             <p className="font-bold">No announcements available right now.</p>
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            {announcements.map((a) => (
              <div key={a.id} className={`bg-gray-800 border rounded-2xl p-6 shadow-xl transition-all hover:border-gold-500/30 group relative ${a.type === 'urgent' ? 'border-l-4 border-l-red-500' : 'border-gray-700'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border ${getTypeStyles(a.type)} ${a.type === 'urgent' ? 'animate-pulse' : ''}`}>
                      {a.type}
                    </span>
                    <h3 className="text-lg font-bold text-theme-text-main group-hover:text-gold-500 transition-colors leading-tight">{a.title}</h3>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => handleEdit(a)} className="p-1.5 bg-blue-900/20 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all"><Edit size={14} /></button>
                       <button onClick={() => handleDelete(a.id)} className="p-1.5 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
                
                <p className="text-theme-text-muted text-sm leading-relaxed whitespace-pre-wrap">{a.content}</p>
                
                <div className="mt-6 pt-4 border-t border-gray-700 flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><Calendar size={12} className="text-gold-500/50" /> {new Date(a.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                    <span className="flex items-center gap-1"><UserIcon size={12} className="text-gold-500/50" /> {a.author}</span>
                  </div>
                  <div className="bg-gray-900 px-2 py-0.5 rounded text-gold-500/50">Official</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Admin Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-800 border border-gold-500/50 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white uppercase tracking-wider">{editingAnnouncement ? 'Edit' : 'Create'} Broadcast</h3>
              <button onClick={() => { setShowModal(false); setEditingAnnouncement(null); }} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                 <div className="col-span-2">
                   <Input label="Headline" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. New Syllabus Update Added" required />
                 </div>
                 <div className="col-span-2">
                   <label className="block text-xs font-bold text-theme-text-main mb-1 uppercase tracking-tight">Priority Level</label>
                   <select 
                     value={formData.type} 
                     onChange={e => setFormData({...formData, type: e.target.value as Announcement['type']})}
                     className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-theme-text-main focus:border-gold-500 outline-none"
                   >
                     <option value="general">General News</option>
                     <option value="urgent">Urgent Announcement</option>
                     <option value="update">Feature Update</option>
                     <option value="maintenance">Maintenance Alert</option>
                   </select>
                 </div>
                 <div className="col-span-2">
                   <label className="block text-xs font-bold text-theme-text-main mb-1 uppercase tracking-tight">Detailed Content</label>
                   <textarea 
                     rows={5}
                     value={formData.content}
                     onChange={e => setFormData({...formData, content: e.target.value})}
                     className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-theme-text-main focus:border-gold-500 outline-none placeholder:text-gray-600"
                     placeholder="Type your message here..."
                     required
                   />
                 </div>
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <Button variant="secondary" onClick={() => { setShowModal(false); setEditingAnnouncement(null); }} type="button">Cancel</Button>
                <Button type="submit" isLoading={isActionLoading}>
                  <Save size={18} className="mr-2" /> {editingAnnouncement ? 'Update Message' : 'Post Announcement'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
