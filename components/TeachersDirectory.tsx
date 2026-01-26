
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getAllUsers, deleteUserPermanently, toggleUserBlock, adminResetPassword, updateUser } from '../services/authService';
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
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    const users = await getAllUsers();
    // Exclude admins from the list to avoid self-deletion or blocking
    const cleanUsers = users.filter(u => u.email !== 'admin' && u.email !== 'admin@aplusexamgen.com' && u.id !== 'local-admin');
    setRegisteredUsers(cleanUsers);
    setFilteredUsers(cleanUsers);
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredUsers(registeredUsers.filter(u => 
      u.name.toLowerCase().includes(term) || 
      u.email.toLowerCase().includes(term) ||
      u.mobile.includes(term) ||
      (u.instituteProfile?.instituteName || "").toLowerCase().includes(term) ||
      (u.instituteProfile?.city || "").toLowerCase().includes(term)
    ));
  }, [searchTerm, registeredUsers]);

  const handleDelete = async (u: User) => {
    if (!window.confirm(`Are you sure you want to delete ${u.name}'s account permanently? This action cannot be undone.`)) return;
    setIsActionLoading(true);
    const success = await deleteUserPermanently(u.id);
    if (success) {
      setRegisteredUsers(prev => prev.filter(item => item.id !== u.id));
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
            <Users className="text-gold-500" /> TEACHERS DIRECTORY
          </div>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <input 
              type="text" 
              placeholder="Search teachers by name, email, phone or institute..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-theme-text-main pl-10 pr-4 py-2.5 rounded-xl focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
            />
            <Search className="absolute left-3 top-3 text-gray-500" size={18} />
          </div>
          <div className="flex items-center gap-4">
            <button onClick={loadUsers} className="p-2 text-gold-500 hover:bg-gold-500/10 rounded-lg transition-colors" title="Refresh list">
               <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
            </button>
            <div className="text-xs text-theme-text-muted font-bold uppercase tracking-widest">
              {filteredUsers.length} Teachers Found
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-gold-500" size={32} />
            <p className="text-theme-text-muted font-bold uppercase tracking-widest text-xs">Fetching Directory...</p>
          </div>
        ) : (
          <div className="animate-fadeIn">
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
              {filteredUsers.length === 0 ? (
                <div className="p-16 text-center text-theme-text-muted italic">No teachers match your search.</div>
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
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className={`hover:bg-gray-750/30 transition-colors ${u.isBlocked ? 'bg-red-900/5' : ''}`}>
                          <td className="px-6 py-4">
                            <div className={`font-bold text-theme-text-main text-base flex items-center gap-2 ${u.isBlocked ? 'text-gray-500 line-through' : ''}`}>
                              {u.name}
                              {u.isBlocked && <span className="bg-red-500/20 text-red-500 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-tighter no-underline">Blocked</span>}
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
                 <h3 className="text-xl font-bold text-white uppercase tracking-wider">Edit Teacher Profile</h3>
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
                 <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/30">
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
