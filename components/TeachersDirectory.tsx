
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getAllUsers } from '../services/authService';
import { ArrowLeft, School, Mail, Phone, Users, Search, RefreshCw } from 'lucide-react';

interface TeachersDirectoryProps {
  user: User;
  onBack: () => void;
}

export const TeachersDirectory: React.FC<TeachersDirectoryProps> = ({ user, onBack }) => {
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    const users = await getAllUsers();
    const cleanUsers = users.filter(u => u.email !== 'admin' && u.email !== 'admin@aplusexamgen.com');
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
              className="w-full bg-gray-800 border border-gray-700 text-white pl-10 pr-4 py-2.5 rounded-xl focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
            />
            <Search className="absolute left-3 top-3 text-gray-500" size={18} />
          </div>
          <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">
            {filteredUsers.length} Teachers Found
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-gold-500" size={32} />
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Fetching Directory...</p>
          </div>
        ) : (
          <div className="animate-fadeIn">
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
              {filteredUsers.length === 0 ? (
                <div className="p-16 text-center text-gray-500 italic">No teachers match your search.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-gray-900/50 text-gold-500 uppercase text-xs font-bold border-b border-gray-700">
                      <tr>
                        <th className="px-6 py-4">Name / Institute</th>
                        <th className="px-6 py-4">Contact Details</th>
                        <th className="px-6 py-4">Location</th>
                        <th className="px-6 py-4">Joined Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-750 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white text-base">{u.name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
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
                            <span className="text-xs font-medium bg-gray-900/50 px-2 py-1 rounded border border-gray-700">
                              {u.instituteProfile?.city || "Unknown City"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono">
                            {new Date(u.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
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
    </div>
  );
};
