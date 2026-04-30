/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { auth, signIn, logOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from './firebase';
import { onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { apiFetch } from './api';
import { AppTimestamp } from './timestamp';
import { 
  Plus, 
  LogOut, 
  LayoutDashboard, 
  Users, 
  Receipt, 
  Settings, 
  ChevronRight,
  Wallet,
  PieChart,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  MoreVertical,
  Menu,
  X,
  Sun,
  Moon,
  Calendar as CalendarIcon,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Group, UserProfile } from './types';

// Components
import Dashboard from './components/Dashboard';
import GroupView from './components/GroupView';
import CreateGroupModal from './components/CreateGroupModal';
import CalendarView from './components/CalendarView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allExpenses, setAllExpenses] = useState<(any & { groupId: string })[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'calendar'>('dashboard');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dataDeletedPopup, setDataDeletedPopup] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });

  // Login form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    (window as any).openCreateGroupModal = () => setIsCreateModalOpen(true);
    return () => {
      delete (window as any).openCreateGroupModal;
    };
  }, []);

  // Check for local session on mount
  useEffect(() => {
    const localUser = localStorage.getItem('budgetfy_user');
    const localToken = localStorage.getItem('budgetfy_token');
    
    if (localUser && localToken) {
      setUser(JSON.parse(localUser));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // If we have a local session active, don't overwrite it with a null Firebase state
      if (!currentUser && localStorage.getItem('budgetfy_token')) {
        return; 
      }
      
      setUser(currentUser);
      if (currentUser) {
        // Sync user to DB
        try {
          await apiFetch('/users/sync', {
            method: 'POST',
            body: JSON.stringify({
              displayName: currentUser.displayName,
              email: currentUser.email,
              photoURL: currentUser.photoURL
            })
          });
        } catch (error) {
          console.error("Error syncing user profile:", error);
        }
      } else {
        localStorage.removeItem('budgetfy_token');
        localStorage.removeItem('budgetfy_user');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      return;
    }

    const fetchGroups = async () => {
      try {
        const data = await apiFetch('/groups');
        // Convert dates if needed (createdAt)
        const fetchedGroups = data.map((g: any) => ({
          ...g,
          createdAt: new AppTimestamp(new Date(g.createdAt))
        }));
        setGroups(fetchedGroups);
        setLastError(null);
      } catch (error: any) {
        console.error("Error fetching groups:", error);
        setLastError(error.message);
      }
    };
    
    fetchGroups();
    // In a real app we'd poll or use websockets, but for this migration we'll
    // rely on manual refetches triggered by user actions when needed.
  }, [user]);

  useEffect(() => {
    if (groups.length === 0) {
      setAllExpenses([]);
      return;
    }

    const fetchAllExpenses = async () => {
      try {
        const promises = groups.map(g => apiFetch(`/groups/${g.id}/expenses`));
        const results = await Promise.all(promises);
        
        const combined = results.flat().map((e: any) => ({
          ...e,
          date: new AppTimestamp(new Date(e.date)),
          dueDate: e.dueDate ? new AppTimestamp(new Date(e.dueDate)) : undefined,
          createdAt: new AppTimestamp(new Date(e.createdAt))
        }));
        
        // Sort newest first
        combined.sort((a, b) => b.date.toMillis() - a.date.toMillis());
        setAllExpenses(combined);
      } catch (err) {
        console.error("Error fetching all expenses:", err);
      }
    };
    
    fetchAllExpenses();
  }, [groups]);

  const overdueCount = useMemo(() => {
    const now = new Date();
    return allExpenses.filter(e => e.status === 'pending' && (e.dueDate?.toDate() || e.date.toDate()) < now).length;
  }, [allExpenses]);

  useEffect(() => {
    if (selectedGroupId && !groups.find(g => g.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [groups, selectedGroupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);
    
    try {
      if (isSignUp) {
        if (!displayName.trim()) {
          throw new Error("Display name is required");
        }
        
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName: displayName.trim() })
        });
        
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Registration failed');
        }
        
        const data = await res.json();
        localStorage.setItem('budgetfy_token', data.token);
        localStorage.setItem('budgetfy_user', JSON.stringify(data.user));
        setUser(data.user);
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Login failed');
        }
        
        const data = await res.json();
        localStorage.setItem('budgetfy_token', data.token);
        localStorage.setItem('budgetfy_user', JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError(error.message || "Authentication failed.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-zinc-950 p-4 text-center relative overflow-hidden transition-colors duration-300">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-1/4 -left-1/4 w-[80%] h-[80%] bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-[120px]" />
          <div className="absolute -bottom-1/4 -right-1/4 w-[80%] h-[80%] bg-fuchsia-600/10 dark:bg-fuchsia-600/20 rounded-full blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-zinc-50/50 dark:bg-white/5 backdrop-blur-2xl p-8 sm:p-10 rounded-[40px] shadow-2xl border border-zinc-200 dark:border-white/10 relative z-10"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/20">
            <Wallet className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-zinc-900 dark:text-white font-display">BudgetFy</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed text-sm sm:text-base">The professional way to track expenses, split bills, and manage shared budgets.</p>
          
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            {authError && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm text-left">
                {authError}
              </div>
            )}
            
            {isSignUp && (
              <div>
                <input
                  type="text"
                  placeholder="Display Name"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-left"
                />
              </div>
            )}
            <div>
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-left"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-left"
              />
            </div>
            
            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isAuthenticating ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-zinc-50 dark:bg-zinc-950 text-zinc-500">Or continue with</span>
            </div>
          </div>

          <button
            onClick={signIn}
            type="button"
            className="w-full py-4 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-sm mb-6"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5 bg-white rounded-full p-[1px]" />
            Google
          </button>

          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
              }} 
              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 font-sans selection:bg-indigo-100 selection:text-indigo-900 relative overflow-hidden transition-colors duration-300">
      {/* Debug Overlay */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="fixed bottom-4 right-4 z-[100] bg-black/80 text-white p-4 rounded-2xl text-[10px] font-mono max-w-xs pointer-events-none">
          <p className="font-bold mb-1 text-indigo-400">DEBUG INFO</p>
          <p>Groups: {groups.length}</p>
          <p>User: {user.uid.slice(0, 8)}...</p>
          {lastError && <p className="text-red-400 mt-2">Error: {lastError}</p>}
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 w-72 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/5 flex flex-col z-50 lg:z-10 transition-all duration-300 ease-in-out overflow-y-auto custom-scrollbar
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Vibrant background glow */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10 dark:opacity-20">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-600 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 -right-32 w-64 h-64 bg-fuchsia-600 rounded-full blur-[100px]" />
        </div>

        <div className="p-8 relative z-10 shrink-0">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-display">BudgetFy</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="space-y-1.5">
            <button 
              onClick={() => {
                setSelectedGroupId(null);
                setCurrentView('dashboard');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${!selectedGroupId && currentView === 'dashboard' ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-xl shadow-zinc-900/10 dark:shadow-white/10' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white'}`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-bold">Dashboard</span>
            </button>
            <button 
              onClick={() => {
                setSelectedGroupId(null);
                setCurrentView('calendar');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 ${!selectedGroupId && currentView === 'calendar' ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-xl shadow-zinc-900/10 dark:shadow-white/10' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white'}`}
            >
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5" />
                <span className="font-bold">Calendar</span>
              </div>
              {overdueCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                  {overdueCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 relative z-10 custom-scrollbar min-h-[200px]">
          <div className="flex items-center justify-between px-4 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">Your Groups</span>
            <button 
              onClick={() => {
                setIsCreateModalOpen(true);
                setIsSidebarOpen(false);
              }}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-lg transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {groups.map(group => (
              <button
                key={group.id}
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group ${selectedGroupId === group.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white'}`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className={`w-2 h-2 rounded-full transition-transform group-hover:scale-125 ${
                      !group.themeColor ? (
                        group.type === 'personal' ? 'bg-blue-400' : 
                        group.type === 'household' ? 'bg-emerald-400' : 
                        'bg-orange-400'
                      ) : ''
                    }`} 
                    style={group.themeColor ? { backgroundColor: group.themeColor } : {}}
                  />
                  <span className="truncate text-sm font-medium">{group.name}</span>
                </div>
                {selectedGroupId === group.id && <ChevronRight className="w-4 h-4 opacity-70" />}
              </button>
            ))}
            {groups.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-zinc-400 dark:text-zinc-600 italic">No groups yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 mt-auto relative z-10 shrink-0">
          <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 mb-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`} alt="" className="w-10 h-10 rounded-xl shadow-sm border border-zinc-200 dark:border-white/10" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{user.displayName}</p>
                <p className="text-[10px] text-zinc-500 truncate font-mono">{user.email}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                logOut();
                localStorage.removeItem('budgetfy_token');
                localStorage.removeItem('budgetfy_user');
                setUser(null);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all duration-300 font-bold text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
            <button 
              onClick={toggleTheme}
              className="p-3 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white transition-all duration-300"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-zinc-950 border-b border-white/5 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white font-display">BudgetFy</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-zinc-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
        <AnimatePresence mode="wait">
          {!selectedGroupId ? (
            currentView === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="p-10 max-w-7xl mx-auto"
              >
                <Dashboard 
                  user={user} 
                  groups={groups} 
                  onSelectGroup={(id) => {
                    setSelectedGroupId(id);
                    setIsSidebarOpen(false);
                  }}
                  theme={theme}
                />
              </motion.div>
            ) : (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="p-10 max-w-7xl mx-auto"
              >
                <CalendarView 
                  expenses={allExpenses}
                  groups={groups}
                  onSelectGroup={(id) => {
                    setSelectedGroupId(id);
                    setIsSidebarOpen(false);
                  }}
                />
              </motion.div>
            )
          ) : (
            <motion.div
              key={selectedGroupId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="p-10 max-w-7xl mx-auto"
            >
              <GroupView 
                groupId={selectedGroupId} 
                user={user} 
                onBack={() => setSelectedGroupId(null)} 
                theme={theme}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <CreateGroupModal 
        isOpen={isCreateModalOpen} 
        onClose={() => {
          setIsCreateModalOpen(false);
          // Trigger a refresh of groups list by temporarily setting user state or similar
          // For simplicity in this demo, reloading window is easiest way to refresh all state
          window.location.reload(); 
        }} 
        user={user}
      />
    </div>
  );
}
