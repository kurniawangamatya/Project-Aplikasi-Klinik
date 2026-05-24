import React, { useState, useEffect, useRef } from 'react';
import { db, collectionGroup, query, where, getDocs, collection, limit } from '../lib/firebase';
import { Card, Board, UserProfile } from '../types';
import { Search as SearchIcon, Loader2, X, FileText, Filter, LayoutDashboard, User, Calendar, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Search() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter States
  const [selectedBoardId, setSelectedBoardId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all'); // all, overdue, soon, thisMonth

  // Data for filters
  const [boards, setBoards] = useState<Board[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const boardsSnap = await getDocs(collection(db, 'boards'));
        setBoards(boardsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as any)));
        
        const usersSnap = await getDocs(collection(db, 'users'));
        setUsers(usersSnap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as any) } as any)));
      } catch (e) {
        console.error("Failed to fetch filter data", e);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2 || selectedBoardId !== 'all' || selectedStatus !== 'all' || selectedAssignee !== 'all' || dateRange !== 'all') {
        setIsSearching(true);
        try {
          const q = query(collectionGroup(db, 'cards'), limit(200));
          const querySnapshot = await getDocs(q);
          const allCards = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as any));
          
          const filtered = allCards.filter(card => {
            const matchesSearch = searchTerm.length < 2 || 
              card.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
              card.description.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesBoard = selectedBoardId === 'all' || card.boardId === selectedBoardId;
            const matchesStatus = selectedStatus === 'all' || card.status === selectedStatus;
            const matchesAssignee = selectedAssignee === 'all' || card.assignedTo === selectedAssignee;
            
            let matchesDate = true;
            if (dateRange !== 'all' && card.dueDate) {
              const dueDate = new Date(card.dueDate);
              const now = new Date();
              if (dateRange === 'overdue') {
                matchesDate = dueDate < now;
              } else if (dateRange === 'soon') {
                const soon = new Date();
                soon.setDate(soon.getDate() + 3);
                matchesDate = dueDate >= now && dueDate <= soon;
              } else if (dateRange === 'thisMonth') {
                matchesDate = dueDate.getMonth() === now.getMonth() && dueDate.getFullYear() === now.getFullYear();
              }
            } else if (dateRange !== 'all' && !card.dueDate) {
              matchesDate = false;
            }

            return matchesSearch && matchesBoard && matchesStatus && matchesAssignee && matchesDate;
          });
          
          setResults(filtered.slice(0, 50)); // Show more results with filters
        } catch (e) {
          console.error("Search failed", e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedBoardId, selectedStatus, selectedAssignee, dateRange]);

  const statuses = ['Pending Approval', 'Approved', 'In Review', 'Completed', 'Rejected'];
  const statusTranslations: Record<string, string> = {
    'pending': 'Tertunda',
    'review': 'Ulasan',
    'approved': 'Disetujui',
    'completed': 'Selesai',
    'rejected': 'Ditolak',
    'Pending Approval': 'Menunggu Persetujuan',
    'Approved': 'Disetujui',
    'In Review': 'Dalam Ulasan',
    'Completed': 'Selesai',
    'Rejected': 'Ditolak'
  };

  return (
    <div className="relative" ref={searchRef}>
      <div className="flex items-center gap-2">
        <div className="relative group">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Cari kartu..."
            className="w-64 bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 animate-spin" />
          )}
        </div>
        
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-xl border transition-all ${
            showFilters || selectedBoardId !== 'all' || selectedStatus !== 'all' || selectedAssignee !== 'all' || dateRange !== 'all'
              ? 'bg-blue-600 border-blue-500 text-white' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (searchTerm.length >= 2 || showFilters) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 w-[480px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Filters Section */}
            {showFilters && (
              <div className="p-4 bg-zinc-950/50 border-b border-zinc-800 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <LayoutDashboard className="w-3 h-3" /> Papan
                  </label>
                  <select 
                    value={selectedBoardId}
                    onChange={(e) => setSelectedBoardId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-1.5 px-3 text-[10px] font-bold text-zinc-300 focus:outline-none"
                  >
                    <option value="all">Semua Papan</option>
                    {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" /> Status
                  </label>
                  <select 
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-1.5 px-3 text-[10px] font-bold text-zinc-300 focus:outline-none"
                  >
                    <option value="all">Semua Status</option>
                    {statuses.map(s => <option key={s} value={s}>{statusTranslations[s] || s}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <User className="w-3 h-3" /> Penerima Tugas
                  </label>
                  <select 
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-1.5 px-3 text-[10px] font-bold text-zinc-300 focus:outline-none"
                  >
                    <option value="all">Semua Penerima</option>
                    <option value="unassigned">Belum Ditugaskan</option>
                    {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Tenggat Waktu
                  </label>
                  <select 
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-1.5 px-3 text-[10px] font-bold text-zinc-300 focus:outline-none"
                  >
                    <option value="all">Kapan Saja</option>
                    <option value="overdue">Terlambat</option>
                    <option value="soon">Tenggat 3 Hari</option>
                    <option value="thisMonth">Tenggat Bulan Ini</option>
                  </select>
                </div>
              </div>
            )}

            <div className="p-3 border-b border-zinc-800 bg-zinc-950/20 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {results.length} hasil ditemukan
              </span>
              {(selectedBoardId !== 'all' || selectedStatus !== 'all' || selectedAssignee !== 'all' || dateRange !== 'all') && (
                <button 
                  onClick={() => {
                    setSelectedBoardId('all');
                    setSelectedStatus('all');
                    setSelectedAssignee('all');
                    setDateRange('all');
                  }}
                  className="text-[9px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest"
                >
                  Hapus Filter
                </button>
              )}
            </div>
            
            <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
              {results.length === 0 && !isSearching ? (
                <div className="p-8 text-center text-zinc-600">
                  <p className="text-xs font-bold uppercase tracking-widest">Tidak ada rekaman yang cocok ditemukan</p>
                </div>
              ) : (
                results.map(card => (
                  <button
                    key={card.id}
                    onClick={() => {
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className="w-full p-3 rounded-xl hover:bg-zinc-800 flex items-start gap-3 text-left transition-all group"
                  >
                    <div className="p-2 bg-zinc-950 rounded-lg group-hover:bg-zinc-900 transition-colors shrink-0">
                      <FileText className="w-4 h-4 text-zinc-500 group-hover:text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-100 mb-1 truncate">{card.title}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-tighter shrink-0">Status: {statusTranslations[card.status] || card.status}</span>
                        {card.amount && (
                          <span className="text-[9px] font-mono text-emerald-500 font-bold shrink-0">Rp {card.amount.toLocaleString()}</span>
                        )}
                        {card.dueDate && (
                          <span className={`text-[9px] font-mono shrink-0 ${new Date(card.dueDate) < new Date() ? 'text-red-500' : 'text-zinc-500'}`}>
                            Tenggat: {new Date(card.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
