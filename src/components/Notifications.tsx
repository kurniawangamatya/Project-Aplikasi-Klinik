import React, { useEffect, useState } from 'react';
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, handleFirestoreError, OperationType, limit } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Notification } from '../types';
import { Bell, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    try {
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'notifications/all');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-xl hover:bg-zinc-800 relative transition-all border border-transparent hover:border-zinc-700"
      >
        <Bell className="w-5 h-5 text-zinc-400 group-hover:text-zinc-100" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-black animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
               className="fixed inset-0 z-40" 
               onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-80 bg-zinc-900 rounded-[2rem] shadow-2xl border border-zinc-800 z-50 overflow-hidden"
            >
              <div className="p-5 border-b border-zinc-800/50 bg-zinc-900/50 flex flex-col gap-2.5 backdrop-blur-sm">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-100">Aktivitas Langsung</h3>
                  <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-500 font-mono italic">{unreadCount} baru</span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="w-full text-center py-2 bg-zinc-800 hover:bg-zinc-750 text-emerald-400 hover:text-emerald-300 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border border-zinc-800 hover:border-zinc-700 mt-1 active:scale-[0.98]"
                  >
                    Tandai Semua Dibaca
                  </button>
                )}
              </div>
              <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-12 text-center text-zinc-700">
                    <Bell className="w-10 h-10 mx-auto mb-4 opacity-10" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Tidak ada aktivitas</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={`p-5 border-b border-zinc-800/30 flex gap-4 transition-all ${!n.read ? 'bg-blue-500/[0.03] border-l-2 border-l-blue-500' : 'bg-transparent'}`}
                    >
                      <div className="flex-1">
                        <p className={`text-xs leading-loose ${!n.read ? 'text-zinc-100 font-semibold' : 'text-zinc-500'}`}>
                          {n.message}
                        </p>
                        <p className="text-[9px] text-zinc-700 font-bold uppercase mt-2 tracking-tighter">
                          {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleTimeString() : n.createdAt ? new Date(n.createdAt).toLocaleTimeString() : ''}
                        </p>
                      </div>
                      {!n.read && (
                        <button 
                          onClick={() => markAsRead(n.id)}
                          className="self-center p-2 hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-emerald-400 transition-all border border-transparent hover:border-zinc-700"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
