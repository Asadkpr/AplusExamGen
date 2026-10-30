import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getUserCount, getCachedUserCountSync, deleteUserPermanently, toggleUserBlock, adminResetPassword, updateUser, getAllUsers, getCorePhoneDigits } from '../services/authService';
import { ArrowLeft, School, Mail, Phone, Users, Search, RefreshCw, Edit, Trash2, Ban, UserCheck, Key, X, Save } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';

interface TeachersDirectoryProps {
  user: User;
  onBack: () => void;
}

export const TeachersDirectory: React.FC<TeachersDirectoryProps> = ({ user, onBack }) => {
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [visibleLimit, setVisibleLimit] = useState<number>(250);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalUsersCount, setTotalUsersCount] = useState<number>(() => getCachedUserCountSync() || 0);
  
  // Modals state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Load ALL registered schools in a single go
  const loadAllSchools = async (forceRefresh: boolean = false) => {
    setIsLoading(true);
    try {
      const all = await getAllUsers(forceRefresh);
      const cleanAll = all.filter(
        (u: User) => u && u.email !== 'admin' && u.email !== 'admin@aplusexamgen.com' && u.id !== 'local-admin'
      );
      setRegisteredUsers(cleanAll);
      setFilteredUsers(cleanAll);
      if (cleanAll.length > 0) {
        setTotalUsersCount(cleanAll.length);
      } else {
        const count = await getUserCount(forceRefresh);
        setTotalUsersCount(count);
      }
    } catch (e) {
      console.error("Failed to load all schools:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllSchools(false);
  }, []);

  const handleRefresh = async () => {
    await loadAllSchools(true);
  };

  const matchUser = (u: User, term: string) => {
    const name = (u.name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const mobile = (u.mobile || "").toLowerCase();
    const whatsapp = (u.whatsapp || "").toLowerCase();
    const instName = (u.instituteProfile?.instituteName || "").toLowerCase();
    const city = (u.instituteProfile?.city || "").toLowerCase();
    const address = (u.instituteProfile?.address || "").toLowerCase();
    const contact = (u.instituteProfile?.contactNumber || "").toLowerCase();

    if (
      name.includes(term) ||
      email.includes(term) ||
      mobile.includes(term) ||
      whatsapp.includes(term) ||
      instName.includes(term) ||
      city.includes(term) ||
      address.includes(term) ||
      contact.includes(term)
    ) {
      return true;
    }

    // Also match normalized phone digits (e.g. 0300 vs +92300 vs 300)
    const termDigits = getCorePhoneDigits(term);
    if (termDigits.length >= 4) {
      const mDigits = getCorePhoneDigits(u.mobile);
      const wDigits = getCorePhoneDigits(u.whatsapp);
      const cDigits = getCorePhoneDigits(u.instituteProfile?.contactNumber);
      if (
        mDigits.includes(termDigits) ||
        wDigits.includes(termDigits) ||
        cDigits.includes(termDigits)
      ) {
        return true;
      }
    }

    return false;
  };

  useEffect(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      setFilteredUsers(registeredUsers);
      return;
    }
    setFilteredUsers(registeredUsers.filter(u => matchUser(u, term)));
  }, [searchTerm, registeredUsers]);

  // Progressive rendering so all schools render smoothly without freezing the browser tab
  useEffect(() => {
    if (searchTerm.trim()) {
      setVisibleLimit(filteredUsers.length || 250);
      return;
    }
    setVisibleLimit(250);
  }, [filteredUsers.length, searchTerm]);

  useEffect(() => {
    if (isLoading || visibleLimit >= filteredUsers.length) return;
    const timer = setTimeout(() => {
      setVisibleLimit(prev => Math.min(filteredUsers.length, prev + 350));
    }, 60);
    return () => clearTimeout(timer);
  }, [isLoading, visibleLimit, filteredUsers.length]);

  const handleDelete = async (u: User) => {
    if (!window.confirm(`Are you sure you want to delete ${u.name}'s account permanently? This action cannot be undone.`)) return;
    setIsActionLoading(true);
    const success = await deleteUserPermanently(u.id);
    if (success) {
      setRegisteredUsers(prev => prev.filter(item => item.id !== u.id));
      setFilteredUsers(prev => prev.filter(item => item.id !== u.id));
      setTotalUsersCount(prev => Math.max(0, prev - 1));
      alert("User deleted successfully.");
    } else {
      alert("Failed to delete user.");
    }
    setIsActionLoading(false);
  };

  const handleToggleBlock = async (u: User) => {
    const nextStatus = !u.isBlocked;
    const actionLabel = nextStatus ? "Block" : "Unblock";
    if (!window.confirm(`Do you want to ${actionLabel} ${u.name}?`)) return;
    
    setIsActionLoading(true);
    const success = await toggleUserBlock(u.id, nextStatus);
    if (success) {
      setRegisteredUsers(prev => prev.map(item => item.id === u.id ? { ...item, isBlocked: nextStatus } : item));
      setFilteredUsers(prev => prev.map(item => item.id === u.id ? { ...item, isBlocked: nextStatus } : item));
      alert(`User ${actionLabel}ed successfully.`);
    } else {
      alert(`Failed to ${actionLabel} user.`);
    }
    setIsActionLoading(false);
  };

  const handleResetPassword = async () => {
    if (!resettingUser || !newPassword) return;
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    
    setIsActionLoading(true);
    const success = await adminResetPassword(resettingUser.id, newPassword);
    if (success) {
      alert(`Password for ${resettingUser.name} has been reset.`);
      setResettingUser(null);
      setNewPassword('');
    } else {
      alert("Failed to reset password.");
    }
    setIsActionLoading(false);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setIsActionLoading(true);
    try {
      await updateUser(editingUser);
      setRegisteredUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
      setFilteredUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
      alert("User profile updated.");
      setEditingUser(null);
    } catch (e) {
      alert("Failed to update profile.");
    }
    setIsActionLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans transition-colors duration-300">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={onBack} 
            className="text-gray-400 hover:text-gold-500 flex items-center transition-colors"
          >
            <ArrowLeft size={20} className="mr-1" /><span className="font-medium">Dashboard</span>
          </button>
          <div className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
            <Users className="text-gold-500" /> REGISTERED SCHOOL
          </div>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <input 
              type="text" 
              placeholder="Search schools by name, email, phone or institute..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-theme-text-main pl-10 pr-9 py-2.5 rounded-xl focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
            />
            <Search className="absolute left-3 top-3 text-gray-500" size={18} />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-3 text-gray-400 hover:text-white transition-colors p-0.5 rounded-full hover:bg-gray-700"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleRefresh} className="p-2 text-gold-500 hover:bg-gold-500/10 rounded-lg transition-colors" title="Refresh list">
               <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
            </button>
            <div className="text-xs text-theme-text-muted font-bold uppercase tracking-widest flex items-center gap-2">
              {searchTerm.trim() ? (
                <span>
                  <span className="text-gold-500 font-extrabold">{filteredUsers.length}</span> Found of {registeredUsers.length || totalUsersCount} Total
                </span>
              ) : (
                <span>{registeredUsers.length || totalUsersCount} Registered School{(registeredUsers.length || totalUsersCount) === 1 ? '' : 's'} Loaded</span>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-gray-800/80 border border-gray-700 rounded-2xl text-center py-20 px-6 flex flex-col items-center gap-4 shadow-xl">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-gray-700 border-t-gold-500 animate-spin" />
              <School className="absolute text-gold-500" size={24} />
            </div>
            <div className="space-y-1.5">
              <p className="text-theme-text-main font-extrabold uppercase tracking-widest text-sm">
                Loading All Registered Schools...
              </p>
              <p className="text-theme-text-muted text-xs">
                Please wait 3–5 seconds while all schools are fetched for instant search.
              </p>
            </div>
          </div>
        ) : (
          <div className="animate-fadeIn">
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
              {filteredUsers.length === 0 ? (
                <div className="p-16 text-center text-theme-text-muted">
                  {searchTerm.trim() ? (
                    <>
                      <p className="italic mb-2">No schools match "{searchTerm}".</p>
                      <button 
                        onClick={() => setSearchTerm('')} 
                        className="text-xs text-gold-500 hover:text-gold-400 font-semibold underline underline-offset-4"
                      >
                        Clear search filter
                      </button>
                    </>
                  ) : (
                    <div className="max-w-md mx-auto space-y-3">
                      <Users size={48} className="mx-auto text-gray-600 opacity-40 mb-2" />
                      <p className="font-bold text-gray-300">No registered schools found.</p>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Unable to load school directory from cloud database. If Google Firebase quota is reached (429), records will automatically populate once the Blaze plan is active or daily quota resets.
                      </p>
                      <button 
                        onClick={handleRefresh} 
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold-500/10 hover:bg-gold-500/20 text-gold-500 text-xs font-bold rounded-lg transition-colors border border-gold-500/30"
                      >
                        <RefreshCw size={14} /> Try Reloading
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-theme-text-muted">
                    <thead className="bg-gray-900/50 text-gold-500 uppercase text-xs font-bold border-b border-gray-700">
                      <tr>
                        <th className="px-6 py-4">Name / Institute</th>
                        <th className="px-6 py-4">Contact Details</th>
                        <th className="px-6 py-4">Location</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {filteredUsers.slice(0, visibleLimit).map((u, idx) => (
                        <tr key={u.id || idx} className={`hover:bg-gray-750/30 transition-colors ${u.isBlocked ? 'bg-red-900/5' : ''}`}>
                          <td className="px-6 py-4">
                            <div className={`font-bold text-theme-text-main text-base flex items-center gap-2 ${u.isBlocked ? 'text-gray-500 line-through' : ''}`}>
                              {u.name}
                              {u.isBlocked && <span className="bg-red-500/20 text-red-500 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-tighter no-underline [.light-theme_&]:bg-red-100 [.light-theme_&]:text-red-700 [.light-theme_&]:border-red-200">Blocked</span>}
                            </div>
                            <div className="text-xs text-theme-text-muted flex items-center gap-1 mt-0.5">
                              <School size={12} className="text-gold-500/50" />
                              {u.instituteProfile?.instituteName || "Profile not setup"}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-xs mb-1">
                              <Mail size={12} className="text-gold-500/50" /> 
                              {u.email}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Phone size={12} className="text-gold-500/50" /> 
                              {u.mobile}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-medium bg-gray-950/50 px-2 py-1 rounded border border-gray-700 text-theme-text-main">
                              {u.instituteProfile?.city || "Unknown City"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                               <button 
                                 onClick={() => setEditingUser(u)}
                                 className="p-1.5 bg-blue-900/20 text-blue-400 hover:bg-blue-500 hover:text-white rounded transition-all"
                                 title="Edit Profile"
                               >
                                 <Edit size={16} />
                               </button>
                               <button 
                                 onClick={() => setResettingUser(u)}
                                 className="p-1.5 bg-yellow-900/20 text-yellow-500 hover:bg-yellow-500 hover:text-white rounded transition-all"
                                 title="Reset Password"
                               >
                                 <Key size={16} />
                               </button>
                               <button 
                                 onClick={() => handleToggleBlock(u)}
                                 className={`p-1.5 rounded transition-all ${u.isBlocked ? 'bg-green-900/20 text-green-400 hover:bg-green-500 hover:text-white' : 'bg-orange-900/20 text-orange-400 hover:bg-orange-500 hover:text-white'}`}
                                 title={u.isBlocked ? "Unblock User" : "Block User"}
                               >
                                 {u.isBlocked ? <UserCheck size={16} /> : <Ban size={16} />}
                               </button>
                               <button 
                                 onClick={() => handleDelete(u)}
                                 className="p-1.5 bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white rounded transition-all"
                                 title="Delete Permanently"
                               >
                                 <Trash2 size={16} />
                               </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
           <div className="bg-gray-800 border border-gold-500/50 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-scaleIn">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-white uppercase tracking-wider">Edit School Profile</h3>
                 <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white"><X size={24} /></button>
              </div>
              <div className="space-y-4">
                 <Input label="Full Name" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                 <Input label="Email Address" type="email" value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
                 <Input label="Mobile Number" value={editingUser.mobile} onChange={e => setEditingUser({...editingUser, mobile: e.target.value})} />
                 <div className="border-t border-gray-700 pt-4">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Institute Information</p>
                    <Input label="Institute Name" value={editingUser.instituteProfile?.instituteName || ''} onChange={e => setEditingUser({
                        ...editingUser, 
                        instituteProfile: { ...editingUser.instituteProfile!, instituteName: e.target.value }
                    })} />
                    <Input label="City" value={editingUser.instituteProfile?.city || ''} onChange={e => setEditingUser({
                        ...editingUser, 
                        instituteProfile: { ...editingUser.instituteProfile!, city: e.target.value }
                    })} />
                 </div>
              </div>
              <div className="flex gap-3 mt-8">
                 <Button variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
                 <Button onClick={handleSaveEdit} isLoading={isActionLoading}><Save size={18} className="mr-2" /> Save Changes</Button>
              </div>
           </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
           <div className="bg-gray-800 border border-gold-500/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scaleIn">
              <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/30 [.light-theme_&]:bg-yellow-100 [.light-theme_&]:text-yellow-700 [.light-theme_&]:border-yellow-200">
                    <Key size={32} />
                 </div>
                 <h3 className="text-xl font-bold text-white uppercase">Reset Password</h3>
                 <p className="text-xs text-gray-400 mt-1">For: <span className="text-gold-500 font-bold">{resettingUser.name}</span></p>
              </div>
              <Input 
                label="New Password" 
                type="text" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                placeholder="Minimum 6 characters" 
                autoFocus
              />
              <p className="text-[9px] text-gray-500 italic mt-2">Note: Inform the user of their new password after resetting.</p>
              <div className="flex gap-3 mt-8">
                 <Button variant="secondary" onClick={() => { setResettingUser(null); setNewPassword(''); }}>Cancel</Button>
                 <Button onClick={handleResetPassword} isLoading={isActionLoading}>Reset Password</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
