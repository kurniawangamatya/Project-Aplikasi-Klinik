import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, handleFirestoreError, OperationType, limit } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import { Board, List, Card as CardType, UserProfile, CardTemplate, CardHistory, CardComment, ChecklistItem } from '../types';
import { Plus, MoreHorizontal, X, ArrowRight, ArrowLeft, Trash2, Edit3, DollarSign, Calendar, Paperclip, Link as LinkIcon, ExternalLink, Archive, Save, Layout, History, MessageSquare, Send, CheckSquare, Square, CheckCircle2, Circle, Maximize2, Minimize2, Check, GripVertical, Image as ImageIcon, Tag, Users, AlignLeft, Download, FileText, FileSpreadsheet, File, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_LABELS = [
  { id: '1', name: 'Urgent', color: 'bg-red-500' },
  { id: '2', name: 'Phase 1', color: 'bg-blue-500' },
  { id: '3', name: 'Review', color: 'bg-amber-500' },
  { id: '4', name: 'Completed', color: 'bg-emerald-500' },
  { id: '5', name: 'On Hold', color: 'bg-purple-500' },
  { id: '6', name: 'Low Priority', color: 'bg-zinc-500' },
];

export default function BoardView({ boardId }: { boardId: string }) {
  const { user, profile } = useAuth();
  const { boards, users, rolePermissions } = useData();
  const { theme } = useTheme();
  const canManageBoards = profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'PIC';
  const [lists, setLists] = useState<List[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [isAddingList, setIsAddingList] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [newListName, setNewListName] = useState('');

  const board = useMemo(() => boards.find(b => b.id === boardId) || null, [boards, boardId]);
  const [editedBoardName, setEditedBoardName] = useState(board?.name || '');

  useEffect(() => {
    if (board) setEditedBoardName(board.name);
  }, [board]);

  useEffect(() => {
    const listsQ = query(collection(db, 'boards', boardId, 'lists'), orderBy('order', 'asc'));
    const cardsQ = query(collection(db, 'boards', boardId, 'cards'), orderBy('order', 'asc'), limit(400));
    
    // Centralized Due Date Notification Watcher
    const checkDueDates = async (currentCards: CardType[]) => {
      const now = new Date().getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      const cardsToNotify = currentCards.filter(card => 
        card.dueDate && 
        card.assignedTo && 
        !card.dueDateNotificationSent && 
        card.status !== 'completed' && 
        !card.archived &&
        (new Date(card.dueDate).getTime() - now) <= twentyFourHours &&
        (new Date(card.dueDate).getTime() - now) > 0
      );

      if (cardsToNotify.length === 0) return;

      for (const card of cardsToNotify) {
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: card.assignedTo,
            message: `Deadline Reminder: "${card.title}" is due in less than 24 hours!`,
            cardId: card.id,
            read: false,
            createdAt: serverTimestamp()
          });
          await updateDoc(doc(db, 'boards', boardId, 'cards', card.id), {
            dueDateNotificationSent: true
          });
        } catch (e) {
          console.error('Due date notification error:', e);
        }
      }
    };

    const unsubLists = onSnapshot(listsQ, (snapshot) => {
      setLists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as List)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `boards/${boardId}/lists`);
    });

    const unsubCards = onSnapshot(cardsQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardType));
      setCards(data);
      // Run due date check whenever cards update (only for admin/owner)
      if (profile?.role === 'admin' || profile?.role === 'owner') {
        checkDueDates(data);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `boards/${boardId}/cards`);
    });

    const unsubTemplates = onSnapshot(collection(db, 'boards', boardId, 'templates'), (snapshot) => {
      setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardTemplate)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `boards/${boardId}/templates`);
    });

    return () => {
      unsubLists();
      unsubCards();
      unsubTemplates();
    };
  }, [boardId]);

  const handleAddList = async () => {
    if (!newListName.trim() || !canManageBoards) return;
    try {
      await addDoc(collection(db, 'boards', boardId, 'lists'), {
        name: newListName,
        boardId,
        order: lists.length,
        createdAt: serverTimestamp()
      });
      setNewListName('');
      setIsAddingList(false);
    } catch (e) {
      console.error(e);
    }
  };

  const [isEditingBoardName, setIsEditingBoardName] = useState(false);

  const allowedNavs = useMemo(() => {
    if (rolePermissions?.navigation) return rolePermissions.navigation;
    
    // Default fallbacks
    const defaults: Record<string, string[]> = {
      owner: ['board', 'clinic-boards', 'clinic-task-validate', 'analytics', 'doctor-report', 'nurse-report', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'settings'],
      admin: ['board', 'clinic-boards', 'clinic-task-validate', 'analytics', 'doctor-report', 'nurse-report', 'admin-report', 'team', 'finance', 'payroll', 'attendance', 'patient-data', 'settings'],
      keuangan: ['board', 'clinic-boards', 'finance', 'payroll', 'attendance', 'patient-data'],
      dokter: ['board', 'clinic-boards', 'doctor-report', 'attendance', 'patient-data'],
      perawat: ['board', 'clinic-boards', 'nurse-report', 'attendance', 'patient-data'],
      apoteker: ['board', 'clinic-boards', 'clinic-task-validate', 'attendance', 'patient-data'],
      media: ['board', 'clinic-boards', 'attendance'],
      PIC: ['board', 'clinic-boards', 'team', 'clinic-task-validate', 'attendance', 'patient-data', 'settings']
    };
    
    return profile?.role ? (defaults[profile.role] || ['board', 'clinic-boards']) : ['board', 'clinic-boards'];
  }, [rolePermissions, profile?.role]);

  const isAllowed = (navId: string) => allowedNavs.includes(navId);

  const updateBoardName = async () => {
    if (!editedBoardName.trim() || !board || !canManageBoards) return;
    try {
      await updateDoc(doc(db, 'boards', boardId), {
        name: editedBoardName
      });
      setIsEditingBoardName(false);
    } catch (e) {
      console.error(e);
    }
  };

  const financeStats = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return cards.reduce((acc, card) => {
      if (!card.amount || card.archived) return acc;
      
      const cardDate = card.updatedAt?.toDate ? card.updatedAt.toDate().getTime() : now.getTime();
      const amount = card.amount;
      const type = card.type || 'income';

      if (cardDate >= today) {
        if (type === 'income') acc.dailyIncome += amount;
        else acc.dailyExpense += amount;
      }

      if (cardDate >= thisMonth) {
        if (type === 'income') acc.monthlyIncome += amount;
        else acc.monthlyExpense += amount;
      }

      return acc;
    }, { dailyIncome: 0, dailyExpense: 0, monthlyIncome: 0, monthlyExpense: 0 });
  }, [cards]);

  const [showStats, setShowStats] = useState(false);

  const chartData = [
    { name: 'Harian', masuk: financeStats.dailyIncome, keluar: financeStats.dailyExpense },
    { name: 'Bulanan', masuk: financeStats.monthlyIncome, keluar: financeStats.monthlyExpense }
  ];

  const pieData = [
    { name: 'Pemasukan', value: financeStats.monthlyIncome, color: '#10b981' },
    { name: 'Pengeluaran', value: financeStats.monthlyExpense, color: '#ef4444' }
  ];

  const [isConfirmingDeleteBoard, setIsConfirmingDeleteBoard] = useState(false);

  const deleteBoard = async () => {
    if (!board || !canManageBoards) return;
    if (!confirm('Hapus papan ini beserta semua daftar dan kartunya?')) return;
    try {
      // 1. Delete all lists in this board
      const listsSnap = await getDocs(collection(db, 'boards', boardId, 'lists'));
      const listDeletes = listsSnap.docs.map(d => deleteDoc(doc(db, 'boards', boardId, 'lists', d.id)));
      await Promise.all(listDeletes);

      // 2. Delete all cards in this board
      const cardsSnap = await getDocs(collection(db, 'boards', boardId, 'cards'));
      const cardDeletes = cardsSnap.docs.map(d => deleteDoc(doc(db, 'boards', boardId, 'cards', d.id)));
      await Promise.all(cardDeletes);

      // 3. Delete all templates
      const templatesSnap = await getDocs(collection(db, 'boards', boardId, 'templates'));
      const templateDeletes = templatesSnap.docs.map(d => deleteDoc(doc(db, 'boards', boardId, 'templates', d.id)));
      await Promise.all(templateDeletes);

      // 4. Finally delete the board document itself
      await deleteDoc(doc(db, 'boards', boardId));
      window.location.reload();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `boards/${boardId}`);
    }
  };

  const moveList = async (newLists: List[]) => {
    if (!canManageBoards) return;
    setLists(newLists);
    try {
      const updates = newLists.map((l, i) => 
        updateDoc(doc(db, 'boards', boardId, 'lists', l.id), { order: i })
      );
      await Promise.all(updates);
    } catch (e) {
      console.error('Error reordering lists:', e);
    }
  };

  const moveCardInList = async (newCards: CardType[]) => {
    if (!canManageBoards) return;
    // This is tricky because filteredCards used in Reorder.Group is a subset.
    // However, Reorder.Group expects the full list of items it's managing.
    // Since we only reorder visible (non-archived) cards in a specific list:
    setCards(prev => {
      const otherCards = prev.filter(c => c.listId !== newCards[0]?.listId || c.archived);
      return [...otherCards, ...newCards].sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    try {
      const updates = newCards.map((c, i) => 
        updateDoc(doc(db, 'boards', boardId, 'cards', c.id), { order: i })
      );
      await Promise.all(updates);
    } catch (e) {
      console.error('Error reordering cards:', e);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-50 dark:bg-zinc-950">
      {/* Board Management Bar - Responsive */}
      {canManageBoards && (
        <div className="px-4 sm:px-8 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 sm:gap-8 overflow-hidden">
            <div className="flex items-center gap-3 overflow-hidden">
              {isEditingBoardName ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={editedBoardName}
                    onChange={e => setEditedBoardName(e.target.value)}
                    className="px-3 py-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && updateBoardName()}
                  />
                  <button onClick={updateBoardName} className="p-1 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/10 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setIsEditingBoardName(false)} className="p-1 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 overflow-hidden">
                  <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-widest uppercase truncate">{board?.name}</h1>
                  <button 
                    onClick={() => setIsEditingBoardName(true)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-6">
              <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-600 tracking-widest">List</span>
                <span className="text-sm font-mono font-black text-zinc-600 dark:text-zinc-400">{lists.length}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-600 tracking-widest">Aktif</span>
                <span className="text-sm font-mono font-black text-zinc-600 dark:text-zinc-400">{cards.filter(c => !c.archived).length}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <button 
              onClick={() => setShowStats(!showStats)}
              className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-lg",
                showStats ? "bg-blue-600 border-blue-500 text-white" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 shadow-zinc-200/50 dark:shadow-none"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">{showStats ? 'Tutup' : 'Statistik'}</span>
            </button>
            
            <button 
              onClick={() => setShowArchive(!showArchive)}
              className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-lg",
                showArchive ? "bg-zinc-700 border-zinc-600 text-white" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 shadow-zinc-200/50 dark:shadow-none"
              )}
            >
              <Archive className="w-4 h-4" />
              <span className="hidden sm:inline">Arsip</span>
            </button>

             {isConfirmingDeleteBoard ? (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                <button 
                  onClick={deleteBoard}
                  className="px-3 py-1 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-red-500 transition-all shadow-lg"
                >
                  Ya
                </button>
                <button 
                  onClick={() => setIsConfirmingDeleteBoard(false)}
                  className="px-3 py-1 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[10px] font-black uppercase hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all font-mono shadow-sm"
                >
                  X
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsConfirmingDeleteBoard(true)}
                className="p-2 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-500 rounded-xl hover:bg-red-500/20 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Dashboard - Responsive */}
      <AnimatePresence>
        {showStats && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white/50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 p-4 sm:p-8 max-w-7xl mx-auto">
              {/* Daily/Monthly Comparison */}
              <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl shadow-zinc-200/50 dark:shadow-none">
                <h3 className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-[0.2em] mb-6">Arus Kas</h3>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "#1f2937" : "#e5e7eb"} vertical={false} />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `Rp${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'dark' ? '#09090b' : '#ffffff', border: theme === 'dark' ? '1px solid #27272a' : '1px solid #e5e7eb', borderRadius: '12px', fontSize: '10px', color: theme === 'dark' ? '#fff' : '#000' }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                      <Bar dataKey="masuk" fill="#10b981" radius={[4, 4, 0, 0]} name="Pemasukan" />
                      <Bar dataKey="keluar" fill="#ef4444" radius={[4, 4, 0, 0]} name="Pengeluaran" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Ratio */}
              <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl shadow-zinc-200/50 dark:shadow-none">
                <h3 className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-[0.2em] mb-6">Rasio Bulanan</h3>
                <div className="h-48 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'dark' ? '#09090b' : '#ffffff', border: theme === 'dark' ? '1px solid #27272a' : '1px solid #e5e7eb', borderRadius: '12px', fontSize: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[8px] font-black uppercase text-zinc-400 dark:text-zinc-600">Total</span>
                    <span className="text-xs font-black text-zinc-900 dark:text-white">Rp{(financeStats.monthlyIncome + financeStats.monthlyExpense).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                <div className="bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-3xl flex flex-col justify-between shadow-sm">
                  <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-500/60 tracking-widest">Saldo Bersih Bulanan</span>
                  <div className="mt-2 text-xl sm:text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                    Rp {(financeStats.monthlyIncome - financeStats.monthlyExpense).toLocaleString()}
                  </div>
                </div>
                <div className="bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/20 p-5 rounded-3xl flex flex-col justify-between shadow-sm">
                  <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-500/60 tracking-widest">Transaksi Aktif</span>
                  <div className="mt-2 text-xl sm:text-2xl font-mono font-black text-blue-600 dark:text-blue-400">
                    {cards.filter(c => !c.archived && c.amount).length} <span className="text-xs uppercase font-sans text-blue-500/50">Unit</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Reorder.Group 
        axis="x" 
        values={lists} 
        onReorder={moveList}
        className="flex-1 overflow-x-auto p-4 sm:p-8 custom-scrollbar bg-zinc-50 dark:bg-zinc-950 pb-24 md:pb-8"
      >
        <div className="flex gap-4 sm:gap-8 items-start h-full min-w-full pb-8">
          {lists.map(list => (
            <Reorder.Item 
              key={list.id} 
              value={list}
              dragListener={canManageBoards}
              className="w-[85vw] sm:w-80 md:w-96 flex-shrink-0 touch-none"
            >
              <Column 
                list={list} 
                cards={cards.filter(c => c.listId === list.id && !c.archived)} 
                onReorderCards={moveCardInList}
                allLists={lists}
                users={users}
                templates={templates}
                canManage={canManageBoards}
                allowedNavs={allowedNavs}
                boardLabels={board?.labels || DEFAULT_LABELS}
                boardId={boardId}
              />
            </Reorder.Item>
          ))}

          {showArchive && (
            <div className="w-[85vw] sm:w-96 flex-shrink-0 flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Kartu Diarsipkan</h2>
              <button onClick={() => setShowArchive(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors">
                <X className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {cards.filter(c => c.archived).map(card => {
                const sourceList = lists.find(l => l.id === card.listId);
                return (
                  <div key={card.id} className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm text-zinc-900 dark:text-zinc-200 font-bold">{card.title}</span>
                        <span className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-600 tracking-widest">
                          Dari: {sourceList?.name || 'Daftar Tidak Diketahui'}
                        </span>
                      </div>
                      {canManageBoards && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={async () => {
                              await updateDoc(doc(db, 'boards', card.boardId, 'cards', card.id), { 
                                archived: false,
                                updatedAt: serverTimestamp()
                              });
                            }}
                            className="p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all shadow-sm"
                            title="Pulihkan Entitas"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={async () => {
                              if (confirm('Hapus permanen entitas yang diarsipkan ini?')) {
                                try {
                                  await deleteDoc(doc(db, 'boards', card.boardId, 'cards', card.id));
                                } catch (e) {
                                  handleFirestoreError(e, OperationType.DELETE, `boards/${card.boardId}/cards/${card.id}`);
                                }
                              }
                            }}
                            className="p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-500 transition-all"
                            title="Hapus Permanen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-600 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-900">
                      <Calendar className="w-3 h-3" />
                      <span className="italic">Diubah {card.updatedAt?.toDate ? card.updatedAt.toDate().toLocaleDateString() : 'Baru saja'}</span>
                    </div>
                  </div>
                );
              })}
              {cards.filter(c => c.archived).length === 0 && (
                <div className="text-center py-20">
                  <p className="text-zinc-300 dark:text-zinc-700 text-xs font-bold uppercase tracking-widest">Arsip Kosong</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add List Button */}
        <div className="w-[85vw] sm:w-80 flex-shrink-0">
          {isAddingList && canManageBoards ? (
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-2xl">
              <input
                autoFocus
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Judul Daftar..."
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                onKeyDown={(e) => e.key === 'Enter' && handleAddList()}
              />
              <div className="flex gap-2">
                <button 
                  onClick={handleAddList}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-xs shadow-lg shadow-blue-600/20"
                >
                  Buat Daftar
                </button>
                <button 
                  onClick={() => setIsAddingList(false)}
                  className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
          <div className="flex flex-col gap-4">
            {canManageBoards && (
              <button 
                onClick={() => setIsAddingList(true)}
                className="w-full flex items-center gap-3 p-5 bg-white dark:bg-zinc-900/20 hover:bg-zinc-100 dark:hover:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest text-[10px] group"
              >
                <div className="bg-zinc-50 dark:bg-zinc-800 p-1.5 rounded-lg group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
                Tambah Kolom
              </button>
            )}
            <button 
              onClick={() => setShowArchive(!showArchive)}
              className={cn(
                "w-full flex items-center gap-3 p-5 border border-dashed rounded-2xl transition-all font-bold uppercase tracking-widest text-[10px] group",
                showArchive 
                  ? "bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-500" 
                  : "bg-white dark:bg-zinc-900/20 hover:bg-zinc-100 dark:hover:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg transition-colors",
                showArchive ? "bg-amber-500 text-white" : "bg-zinc-50 dark:bg-zinc-800 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700"
              )}>
                <Archive className="w-4 h-4" />
              </div>
              {showArchive ? 'Tutup Arsip' : 'Lihat Arsip'}
            </button>
          </div>
          )}
        </div>
      </div>
    </Reorder.Group>
  </div>
  );
}

interface ColumnProps {
  list: List;
  cards: CardType[];
  onReorderCards: (newCards: CardType[]) => void;
  allLists: List[];
  users: UserProfile[];
  templates: CardTemplate[];
  canManage: boolean;
  allowedNavs: string[];
  boardLabels: { id: string; name: string; color: string }[];
  boardId: string;
}

const Column: React.FC<ColumnProps> = ({ list, cards, onReorderCards, allLists, users, templates, canManage, allowedNavs, boardLabels, boardId }) => {
  const { profile } = useAuth();
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardPriority, setNewCardPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newCardType, setNewCardType] = useState<'income' | 'expense'>('income');
  const [newCardLabels, setNewCardLabels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [newCardDueDate, setNewCardDueDate] = useState('');
  const [newCardChecklists, setNewCardChecklists] = useState<ChecklistItem[]>([]);
  const [newCardAssignedTo, setNewCardAssignedTo] = useState('');
  const [newCardAttachments, setNewCardAttachments] = useState<{ name: string; url: string; isCover?: boolean }[]>([]);
  const [activeCreationMenu, setActiveCreationMenu] = useState<'labels' | 'dates' | 'members' | 'checklist' | 'add' | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [dueDateFilter, setDueDateFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all');

  const handleCreationFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: { name: string; url: string; isCover?: boolean }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Firestore has a 1MB limit per document. We should keep base64 attachments reasonable.
      if (file.size > 600000) {
        alert(`File "${file.name}" is too large. Please select files smaller than 600KB (Base64 conversion increases size).`);
        continue;
      }

      const reader = new FileReader();
      const fileLoadPromise = new Promise<{ name: string; url: string }>((resolve) => {
        reader.onload = (event) => {
          resolve({
            name: file.name,
            url: event.target?.result as string
          });
        };
      });
      
      reader.readAsDataURL(file);
      const attachment = await fileLoadPromise;
      newAttachments.push(attachment);
    }

    setNewCardAttachments(prev => [...prev, ...newAttachments]);
    setActiveCreationMenu(null);
  };

  const filteredCards = cards.filter(card => {
    if (dueDateFilter === 'all') return true;
    if (!card.dueDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(card.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDateFilter === 'today') {
      return dueDate.getTime() === today.getTime();
    }

    if (dueDateFilter === 'overdue') {
      return dueDate.getTime() < today.getTime() && card.status !== 'completed';
    }

    if (dueDateFilter === 'week') {
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      return dueDate.getTime() >= today.getTime() && dueDate.getTime() <= nextWeek.getTime();
    }

    return true;
  });

  const handleAddCard = async () => {
    if (!newCardTitle.trim()) return;
    
    let cardData: any = {
      title: newCardTitle,
      listId: list.id,
      boardId: list.boardId,
      order: cards.length,
      description: '',
      status: 'pending',
      priority: newCardPriority,
      type: newCardType,
      labels: newCardLabels,
      dueDate: newCardDueDate,
      checklists: newCardChecklists,
      assignedTo: newCardAssignedTo,
      attachments: newCardAttachments,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        cardData = {
          ...cardData,
          description: template.description || '',
          priority: template.priority || newCardPriority,
          amount: template.amount || 0
        };
      }
    }

    try {
      await addDoc(collection(db, 'boards', list.boardId, 'cards'), cardData);
      setNewCardTitle('');
      setSelectedTemplate('');
      setNewCardLabels([]);
      setNewCardDueDate('');
      setNewCardChecklists([]);
      setNewCardAssignedTo('');
      setNewCardAttachments([]);
      setIsAddingCard(false);
    } catch (e) {
      console.error(e);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDeleteList, setIsConfirmingDeleteList] = useState(false);

  const deleteList = async () => {
    if (!canManage) return;
    setIsDeleting(true);
    try {
      // Deleting all cards in this list
      const deletePromises = cards.map(card => 
        deleteDoc(doc(db, 'boards', list.boardId, 'cards', card.id))
      );
      await Promise.all(deletePromises);
      
      // Finally delete the list
      await deleteDoc(doc(db, 'boards', list.boardId, 'lists', list.id));
      setIsConfirmingDeleteList(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `boards/${list.boardId}/lists/${list.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const isFinanceCol = (list.name || '').toLowerCase().includes('finance') || (list.name || '').toLowerCase().includes('keuangan');
  const isOwnerCol = (list.name || '').toLowerCase().includes('owner') || (list.name || '').toLowerCase().includes('approval');

  return (
    <div className="w-[85vw] sm:w-80 md:w-96 flex-shrink-0 flex flex-col max-h-full bg-white/60 dark:bg-zinc-900/30 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800/50 shadow-xl shadow-zinc-200/50 dark:shadow-none overflow-hidden group transition-all duration-300">
      <div className="p-6 flex flex-col gap-4 sticky top-0 bg-white/60 dark:bg-zinc-950/20 backdrop-blur-md z-10 transition-colors group-hover:bg-white/80 dark:group-hover:bg-zinc-900/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {canManage && (
              <div className="cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-800 hover:text-blue-500 transition-colors">
                <GripVertical className="w-3.5 h-3.5" />
              </div>
            )}
            <h3 className={cn(
              "text-[11px] font-black uppercase tracking-[0.2em]",
              isFinanceCol ? "text-emerald-600 dark:text-emerald-500" : isOwnerCol ? "text-purple-600 dark:text-purple-400" : "text-zinc-400 dark:text-zinc-500"
            )}>
              {list.name} <span className="ml-2 py-0.5 px-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full text-[10px] font-mono normal-case tracking-normal text-zinc-500 dark:text-zinc-400">{cards.length}</span>
            </h3>
          </div>
          {canManage && (
            <div className="flex items-center gap-1">
              {isConfirmingDeleteList ? (
                <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-200">
                   <button 
                    onClick={deleteList}
                    disabled={isDeleting}
                    className="p-1 px-2 bg-red-600 text-white rounded-md text-[9px] font-black uppercase tracking-tighter hover:bg-red-500 disabled:opacity-50"
                  >
                    {isDeleting ? '...' : 'Confirm'}
                  </button>
                  <button 
                    onClick={() => setIsConfirmingDeleteList(false)}
                    disabled={isDeleting}
                    className="p-1 px-2 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-md text-[9px] font-black uppercase tracking-tighter hover:bg-zinc-50"
                  >
                    X
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsConfirmingDeleteList(true)}
                  className="p-1.5 hover:bg-red-500/10 rounded-lg text-zinc-300 dark:text-zinc-800 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                  title="Delete Column"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {(['all', 'today', 'week', 'overdue'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDueDateFilter(f)}
              className={cn(
                "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all whitespace-nowrap",
                dueDateFilter === f 
                  ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20" 
                  : "bg-white dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-300"
              )}
            >
              {f === 'all' ? 'Semua' : f === 'today' ? 'Hari Ini' : f === 'week' ? 'Minggu Ini' : 'Terlambat'}
            </button>
          ))}
        </div>
      </div>

      <Reorder.Group 
        axis="y" 
        values={filteredCards} 
        onReorder={onReorderCards}
        className="px-4 pb-4 flex-1 overflow-y-auto space-y-4 custom-scrollbar"
      >
        {filteredCards.map(card => (
          <Reorder.Item 
            key={card.id} 
            value={card}
            dragListener={canManage}
          >
            <CardItem 
              card={card} 
              allLists={allLists} 
              users={users} 
              allowedNavs={allowedNavs}
              boardLabels={boardLabels}
              boardId={boardId}
            />
          </Reorder.Item>
        ))}
        
        {isAddingCard && (
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-600 tracking-widest pl-1 flex items-center gap-1.5">
                    <Layout className="w-3 h-3" />
                    Templat
                  </label>
                  <select 
                    value={selectedTemplate}
                    onChange={e => {
                      setSelectedTemplate(e.target.value);
                      const t = templates.find(temp => temp.id === e.target.value);
                      if (t) {
                        setNewCardTitle(t.title);
                        setNewCardPriority(t.priority as any || 'medium');
                      }
                    }}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">Tugas Kosong</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest pl-1 flex items-center gap-1.5">
                    Prioritas
                  </label>
                  <select 
                    value={newCardPriority}
                    onChange={e => setNewCardPriority(e.target.value as any)}
                    className={cn(
                      "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors",
                      newCardPriority === 'high' ? "text-red-500" : 
                      newCardPriority === 'medium' ? "text-yellow-500" : "text-zinc-500 dark:text-zinc-400"
                    )}
                  >
                    <option value="low">Rendah</option>
                    <option value="medium">Sedang</option>
                    <option value="high">Tinggi</option>
                  </select>
                </div>
              </div>
            
            <textarea
              autoFocus
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="Nama tugas..."
              className="w-full p-3 text-sm bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-xl border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
              rows={2}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAddCard())}
            />

            {/* Quick Access Action Bar */}
            <div className="flex flex-wrap gap-2 py-2">
              <label 
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[9px] font-black uppercase text-zinc-400 transition-all cursor-pointer",
                  newCardAttachments.length > 0 && "text-blue-500 border border-blue-500/30 bg-blue-500/5"
                )}
              >
                <Plus className="w-3.5 h-3.5" /> Add
                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  onChange={handleCreationFileChange}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
              </label>

              <div className="relative">
                <button 
                  onClick={() => setActiveCreationMenu(activeCreationMenu === 'labels' ? null : 'labels')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[9px] font-black uppercase text-zinc-400 transition-all",
                    newCardLabels.length > 0 && "text-blue-400 border border-blue-500/30 bg-blue-500/5",
                    activeCreationMenu === 'labels' && "bg-zinc-700"
                  )}
                >
                  <Tag className="w-3.5 h-3.5" /> Labels
                </button>
                <AnimatePresence>
                  {activeCreationMenu === 'labels' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-3 flex flex-col gap-1"
                    >
                      <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-2 px-1">Pilih Label</div>
                      {boardLabels.map(label => {
                        const isSelected = newCardLabels.some(l => l.id === label.id);
                        return (
                          <button
                            key={label.id}
                            onClick={() => {
                              if (isSelected) {
                                setNewCardLabels(prev => prev.filter(l => l.id !== label.id));
                              } else {
                                setNewCardLabels(prev => [...prev, label]);
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold transition-all",
                              isSelected ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn("w-3 h-3 rounded-full", label.color)} />
                              {label.name}
                            </div>
                            {isSelected && <Check className="w-3 h-3 text-emerald-500" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button 
                  onClick={() => setActiveCreationMenu(activeCreationMenu === 'dates' ? null : 'dates')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[9px] font-black uppercase text-zinc-400 transition-all",
                    newCardDueDate && "text-amber-400 border border-amber-500/30 bg-amber-500/5",
                    activeCreationMenu === 'dates' && "bg-zinc-700"
                  )}
                >
                  <Calendar className="w-3.5 h-3.5" /> Dates
                </button>
                <AnimatePresence>
                  {activeCreationMenu === 'dates' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-4"
                    >
                      <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-3">Tenggat Waktu</div>
                      <input 
                        type="date"
                        value={newCardDueDate}
                        onChange={e => setNewCardDueDate(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button 
                  onClick={() => {
                    if (newCardChecklists.length === 0) {
                      setNewCardChecklists([{ id: Math.random().toString(36).substr(2, 9), text: 'Tugas Baru', completed: false }]);
                    }
                    setActiveCreationMenu(activeCreationMenu === 'checklist' ? null : 'checklist');
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[9px] font-black uppercase text-zinc-400 transition-all",
                    newCardChecklists.length > 0 && "text-emerald-400 border border-emerald-500/30 bg-emerald-500/5",
                    activeCreationMenu === 'checklist' && "bg-zinc-700"
                  )}
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Checklist
                </button>
                <AnimatePresence>
                  {activeCreationMenu === 'checklist' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-3"
                    >
                      <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-3">Daftar Tugas</div>
                      <div className="space-y-2 mb-3">
                        {newCardChecklists.map((item, idx) => (
                          <div key={item.id} className="flex items-center gap-2">
                             <input 
                               value={item.text}
                               onChange={(e) => {
                                 const newList = [...newCardChecklists];
                                 newList[idx].text = e.target.value;
                                 setNewCardChecklists(newList);
                               }}
                               className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-white focus:outline-none"
                             />
                             <button onClick={() => setNewCardChecklists(prev => prev.filter(i => i.id !== item.id))}>
                               <X className="w-3 h-3 text-zinc-600" />
                             </button>
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={() => setNewCardChecklists(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), text: '', completed: false }])}
                        className="w-full py-1.5 border border-dashed border-zinc-800 rounded text-[10px] text-zinc-500 hover:border-zinc-600 transition-colors"
                      >
                        + Tambah Item
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button 
                  onClick={() => setActiveCreationMenu(activeCreationMenu === 'members' ? null : 'members')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[9px] font-black uppercase text-zinc-400 transition-all",
                    newCardAssignedTo && "text-purple-400 border border-purple-500/30 bg-purple-500/5",
                    activeCreationMenu === 'members' && "bg-zinc-700"
                  )}
                >
                  <Users className="w-3.5 h-3.5" /> Members
                </button>
                <AnimatePresence>
                  {activeCreationMenu === 'members' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-3"
                    >
                      <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-3">Tugaskan</div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {users.map(u => (
                          <button
                            key={u.uid}
                            onClick={() => setNewCardAssignedTo(u.uid === newCardAssignedTo ? '' : u.uid)}
                            className={cn(
                              "flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-[10px] transition-all",
                              newCardAssignedTo === u.uid ? "bg-zinc-800 text-white" : "text-zinc-500 hover:bg-zinc-800/50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=random`} alt="" className="w-5 h-5 rounded-full" />
                              {u.displayName}
                            </div>
                            {newCardAssignedTo === u.uid && <Check className="w-3 h-3 text-blue-500" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Display active selections summary */}
            {(newCardLabels.length > 0 || newCardDueDate || newCardChecklists.length > 0 || newCardAttachments.length > 0) && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {newCardLabels.map(l => (
                  <div key={l.id} className={cn("w-4 h-1 rounded-full", l.color)} />
                ))}
                {newCardDueDate && <div className="text-[8px] text-amber-500 font-bold uppercase">{new Date(newCardDueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</div>}
                {newCardChecklists.length > 0 && <div className="text-[8px] text-emerald-500 font-bold uppercase">{newCardChecklists.length} items</div>}
                {newCardAttachments.length > 0 && (
                  <div className="flex items-center gap-1 text-[8px] text-blue-500 font-bold uppercase">
                    <Paperclip className="w-2.5 h-2.5" />
                    {newCardAttachments.length} files
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button 
                onClick={handleAddCard}
                className="flex-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs font-bold"
              >
                Buat
              </button>
              <button 
                onClick={() => setIsAddingCard(false)}
                className="p-1.5 text-zinc-500 hover:bg-zinc-800 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Reorder.Group>

      <div className="p-4 bg-zinc-100/50 dark:bg-zinc-900/20">
        {!isAddingCard && (
          <button 
            onClick={() => setIsAddingCard(true)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 bg-white dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all group/btn shadow-sm"
          >
            <Plus className="w-4 h-4 text-zinc-400 dark:text-zinc-600 group-hover/btn:text-blue-500 transition-colors" />
            Tambah Entitas
          </button>
        )}
      </div>
    </div>
  );
}

interface CardItemProps {
  card: CardType;
  allLists: List[];
  users: UserProfile[];
  allowedNavs: string[];
  boardLabels: { id: string; name: string; color: string }[];
  boardId: string;
}

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{'list': 'ordered'}, {'list': 'bullet'}],
    ['link', 'clean']
  ],
};

const CardItem: React.FC<CardItemProps> = ({ card, allLists, users, allowedNavs, boardLabels, boardId }) => {
  const { user, profile } = useAuth();
  const isAllowed = (navId: string) => allowedNavs.includes(navId);
  const [isEditing, setIsEditing] = useState(false);
  
  const coverImage = card.attachments?.find(att => att.isCover) || 
                     card.attachments?.find(att => 
                       att.url.startsWith('data:image/') || 
                       att.name.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i)
                     );

  const [editedTitle, setEditedTitle] = useState(card.title);
  const [editedDescription, setEditedDescription] = useState(card.description || '');
  const [editedAmount, setEditedAmount] = useState(card.amount || 0);
  const [editedAssignedTo, setEditedAssignedTo] = useState(card.assignedTo || '');
  const [editedPriority, setEditedPriority] = useState(card.priority || 'medium');
  const [editedStatus, setEditedStatus] = useState(card.status);
  const [editedDueDate, setEditedDueDate] = useState(card.dueDate || '');
  const [editedAttachments, setEditedAttachments] = useState<{ name: string; url: string; isCover?: boolean }[]>(card.attachments || []);
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [showImageActions, setShowImageActions] = useState(false);
  const [cardActiveImgIdx, setCardActiveImgIdx] = useState<number>(0);
  const imgAttachments = useMemo(() => {
    return card.attachments?.filter(att => 
      att.url.startsWith('data:image/') || 
      att.name?.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i)
    ) || [];
  }, [card.attachments]);

  useEffect(() => {
    if (cardActiveImgIdx >= imgAttachments.length) {
      setCardActiveImgIdx(0);
    }
  }, [imgAttachments.length, cardActiveImgIdx]);

  const [previewImage, setPreviewImage] = useState<{ url: string; name: string; idx: number } | null>(null);
  const [editedType, setEditedType] = useState<'income' | 'expense'>(card.type || 'income');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isConfirmingArchive, setIsConfirmingArchive] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'history' | 'comments'>('edit');
  const [history, setHistory] = useState<CardHistory[]>([]);
  const [comments, setComments] = useState<CardComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editedChecklists, setEditedChecklists] = useState<ChecklistItem[]>(card.checklists || []);
  const [newChecklistItemText, setNewChecklistItemText] = useState('');
  const [editedLabels, setEditedLabels] = useState<{ id: string; name: string; color: string }[]>(card.labels || []);
  const [activeMenu, setActiveMenu] = useState<'labels' | 'dates' | 'members' | 'checklist' | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState('');

  const updateBoardLabel = async (labelId: string, newName: string) => {
    if (!newName.trim()) return;
    const updatedBoardLabels = boardLabels.map(l => 
      l.id === labelId ? { ...l, name: newName } : l
    );
    try {
      await updateDoc(doc(db, 'boards', boardId), {
        labels: updatedBoardLabels
      });
      setEditingLabelId(null);
      setEditedLabels(prev => prev.map(l => l.id === labelId ? { ...l, name: newName } : l));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      const q = query(
        collection(db, 'boards', card.boardId, 'cards', card.id, 'history'),
        orderBy('createdAt', 'desc')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardHistory)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `boards/${card.boardId}/cards/${card.id}/history`);
      });
      return () => unsub();
    }
    if (activeTab === 'comments') {
      const q = query(
        collection(db, 'boards', card.boardId, 'cards', card.id, 'comments'),
        orderBy('createdAt', 'asc')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardComment)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `boards/${card.boardId}/cards/${card.id}/comments`);
      });
      return () => unsub();
    }
  }, [activeTab, card.boardId, card.id]);
  
  const logHistory = async (changeType: string, previousValue?: string, newValue?: string) => {
    try {
      await addDoc(collection(db, 'boards', card.boardId, 'cards', card.id, 'history'), {
        userId: user?.uid,
        userName: profile?.displayName || user?.email,
        changeType,
        previousValue: previousValue || '',
        newValue: newValue || '',
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error('History log error:', e);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    try {
      const commentData = {
        userId: user?.uid,
        userName: profile?.displayName || user?.email,
        text: newComment,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'boards', card.boardId, 'cards', card.id, 'comments'), commentData);
      
      await notifyMentions(newComment, '', true);

      setNewComment('');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `boards/${card.boardId}/cards/${card.id}/comments`);
    }
  };

  const assigneeProfile = users.find(m => m.uid === card.assignedTo);

  const moveCard = async (direction: 'left' | 'right') => {
    const currentIndex = allLists.findIndex(l => l.id === card.listId);
    let nextIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    
    if (nextIndex >= 0 && nextIndex < allLists.length) {
      const nextList = allLists[nextIndex];
      const prevListName = allLists[currentIndex].name;
      try {
        await updateDoc(doc(db, 'boards', card.boardId, 'cards', card.id), {
          listId: nextList.id,
          updatedAt: serverTimestamp(),
          lastModifiedBy: user?.uid
        });

        await logHistory('move', prevListName, nextList.name);

        await addDoc(collection(db, 'notifications'), {
          userId: card.assignedTo || profile?.uid,
          message: `${profile?.displayName} moved "${card.title}" → ${nextList.name}`,
          cardId: card.id,
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const addChecklistItem = () => {
    if (!newChecklistItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: newChecklistItemText,
      completed: false
    };
    setEditedChecklists([...editedChecklists, newItem]);
    setNewChecklistItemText('');
  };

  const toggleChecklistItem = (id: string) => {
    setEditedChecklists(editedChecklists.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const removeChecklistItem = (id: string) => {
    setEditedChecklists(editedChecklists.filter(item => item.id !== id));
  };

  const archiveCard = async () => {
    try {
      await updateDoc(doc(db, 'boards', card.boardId, 'cards', card.id), {
        archived: true,
        updatedAt: serverTimestamp(),
        lastModifiedBy: user?.uid
      });
      await logHistory('archive', 'Active', 'Archived');
    } catch (e) {
      console.error(e);
    }
  };

  const saveAsTemplate = async () => {
    try {
      await addDoc(collection(db, 'boards', card.boardId, 'templates'), {
        title: card.title,
        description: card.description || '',
        priority: card.priority || 'medium',
        amount: card.amount || 0,
        createdAt: serverTimestamp()
      });
      alert('Template saved!');
    } catch (e) {
      console.error(e);
    }
  };

  const [isDeletingCard, setIsDeletingCard] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: { name: string; url: string; isCover?: boolean }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Firestore has a 1MB limit per document. We should keep base64 attachments reasonable.
      if (file.size > 600000) { 
        alert(`File "${file.name}" is too large. Please select files smaller than 600KB.`);
        continue;
      }

      const reader = new FileReader();
      const fileLoadPromise = new Promise<{ name: string; url: string }>((resolve) => {
        reader.onload = (event) => {
          resolve({
            name: file.name,
            url: event.target?.result as string
          });
        };
      });
      
      reader.readAsDataURL(file);
      const attachment = await fileLoadPromise;
      newAttachments.push(attachment);
    }

    setEditedAttachments(prev => [...prev, ...newAttachments]);
  };

  const deleteCard = async () => {
    setIsDeletingCard(true);
    try {
      await deleteDoc(doc(db, 'boards', card.boardId, 'cards', card.id));
      setIsConfirmingDelete(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `boards/${card.boardId}/cards/${card.id}`);
    } finally {
      setIsDeletingCard(false);
    }
  };

  const duplicateCard = async () => {
    try {
      const { id, ...cardData } = card;
      const duplicatedData = {
        ...cardData,
        title: `${card.title} (Copy)`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastModifiedBy: user?.uid,
        status: 'pending',
        order: (card.order || 0) + 0.1 // Place it near the original
      };
      
      await addDoc(collection(db, 'boards', card.boardId, 'cards'), duplicatedData);
      alert('Card duplicated!');
    } catch (e) {
      console.error('Duplication error:', e);
    }
  };

  const notifyMentions = async (newText: string, oldText: string, isComment: boolean = false) => {
    const mentionRegex = /@(\w+)/g;
    
    const getMentionedKeys = (text: string) => {
      const keys = new Set<string>();
      // Strip HTML for cleaner mention detection
      const textContent = text.replace(/<[^>]*>/g, ' ');
      const matches = textContent.matchAll(mentionRegex);
      for (const match of matches) {
        keys.add(match[1].toLowerCase());
      }
      return keys;
    };

    const newKeys = getMentionedKeys(newText);
    const oldKeys = getMentionedKeys(oldText);

    for (const targetUser of users) {
      const nameKey = targetUser.displayName.toLowerCase().replace(/\s+/g, '');
      if (newKeys.has(nameKey) && !oldKeys.has(nameKey) && targetUser.uid !== user?.uid) {
        try {
          const actionText = isComment ? 'mentioned you in a comment on' : 'mentioned you in';
          await addDoc(collection(db, 'notifications'), {
            userId: targetUser.uid,
            message: `${profile?.displayName || user?.displayName || 'Someone'} ${actionText} card: "${card.title}"`,
            cardId: card.id,
            boardId: card.boardId,
            read: false,
            createdAt: serverTimestamp()
          });
        } catch (e) {
          console.error("Mention notification error:", e);
        }
      }
    }
  };

  const coverImageInModal = editedAttachments.find(att => att.isCover) || 
                            editedAttachments.find(att => 
                              att.url.startsWith('data:image/') || 
                              att.name.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i)
                            );
  
  const combinedActivity = [
    ...comments.map(c => ({ ...c, type: 'comment' as const })),
    ...history.map(h => ({ ...h, type: 'history' as const }))
  ].sort((a, b) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return dateB - dateA;
  });

  const toggleCover = (idx: number) => {
    setEditedAttachments(prev => prev.map((att, i) => ({
      ...att,
      isCover: i === idx ? !att.isCover : false
    })));
  };

  const updateCard = async () => {
    try {
      const isKeuangan = profile?.role === 'keuangan';
      
      const updateData: any = {
        amount: editedAmount,
        type: editedType,
        status: editedStatus,
        updatedAt: serverTimestamp(),
        lastModifiedBy: user?.uid
      };

      if (!isKeuangan) {
        updateData.title = editedTitle;
        updateData.description = editedDescription;
        updateData.assignedTo = editedAssignedTo;
        updateData.priority = editedPriority;
        updateData.dueDate = editedDueDate;
        updateData.attachments = editedAttachments;
        updateData.checklists = editedChecklists;
        updateData.labels = editedLabels;
      }

      await updateDoc(doc(db, 'boards', card.boardId, 'cards', card.id), updateData);

      // Log history only for changed fields
      if (editedStatus !== card.status) await logHistory('status', card.status, editedStatus);
      if (editedAmount !== (card.amount || 0)) await logHistory('amount', card.amount?.toString(), editedAmount.toString());
      
      if (!isKeuangan) {
        if (editedTitle !== card.title) await logHistory('title', card.title, editedTitle);
        if (editedDescription !== (card.description || '')) await logHistory('description', 'Modified', 'Modified');
        if (editedAssignedTo !== (card.assignedTo || '')) {
          const prevAssignee = users.find(u => u.uid === card.assignedTo)?.displayName || 'Unassigned';
          const newAssignee = users.find(u => u.uid === editedAssignedTo)?.displayName || 'Unassigned';
          await logHistory('assignee', prevAssignee, newAssignee);
        }
        if (editedPriority !== (card.priority || 'medium')) await logHistory('priority', card.priority, editedPriority);
        if (editedDueDate !== (card.dueDate || '')) await logHistory('dueDate', card.dueDate, editedDueDate);
      }

      setIsEditing(false);
    } catch (e) {
      console.error(e);
    }
  };

  const isKeuangan = profile?.role === 'keuangan';
  const isFinance = profile?.role === 'keuangan' || profile?.role === 'admin';
  const isOwner = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'PIC';
  const canUpdateStatus = isOwner || isKeuangan;
  const isAdmin = profile?.role === 'admin';
  const isDokter = profile?.role === 'dokter';
  const isPIC = profile?.role === 'PIC';
  const isApoteker = profile?.role === 'apoteker';
  const isMedia = profile?.role === 'media';
  const listName = allLists.find(l => l.id === card.listId)?.name.toLowerCase() || '';
  const isSpecialCol = listName.includes('finance') || listName.includes('review') || listName.includes('owner') || listName.includes('approval');

  const updateStatus = async (newStatus: string) => {
    if (!canUpdateStatus && card.assignedTo !== user?.uid) return;
    if (newStatus === 'completed' && !isAllowed('clinic-task-validate')) return;
    try {
      const prevStatus = card.status;
      await updateDoc(doc(db, 'boards', card.boardId, 'cards', card.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        lastModifiedBy: user?.uid
      });

      await logHistory('status', prevStatus, newStatus);

      // Notify relevant role
      let targetRole: string = 'admin';
      if (newStatus === 'reviewed') targetRole = 'owner';
      if (newStatus === 'completed') targetRole = 'keuangan';

      await addDoc(collection(db, 'notifications'), {
        userId: card.assignedTo || profile?.uid,
        message: `Status Update: "${card.title}" is now ${newStatus.toUpperCase()}`,
        cardId: card.id,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
    <motion.div 
      layout
      onClick={() => setIsEditing(true)}
      className={cn(
        "rounded-[2.5rem] border shadow-xl group transition-all relative overflow-hidden cursor-pointer flex flex-col",
        (card.status === 'completed' || card.status === 'approved')
          ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40" 
          : "bg-red-500/5 border-red-500/20 hover:border-red-500/40",
        isSpecialCol && "ring-1 ring-white/5"
      )}
    >
      {imgAttachments.length > 0 && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setShowImageActions(true);
          }}
          className="w-full bg-zinc-50 dark:bg-zinc-950/40 p-3 border-b border-zinc-100 dark:border-white/5 shrink-0 flex flex-col gap-2"
        >
          {/* Main Display of Active Image */}
          <div className="relative h-48 w-full rounded-2xl overflow-hidden bg-zinc-900 group-hover:bg-zinc-950 transition-colors">
            <img 
              src={imgAttachments[cardActiveImgIdx || 0]?.url || imgAttachments[0].url} 
              alt={card.title} 
              className="w-full h-full object-contain hover:scale-102 transition-all duration-300"
              referrerPolicy="no-referrer"
            />
            {/* Image index overlay indicator */}
            <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-xl text-[9px] font-black text-white tracking-wider flex items-center gap-1.5 border border-white/5">
              <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
              {imgAttachments.length} FOTO
            </div>
          </div>

          {/* Multiple image thumbnails strip */}
          {imgAttachments.length > 1 && (
            <div 
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
              onClick={(e) => e.stopPropagation()} // Stop edit modal click
            >
              {imgAttachments.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCardActiveImgIdx(idx)}
                  className={cn(
                    "w-12 h-12 rounded-xl overflow-hidden border bg-zinc-900 transition-all shrink-0 relative",
                    (cardActiveImgIdx === idx || (idx === 0 && cardActiveImgIdx === undefined))
                      ? "border-blue-500 scale-95 ring-2 ring-blue-500/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700"
                  )}
                >
                  <img src={img.url} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="p-6 flex flex-col h-full justify-between gap-5 flex-1">
        {/* Top Header: Metadata and Actions */}
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {(profile?.role === 'admin' || profile?.role === 'owner') && (
              <div 
                className="cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-800 hover:text-blue-500 transition-colors p-0.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4" />
              </div>
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              {canUpdateStatus ? (
                <select 
                  value={card.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateStatus(e.target.value)}
                  className={cn(
                    "px-2 px-1 text-[9px] font-black uppercase rounded-lg border cursor-pointer outline-none transition-all shadow-sm shrink-0",
                    card.status === 'completed' || card.status === 'approved'
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/20"
                      : card.status === 'pending'
                        ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800/80"
                        : "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-500 hover:bg-blue-500/20"
                  )}
                >
                  <option value="pending" className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans text-xs">PENDING</option>
                  <option value="review" className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans text-xs">REVIEW</option>
                  <option value="approved" className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans text-xs">APPROVED</option>
                  <option value="completed" className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans text-xs">COMPLETED</option>
                </select>
              ) : (
                <span className={cn(
                  "px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border shrink-0 tracking-wider",
                  card.status === 'completed' || card.status === 'approved' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20 shadow-sm" : 
                  card.status === 'pending' ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 shadow-sm" : "bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20"
                )}>
                  {card.status}
                </span>
              )}

              {card.priority && (
                <span className={cn(
                  "px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border shrink-0 tracking-wider",
                  card.priority === 'high' 
                    ? "bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/20 shadow-sm" 
                    : card.priority === 'medium' 
                      ? "bg-yellow-500/10 text-amber-600 dark:text-yellow-500 border-yellow-500/20 shadow-sm" 
                      : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 shadow-sm"
                )}>
                  {card.priority}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-950/40 p-1 rounded-[1.25rem] border border-zinc-200 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 shadow-lg dark:shadow-none">
               <button 
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateCard();
                }}
                className="p-2 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded-[1rem] text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="Duplicate"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-[1rem] text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-500/5 transition-colors border border-blue-200 dark:border-blue-500/10"
                title="Edit"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              {(isAdmin || isOwner) && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsConfirmingDelete(true);
                  }}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-[1rem] text-zinc-400 dark:text-zinc-600 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content: Title */}
        <div className="py-2 flex flex-col gap-2">
          {card.labels && card.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {card.labels.map(l => (
                <span 
                  key={l.id} 
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider text-white shadow-sm flex items-center gap-1 shrink-0", 
                    l.color
                  )}
                >
                  <Tag className="w-3 h-3" />
                  {l.name}
                </span>
              ))}
            </div>
          )}
          <h3 className="text-xl text-zinc-900 dark:text-zinc-100 font-bold tracking-tight leading-tight">{card.title}</h3>
          {card.description && (
             <div 
               className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 prose prose-zinc dark:prose-invert max-w-none"
               dangerouslySetInnerHTML={{ __html: card.description }}
             />
           )}
        </div>

        {/* Bottom Bar: Meta and Nav */}
        <div className="mt-auto pt-6 flex items-center justify-between border-t border-zinc-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                moveCard('left');
              }}
              className="p-3 bg-zinc-50 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-400 dark:text-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-300 transition-all shadow-sm focus:ring-2 ring-blue-500/20"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                moveCard('right');
              }}
              className="p-3 bg-zinc-50 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-400 dark:text-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-300 transition-all shadow-sm focus:ring-2 ring-blue-500/20"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-600 font-bold text-[10px] tracking-widest uppercase opacity-80 bg-zinc-100/50 dark:bg-zinc-950/40 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/5 shadow-inner">
            <Calendar className="w-3.5 h-3.5" />
            {card.createdAt?.toDate ? card.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </motion.div>
      
      <AnimatePresence>
        {isEditing && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
            onClick={() => setIsEditing(false)}
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-5xl my-auto overflow-hidden flex flex-col shadow-2xl relative z-10 cursor-default"
            >
              {/* Cover Image Header */}
              {coverImageInModal && (
                <div className="h-48 w-full bg-zinc-950 relative">
                  <img 
                    src={coverImageInModal.url} 
                    className="w-full h-full object-cover opacity-80"
                    alt="Cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent" />
                </div>
              )}

              {/* Modal Toolbar */}
              <div className="p-6 pb-2 flex items-start justify-between">
                <div className="flex-1">
                   <div className="flex items-center gap-3 mb-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <h2 className="text-2xl font-black text-white tracking-tight">{editedTitle}</h2>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-zinc-500 uppercase tracking-widest font-black ml-9">
                    <span>Di list <span className="text-zinc-300 underline underline-offset-4">{allLists.find(l => l.id === card.listId)?.name}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-4">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10">
                  {/* Left Column */}
                  <div className="space-y-10">
                    {/* Action Bar */}
                    <div className="flex flex-wrap gap-3 relative">
                       <label className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] font-black uppercase text-zinc-300 transition-all cursor-pointer">
                        <Plus className="w-4 h-4" /> Add
                        <input type="file" multiple className="hidden" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                      </label>
                      
                      <div className="relative">
                        <button 
                          onClick={() => setActiveMenu(activeMenu === 'labels' ? null : 'labels')}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] font-black uppercase text-zinc-300 transition-all",
                            activeMenu === 'labels' && "ring-2 ring-blue-500 bg-zinc-700"
                          )}
                        >
                          <Tag className="w-4 h-4" /> Labels
                        </button>
                        <AnimatePresence>
                          {activeMenu === 'labels' && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute top-full left-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-3 flex flex-col gap-1"
                            >
                              <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-2 px-1">Pilih Label</div>
                              {boardLabels.map(label => {
                                const isSelected = editedLabels.some(l => l.id === label.id);
                                const isEditing = editingLabelId === label.id;

                                return (
                                  <div key={label.id} className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1 group/label">
                                      {isEditing ? (
                                        <div className="flex-1 flex flex-col gap-1 p-2 bg-zinc-800 rounded-lg">
                                          <input 
                                            type="text"
                                            value={editingLabelName}
                                            onChange={e => setEditingLabelName(e.target.value)}
                                            autoFocus
                                            className="w-full bg-zinc-950 text-[10px] font-bold text-white px-2 py-1 rounded border border-zinc-700 outline-none"
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') updateBoardLabel(label.id, editingLabelName);
                                              if (e.key === 'Escape') setEditingLabelId(null);
                                            }}
                                          />
                                          <div className="flex justify-end gap-1">
                                            <button 
                                              onClick={() => setEditingLabelId(null)}
                                              className="p-1 text-[8px] font-bold text-zinc-500 hover:text-white"
                                            >
                                              Batal
                                            </button>
                                            <button 
                                              onClick={() => updateBoardLabel(label.id, editingLabelName)}
                                              className="px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest rounded hover:bg-blue-500"
                                            >
                                              Simpan
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => {
                                              if (isSelected) {
                                                setEditedLabels(prev => prev.filter(l => l.id !== label.id));
                                              } else {
                                                setEditedLabels(prev => [...prev, label]);
                                              }
                                            }}
                                            className={cn(
                                              "flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold transition-all",
                                              isSelected ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50"
                                            )}
                                          >
                                            <div className="flex items-center gap-2">
                                              <div className={cn("w-3 h-3 rounded-full", label.color)} />
                                              {label.name}
                                            </div>
                                            {isSelected && <Check className="w-3 h-3 text-emerald-500" />}
                                          </button>
                                          <button 
                                            onClick={() => {
                                              setEditingLabelId(label.id);
                                              setEditingLabelName(label.name);
                                            }}
                                            className="p-2 text-zinc-600 hover:text-blue-500 opacity-0 group-hover/label:opacity-100 transition-all"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="relative">
                        <button 
                          onClick={() => setActiveMenu(activeMenu === 'dates' ? null : 'dates')}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] font-black uppercase text-zinc-300 transition-all",
                            activeMenu === 'dates' && "ring-2 ring-blue-500 bg-zinc-700"
                          )}
                        >
                          <Calendar className="w-4 h-4" /> Dates
                        </button>
                        <AnimatePresence>
                          {activeMenu === 'dates' && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute top-full left-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-4"
                            >
                              <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-3">Patuhi Tenggat Waktu</div>
                              <input 
                                type="date"
                                value={editedDueDate}
                                onChange={e => setEditedDueDate(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none"
                              />
                              <div className="mt-3 flex justify-end">
                                <button 
                                  onClick={() => setActiveMenu(null)}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-500"
                                >
                                  Simpan
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="relative">
                        <button 
                          onClick={() => {
                            if (editedChecklists.length === 0) {
                              setEditedChecklists([{ id: Math.random().toString(36).substr(2, 9), text: 'Tugas Baru', completed: false }]);
                            }
                            setActiveMenu(activeMenu === 'checklist' ? null : 'checklist');
                          }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] font-black uppercase text-zinc-300 transition-all",
                            activeMenu === 'checklist' && "ring-2 ring-blue-500 bg-zinc-700"
                          )}
                        >
                          <CheckSquare className="w-4 h-4" /> Checklist
                        </button>
                      </div>

                      <div className="relative">
                        <button 
                          onClick={() => setActiveMenu(activeMenu === 'members' ? null : 'members')}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] font-black uppercase text-zinc-300 transition-all",
                            activeMenu === 'members' && "ring-2 ring-blue-500 bg-zinc-700"
                          )}
                        >
                          <Users className="w-4 h-4" /> Members
                        </button>
                        <AnimatePresence>
                          {activeMenu === 'members' && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute top-full right-0 lg:left-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-3"
                            >
                              <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mb-3 px-1">Tugaskan Anggota</div>
                              <div className="space-y-1">
                                {users.map((u, uIdx) => (
                                  <button
                                    key={`${u.uid}-${uIdx}`}
                                    onClick={() => setEditedAssignedTo(u.uid)}
                                    className={cn(
                                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-[11px] transition-all",
                                      editedAssignedTo === u.uid ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-6 h-6 rounded-lg overflow-hidden border border-zinc-800">
                                        <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=random`} alt="" className="w-full h-full object-cover" />
                                      </div>
                                      {u.displayName}
                                    </div>
                                    {editedAssignedTo === u.uid && <Check className="w-3.5 h-3.5 text-blue-500" />}
                                  </button>
                                ))}
                                <button
                                  onClick={() => setEditedAssignedTo('')}
                                  className="w-full px-3 py-2 text-[10px] font-black uppercase text-zinc-600 hover:text-zinc-400 text-left"
                                >
                                  Unassign
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Labels Display */}
                    {editedLabels.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest ml-9">Active Labels</div>
                        <div className="flex flex-wrap gap-2 ml-9">
                          {editedLabels.map((label, lIdx) => (
                            <button
                              key={`${label.id}-${lIdx}`}
                              onClick={() => setEditedLabels(prev => prev.filter(l => l.id !== label.id))}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black text-white hover:opacity-80 transition-opacity",
                                label.color
                              )}
                            >
                              {boardLabels.find(bl => bl.id === label.id)?.name || label.name}
                              <X className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Description Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <AlignLeft className="w-5 h-5 text-zinc-500" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-300">Description</h3>
                      </div>
                      <div className={cn("rich-text-editor ml-8", isKeuangan && "opacity-50 pointer-events-none")}>
                        <ReactQuill 
                          theme="snow"
                          value={editedDescription}
                          onChange={setEditedDescription}
                          modules={quillModules}
                          placeholder="Add a more detailed description..."
                          readOnly={isKeuangan}
                        />
                      </div>
                    </div>

                    {/* Attachments Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-zinc-300">
                          <Paperclip className="w-5 h-5 text-zinc-500" />
                          <h3 className="text-sm font-black uppercase tracking-widest">Attachments</h3>
                        </div>
                        <label className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] font-black uppercase text-zinc-300 transition-all cursor-pointer">
                          Add
                          <input type="file" multiple className="hidden" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                        </label>
                      </div>
                      <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {editedAttachments.map((att, idx) => {
                           const isImage = att.url.startsWith('data:image/') || att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                           return (
                            <div key={idx} className="flex gap-4 group">
                              <div 
                                className="w-24 h-16 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 cursor-pointer"
                                onClick={() => isImage && setPreviewImage({ url: att.url, name: att.name, idx })}
                              >
                                {isImage ? (
                                  <img src={att.url} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-zinc-800">
                                    <Paperclip className="w-6 h-6" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 flex flex-col justify-center">
                                <span 
                                  className={cn("text-[13px] font-bold text-zinc-200 truncate", isImage && "cursor-pointer hover:underline")}
                                  onClick={() => isImage && setPreviewImage({ url: att.url, name: att.name, idx })}
                                >
                                  {att.name}
                                </span>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px] text-zinc-600">Added {card.updatedAt?.toDate().toLocaleDateString()}</span>
                                  {isImage && (
                                    <button 
                                      onClick={() => toggleCover(idx)}
                                      className={cn(
                                        "text-[10px] font-black uppercase tracking-widest transition-colors",
                                        att.isCover ? "text-emerald-500" : "text-zinc-600 hover:text-zinc-400"
                                      )}
                                    >
                                      {att.isCover ? '✓ Cover' : 'Cover'}
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => setEditedAttachments(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-red-500 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                           );
                        })}
                      </div>
                    </div>

                    {/* Checklist Section */}
                    {editedChecklists.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-zinc-300">
                            <CheckSquare className="w-5 h-5 text-zinc-500" />
                            <h3 className="text-sm font-black uppercase tracking-widest">Checklist</h3>
                          </div>
                          <button 
                            onClick={() => setIsConfirmingDelete(true)}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] font-black uppercase text-zinc-300 transition-all"
                          >
                            Delete
                          </button>
                        </div>
                        <div className="ml-8 space-y-4">
                           <div className="flex items-center gap-3">
                             <span className="text-[11px] font-black text-zinc-500 w-8">
                               {Math.round((editedChecklists.filter(i => i.completed).length / editedChecklists.length) * 100)}%
                             </span>
                             <div className="h-2 flex-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                               <motion.div 
                                 initial={false}
                                 animate={{ width: `${(editedChecklists.filter(i => i.completed).length / editedChecklists.length) * 100}%` }}
                                 className="h-full bg-blue-500"
                               />
                             </div>
                           </div>
                           <div className="space-y-2">
                             {editedChecklists.map((item, cIdx) => (
                               <div key={`${item.id}-${cIdx}`} className="flex items-center gap-3 group">
                                 <button 
                                   onClick={() => toggleChecklistItem(item.id)}
                                   className={cn(
                                     "w-5 h-5 rounded border flex items-center justify-center transition-all",
                                     item.completed ? "bg-blue-600 border-blue-600" : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                                   )}
                                 >
                                   {item.completed && <Check className="w-3.5 h-3.5 text-white" />}
                                 </button>
                                 <span className={cn(
                                   "flex-1 text-sm font-medium transition-all",
                                   item.completed ? "text-zinc-600 line-through" : "text-zinc-200"
                                 )}>
                                   {item.text}
                                 </span>
                               </div>
                             ))}
                           </div>
                           <div className="flex gap-2">
                              <input 
                                type="text"
                                value={newChecklistItemText}
                                onChange={e => setNewChecklistItemText(e.target.value)}
                                placeholder="Add an item"
                                className="flex-1 px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-600"
                                onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
                              />
                           </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Activity */}
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-zinc-300">
                          <MessageSquare className="w-5 h-5 text-zinc-500" />
                          <h3 className="text-sm font-black uppercase tracking-widest">Activity</h3>
                        </div>
                        <button 
                          onClick={() => setShowActivityDetails(!showActivityDetails)}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-black uppercase text-zinc-500 transition-all"
                        >
                          {showActivityDetails ? 'Hide details' : 'Show details'}
                        </button>
                      </div>

                      <div className="space-y-6">
                        {/* New Comment Input */}
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-black text-white text-[10px] shadow-lg shadow-blue-900/20">
                            {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="flex-1 space-y-2">
                            <textarea 
                              value={newComment}
                              onChange={e => setNewComment(e.target.value)}
                              placeholder="Write a comment..."
                              className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-600 resize-none shadow-inner"
                              rows={1}
                            />
                            {newComment.trim() && (
                              <button 
                                onClick={addComment}
                                className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-500 transition-all shadow-lg"
                              >
                                Save
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Activity List */}
                        <div className="space-y-6">
                          {combinedActivity.map((item: any) => {
                            const itemKey = `${item.type}-${item.id}`;
                            if (item.type === 'comment') {
                               return (
                                <div key={itemKey} className="flex gap-3">
                                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-black text-zinc-500 text-[10px]">
                                    {item.userName?.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-black text-zinc-200">{item.userName}</span>
                                      <span className="text-[9px] text-zinc-600 font-mono">
                                        {item.createdAt?.toDate().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <div className="bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-xl">
                                      <p className="text-[13px] text-zinc-300 leading-relaxed">{item.text}</p>
                                    </div>
                                  </div>
                                </div>
                               );
                            } else if (showActivityDetails) {
                               return (
                                <div key={itemKey} className="flex gap-3">
                                  <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-black text-zinc-700 text-[10px]">
                                    {item.userName?.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                                      <span className="font-bold text-zinc-300">{item.userName}</span> 
                                      {' '}{item.changeType} 
                                      {item.previousValue ? ` from ${item.previousValue} to ${item.newValue}` : ` this card`}
                                    </p>
                                    <span className="text-[9px] text-zinc-600 font-mono">
                                      {item.createdAt?.toDate().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                               );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-zinc-800 space-y-4">
                      <button 
                        onClick={updateCard}
                        className="w-full py-3 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20"
                      >
                        Commit Changes
                      </button>
                      <div className="grid grid-cols-1 gap-2 text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                        <button onClick={() => setIsConfirmingArchive(true)} className="flex items-center gap-2 p-2 hover:bg-zinc-800 rounded transition-colors text-amber-500">
                          <Archive className="w-3.5 h-3.5" /> Archive Card
                        </button>
                        <button onClick={saveAsTemplate} className="flex items-center gap-2 p-2 hover:bg-zinc-800 rounded transition-colors text-emerald-500">
                          <Save className="w-3.5 h-3.5" /> Save Template
                        </button>
                        <button onClick={() => setIsConfirmingDelete(true)} className="flex items-center gap-2 p-2 hover:bg-zinc-800 rounded transition-colors text-red-500">
                          <Trash2 className="w-3.5 h-3.5" /> Delete Card
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isConfirmingDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="bg-red-500/20 p-3 rounded-full mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h4 className="text-sm font-black uppercase tracking-widest text-zinc-100 mb-2">Delete Entity?</h4>
            <p className="text-[11px] text-zinc-400 mb-6 leading-relaxed">
              This action is permanent and will remove all audit logs associated with <span className="text-zinc-200 font-bold">"{card.title}"</span>.
            </p>
            <div className="flex gap-2 w-full">
              <button 
                onClick={deleteCard}
                disabled={isDeletingCard}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
              >
                {isDeletingCard ? 'Processing...' : 'Confirm'}
              </button>
              <button 
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isDeletingCard}
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
              >
                Abort
              </button>
            </div>
          </motion.div>
        )}

        {isConfirmingArchive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="bg-amber-500/20 p-3 rounded-full mb-4">
              <Archive className="w-8 h-8 text-amber-500" />
            </div>
            <h4 className="text-sm font-black uppercase tracking-widest text-zinc-100 mb-2">Archive Entity?</h4>
            <p className="text-[11px] text-zinc-400 mb-6 leading-relaxed">
              Move <span className="text-zinc-200 font-bold">"{card.title}"</span> to storage? It will be removed from this board but can be restored later.
            </p>
            <div className="flex gap-2 w-full">
              <button 
                onClick={() => {
                  archiveCard();
                  setIsConfirmingArchive(false);
                  setIsEditing(false);
                }}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-amber-900/20"
              >
                Archive
              </button>
              <button 
                onClick={() => setIsConfirmingArchive(false)}
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
              >
                Abort
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewImage && (
          <div 
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 cursor-pointer"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-950/95 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-2xl flex flex-col items-center cursor-default"
            >
              <div className="w-full aspect-[4/5] md:aspect-square bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 mb-8">
                <img 
                  src={previewImage.url} 
                  className="w-full h-full object-contain" 
                  alt={previewImage.name} 
                />
              </div>

              <div className="text-center space-y-1 mb-8">
                <h3 className="text-2xl font-black text-white tracking-tight">{previewImage.name}</h3>
                <p className="text-sm text-zinc-500 font-bold">
                  Added {card.updatedAt?.toDate().toLocaleString()} • {(previewImage.url.length / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                <a 
                  href={previewImage.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-widest border border-zinc-800 transition-all font-sans"
                >
                  <ExternalLink className="w-4 h-4" /> Open in new tab
                </a>
                <a 
                  href={previewImage.url} 
                  download={previewImage.name}
                  className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-widest border border-zinc-800 transition-all font-sans"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
                <button 
                  onClick={() => {
                    toggleCover(previewImage.idx);
                    setPreviewImage(null);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-widest border border-zinc-800 transition-all font-sans"
                >
                  <ImageIcon className="w-4 h-4" /> {editedAttachments[previewImage.idx]?.isCover ? 'Remove cover' : 'Set as cover'}
                </button>
                <button 
                  onClick={() => {
                    if (confirm('Delete this attachment?')) {
                      setEditedAttachments(prev => prev.filter((_, i) => i !== previewImage.idx));
                      setPreviewImage(null);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-red-500 rounded-xl text-xs font-black uppercase tracking-widest border border-zinc-800 transition-all font-sans"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>

              <button 
                onClick={() => setPreviewImage(null)}
                className="absolute -top-12 right-0 p-2 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-8 h-8" />
              </button>
            </motion.div>
          </div>
        )}

        {showImageActions && imgAttachments.length > 0 && (
          <div 
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 cursor-pointer"
            onClick={() => setShowImageActions(false)}
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-950/90 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row shadow-2xl cursor-default"
            >
              {/* Left Column: Big active image display with arrows */}
              <div className="flex-1 bg-black/60 relative flex flex-col items-center justify-center p-6 border-b md:border-b-0 md:border-r border-zinc-800 h-[50vh] md:h-[70vh]">
                <div className="w-full h-full flex items-center justify-center relative">
                  <img 
                    src={imgAttachments[cardActiveImgIdx || 0]?.url || imgAttachments[0].url} 
                    className="max-w-full max-h-full object-contain rounded-xl select-none" 
                    alt={card.title} 
                  />
                  
                  {/* Next / Prev Navigations inside the image */}
                  {imgAttachments.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const prevIdx = (cardActiveImgIdx - 1 + imgAttachments.length) % imgAttachments.length;
                          setCardActiveImgIdx(prevIdx);
                        }}
                        className="absolute left-4 p-3 bg-zinc-900/80 hover:bg-zinc-800 text-white rounded-full transition-colors border border-white/5 shadow-xl hover:scale-105 transition-all"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextIdx = (cardActiveImgIdx + 1) % imgAttachments.length;
                          setCardActiveImgIdx(nextIdx);
                        }}
                        className="absolute right-4 p-3 bg-zinc-900/80 hover:bg-zinc-800 text-white rounded-full transition-colors border border-white/5 shadow-xl hover:scale-105 transition-all"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Subtitle count indicator */}
                <span className="absolute bottom-4 left-6 text-xs text-zinc-500 font-mono font-bold truncate max-w-[200px]">
                  {imgAttachments[cardActiveImgIdx || 0]?.name || `Photo ${(cardActiveImgIdx || 0) + 1}`}
                </span>
                <span className="absolute bottom-4 right-6 text-xs text-zinc-500 font-mono font-bold">
                  {(cardActiveImgIdx || 0) + 1} / {imgAttachments.length}
                </span>
              </div>

              {/* Right Column: Metadata, actions & all uploaded images list */}
              <div className="w-full md:w-[380px] p-8 flex flex-col justify-between bg-zinc-950/40 overflow-y-auto max-h-[40vh] md:max-h-[70vh]">
                <div className="space-y-6">
                  {/* Status header */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black tracking-widest text-[#2563eb] bg-blue-500/10 px-3 py-1 rounded-full">
                      {card.status || 'Tugas'}
                    </span>
                    <button 
                      onClick={() => setShowImageActions(false)}
                      className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Title and stats */}
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white tracking-tight leading-snug">{card.title}</h3>
                    {card.amount ? (
                      <p className="text-sm font-black text-emerald-500 font-mono">
                        Rp {card.amount.toLocaleString('id-ID')}
                      </p>
                    ) : null}
                  </div>

                  {/* Uploaded images list block */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-500" /> Semua Foto Terunggah ({imgAttachments.length})
                    </h4>
                    
                    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto no-scrollbar p-0.5">
                      {imgAttachments.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCardActiveImgIdx(idx)}
                          className={cn(
                            "aspect-square rounded-xl overflow-hidden border bg-zinc-950 transition-all shrink-0 relative",
                            (cardActiveImgIdx === idx)
                              ? "border-blue-500 ring-2 ring-blue-500/20"
                              : "border-zinc-800 hover:border-zinc-700"
                          )}
                        >
                          <img src={img.url} className="w-full h-full object-cover" alt="" />
                          <div className="absolute top-1 left-1 bg-black/75 rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold text-white border border-white/5">
                            {idx + 1}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Operations */}
                <div className="pt-6 border-t border-zinc-800 space-y-3 mt-6">
                  <button 
                    onClick={() => {
                      setShowImageActions(false);
                      setIsEditing(true);
                    }}
                    className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                  >
                    <Edit3 className="w-4 h-4" /> Edit & Tambah Foto
                  </button>
                  <a 
                    href={imgAttachments[cardActiveImgIdx || 0]?.url || imgAttachments[0].url} 
                    download={imgAttachments[cardActiveImgIdx || 0]?.name || "gambar.jpg"}
                    className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-zinc-700/50"
                  >
                    <Download className="w-4 h-4" /> Download Gambar Ini
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
