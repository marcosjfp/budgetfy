import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Plus, 
  Users, 
  Receipt, 
  MoreVertical, 
  Trash2, 
  UserPlus,
  TrendingUp,
  PieChart as PieChartIcon,
  Calendar,
  Tag,
  CreditCard,
  BarChart3,
  Loader2,
  Pencil,
  X,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Bell,
  AlertCircle,
  Repeat,
  Utensils,
  Home,
  Zap,
  Car,
  Film,
  ShoppingBag,
  HeartPulse,
  Plane,
  Copy,
  Check,
  Share2
} from 'lucide-react';

import { 
  BarChart,
  Bar,
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { User } from 'firebase/auth';
import { Group, Expense, GroupMember, CATEGORIES, BudgetType } from '../types';
import { COLORS } from '../constants';
import { apiFetch } from '../api';
import { AppTimestamp } from '../timestamp';

const CATEGORY_CONFIG: Record<string, { icon: any, color: string, bg: string }> = {
  'Food': { icon: Utensils, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  'Rent': { icon: Home, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  'Utilities': { icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-500/10' },
  'Transport': { icon: Car, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  'Entertainment': { icon: Film, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/10' },
  'Shopping': { icon: ShoppingBag, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  'Health': { icon: HeartPulse, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
  'Travel': { icon: Plane, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
  'Other': { icon: Tag, color: 'text-zinc-500', bg: 'bg-zinc-50 dark:bg-zinc-500/10' },
};

import { formatCurrency } from '../utils/format';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface GroupViewProps {
  groupId: string;
  user: User;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export default function GroupView({ groupId, user, onBack, theme }: GroupViewProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Form states
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');
  const [splitType, setSplitType] = useState<'equal' | 'percentage' | 'exact'>('equal');
  const [splitDetails, setSplitDetails] = useState<Record<string, number>>({});
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingSeries, setIsDeletingSeries] = useState(false);
  const [showRecurrenceUpdateModal, setShowRecurrenceUpdateModal] = useState(false);
  const [updateChoice, setUpdateChoice] = useState<'this' | 'future' | 'series'>('this');
  const [viewTab, setViewTab] = useState<'all' | 'recurring'>('all');
  const [filteringRecurrenceId, setFilteringRecurrenceId] = useState<string | null>(null);
  const [managingRecurrenceId, setManagingRecurrenceId] = useState<string | null>(null);
  
  // Settings states
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editThemeColor, setEditThemeColor] = useState(COLORS[0].value);
  const [editMaxBudget, setEditMaxBudget] = useState('');
  const [editBudgetType, setEditBudgetType] = useState<BudgetType>('monthly');

  // Stat details modal state
  const [selectedStatDetails, setSelectedStatDetails] = useState<{ title: string; amount: number; subtitle?: string } | null>(null);

  const statModalRef = useRef<HTMLDivElement>(null);
  const deleteGroupModalRef = useRef<HTMLDivElement>(null);
  const deleteExpenseModalRef = useRef<HTMLDivElement>(null);

  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [isDeleteGroupConfirmOpen, setIsDeleteGroupConfirmOpen] = useState(false);

  useEffect(() => {
    if (selectedStatDetails && statModalRef.current) {
      statModalRef.current.focus();
    }
  }, [selectedStatDetails]);

  useEffect(() => {
    if (isDeleteGroupConfirmOpen && deleteGroupModalRef.current) {
      deleteGroupModalRef.current.focus();
    }
  }, [isDeleteGroupConfirmOpen]);

  useEffect(() => {
    if (expenseToDelete && deleteExpenseModalRef.current) {
      deleteExpenseModalRef.current.focus();
    }
  }, [expenseToDelete]);

  // Invite states
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Sorting states
  const [sortField, setSortField] = useState<'date' | 'amount' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const upcomingExpenses = React.useMemo(() => {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    return expenses.filter(e => {
      if (e.status !== 'pending' || !e.dueDate) return false;
      const due = e.dueDate.toDate();
      return due >= now && due <= threeDaysFromNow;
    }).sort((a, b) => a.dueDate!.toMillis() - b.dueDate!.toMillis());
  }, [expenses]);

  const filteredExpenses = React.useMemo(() => {
    if (filteringRecurrenceId) {
      return expenses.filter(e => e.recurrenceId === filteringRecurrenceId);
    }
    if (viewTab === 'recurring') {
      const seriesMap = new Map<string, Expense & { occurrenceCount?: number }>();
      expenses.filter(e => e.isRecurring && e.recurrenceId).forEach(e => {
        const rid = e.recurrenceId!;
        if (!seriesMap.has(rid)) {
          seriesMap.set(rid, { ...e, occurrenceCount: 1 });
        } else {
          const entry = seriesMap.get(rid)!;
          entry.occurrenceCount = (entry.occurrenceCount || 0) + 1;
        }
      });
      return Array.from(seriesMap.values());
    }
    return expenses;
  }, [expenses, viewTab, filteringRecurrenceId]);

  const sortedExpenses = React.useMemo(() => {
    return [...filteredExpenses].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = a.date.toMillis() - b.date.toMillis();
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortField === 'category') {
        comparison = a.category.localeCompare(b.category);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [filteredExpenses, sortField, sortOrder]);

  const currentUserMember = members.find(m => m.uid === user.uid);
  const userIsAdmin = currentUserMember?.role === 'admin' || group?.createdBy === user.uid;

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [groupData, expensesData, membersData] = await Promise.all([
          apiFetch(`/groups/${groupId}`),
          apiFetch(`/groups/${groupId}/expenses`),
          apiFetch(`/groups/${groupId}/members`)
        ]);

        if (!isMounted) return;

        setGroup(groupData);
        setEditName(groupData.name);
        setEditDescription(groupData.description || '');
        setEditThemeColor(groupData.themeColor || COLORS[0].value);
        setEditMaxBudget(groupData.maxBudget?.toString() || '');
        setEditBudgetType(groupData.budgetType || 'monthly');

        setExpenses(expensesData.map((e: any) => ({
          ...e,
          date: new AppTimestamp(new Date(e.date)),
          dueDate: e.dueDate ? new AppTimestamp(new Date(e.dueDate)) : undefined,
          createdAt: new AppTimestamp(new Date(e.createdAt))
        })));

        setMembers(membersData);
      } catch (err) {
        console.error("Error fetching group view data:", err);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [groupId]);

  useEffect(() => {
    if (editingExpense) {
      setAmount(editingExpense.amount.toString());
      setDescription(editingExpense.description);
      setCategory(editingExpense.category);
      setDate(editingExpense.date.toDate().toISOString().split('T')[0]);
      setDueDate(editingExpense.dueDate?.toDate().toISOString().split('T')[0] || '');
      setStatus(editingExpense.status || 'paid');
      setSplitType(editingExpense.splitType || 'equal');
      setSplitDetails(editingExpense.splitDetails || {});
      setIsRecurring(false); // Default to false when editing a single occurrence
      setIsAddExpenseOpen(true);
    } else {
      setAmount('');
      setDescription('');
      setCategory(CATEGORIES[0]);
      setDate(new Date().toISOString().split('T')[0]);
      setDueDate('');
      setStatus('paid');
      setSplitType('equal');
      setSplitDetails({});
      setIsRecurring(false);
      setRecurrenceFrequency('monthly');
      setRecurrenceEndDate('');
    }
  }, [editingExpense]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddExpenseOpen(false);
        setIsAddMemberOpen(false);
        setIsSettingsOpen(false);
        setIsDeleteGroupConfirmOpen(false);
        setExpenseToDelete(null);
        setEditingExpense(null);
        setViewingExpense(null);
        setFilteringRecurrenceId(null);
        setManagingRecurrenceId(null);
        setSelectedStatDetails(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAddExpense = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!amount || !description) return;

    if (editingExpense?.isRecurring && !showRecurrenceUpdateModal) {
      setShowRecurrenceUpdateModal(true);
      return;
    }

    setIsSaving(true);
    setShowRecurrenceUpdateModal(false);

    // Split validation
    if (splitType === 'percentage') {
      const total = Object.values(splitDetails).reduce((a, b) => a + b, 0);
      if (Math.abs(total - 100) > 0.01) {
        setIsSaving(false);
        return;
      }
    } else if (splitType === 'exact') {
      const total = Object.values(splitDetails).reduce((a, b) => a + b, 0);
      if (Math.abs(total - parseFloat(amount)) > 0.01) {
        setIsSaving(false);
        return;
      }
    }

    try {
      const baseExpenseData: any = {
        amount: parseFloat(amount),
        description: description.trim(),
        category,
        paidBy: editingExpense ? editingExpense.paidBy : user.uid,
        status,
        splitType,
        splitDetails: splitType === 'equal' ? {} : splitDetails,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        date: new Date(date).toISOString(),
      };

      if (editingExpense) {
        if (editingExpense.isRecurring && updateChoice !== 'this' && editingExpense.recurrenceId) {
          await apiFetch(`/groups/${groupId}/expenses/bulk`, {
            method: 'PATCH',
            body: JSON.stringify({
              recurrenceId: editingExpense.recurrenceId,
              fromDate: updateChoice === 'future' ? editingExpense.date.toDate().toISOString() : undefined,
              updates: baseExpenseData
            })
          });
        } else {
          await apiFetch(`/groups/${groupId}/expenses/${editingExpense.id}`, {
            method: 'PATCH',
            body: JSON.stringify(baseExpenseData)
          });
        }
      } else if (isRecurring && recurrenceEndDate) {
        const start = new Date(date);
        const end = new Date(recurrenceEndDate);
        const recurrenceId = crypto.randomUUID();
        const bulkExpenses = [];
        let current = new Date(start);
        
        let count = 0;
        while (current <= end && count < 50) {
          const expenseDate = new Date(current);
          const expenseData = {
            ...baseExpenseData,
            date: expenseDate.toISOString(),
            isRecurring: true,
            recurrenceId
          };
          
          if (dueDate) {
            const originalDate = new Date(date);
            const originalDueDate = new Date(dueDate);
            const diffTime = originalDueDate.getTime() - originalDate.getTime();
            const occurrenceDueDate = new Date(expenseDate.getTime() + diffTime);
            expenseData.dueDate = occurrenceDueDate.toISOString();
          }

          bulkExpenses.push(expenseData);
          
          if (recurrenceFrequency === 'daily') current.setDate(current.getDate() + 1);
          else if (recurrenceFrequency === 'weekly') current.setDate(current.getDate() + 7);
          else if (recurrenceFrequency === 'monthly') current.setMonth(current.getMonth() + 1);
          else if (recurrenceFrequency === 'yearly') current.setFullYear(current.getFullYear() + 1);
          
          count++;
        }
        
        await apiFetch(`/groups/${groupId}/expenses`, {
          method: 'POST',
          body: JSON.stringify(bulkExpenses)
        });
      } else {
        await apiFetch(`/groups/${groupId}/expenses`, {
          method: 'POST',
          body: JSON.stringify(baseExpenseData)
        });
      }
      
      setIsAddExpenseOpen(false);
      setEditingExpense(null);
      setAmount('');
      setDescription('');
      setUpdateChoice('this');
      // Trigger reload to fetch new data
      window.location.reload();
    } catch (error) {
      handleFirestoreError(error, editingExpense ? OperationType.UPDATE : OperationType.CREATE, `groups/${groupId}/expenses`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('This feature has been disabled for this demo. Click the Remix button to create your own version of the app and enable sharing.');
  };

  const handleDeleteExpense = async (id: string, choice: 'this' | 'future' | 'series' = 'this') => {
    try {
      const expense = expenses.find(e => e.id === id);
      if (!expense) return;

      if (choice !== 'this' && expense.recurrenceId) {
        setIsDeletingSeries(true);
        await apiFetch(`/groups/${groupId}/expenses/bulk`, {
          method: 'DELETE',
          body: JSON.stringify({
            recurrenceId: expense.recurrenceId,
            fromDate: choice === 'future' ? expense.date.toDate().toISOString() : undefined
          })
        });
      } else {
        await apiFetch(`/groups/${groupId}/expenses/${id}`, {
          method: 'DELETE'
        });
      }
      setExpenseToDelete(null);
      setUpdateChoice('this');
      window.location.reload();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}/expenses/${id}`);
    } finally {
      setIsDeletingSeries(false);
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await apiFetch(`/groups/${groupId}`, { method: 'DELETE' });
      onBack();
      window.location.reload();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}`);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    
    try {
      const updateData: any = {
        name: editName.trim(),
        description: editDescription.trim(),
        themeColor: editThemeColor,
        maxBudget: editMaxBudget ? parseFloat(editMaxBudget) : null,
        budgetType: editMaxBudget ? editBudgetType : 'total'
      };
      await apiFetch(`/groups/${groupId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });
      setIsSettingsOpen(false);
      window.location.reload();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}`);
    }
  };

  const isDateInCurrentPeriod = (date: Date, type: BudgetType) => {
    const now = new Date();
    if (type === 'total') return true;
    
    if (type === 'monthly') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    
    if (type === 'weekly') {
      // Get start of current week (Sunday)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      
      return date >= startOfWeek && date < endOfWeek;
    }
    
    return true;
  };

  const currentPeriodExpenses = expenses.filter(e => 
    isDateInCurrentPeriod(e.date.toDate(), group?.budgetType || 'total')
  );

  const totalSpent = currentPeriodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const userSpent = currentPeriodExpenses.filter(e => e.paidBy === user.uid).reduce((sum, e) => sum + e.amount, 0);
  
  const userShare = currentPeriodExpenses.reduce((sum, e) => {
    if (!e.splitType || e.splitType === 'equal') {
      return sum + (members.length > 0 ? e.amount / members.length : 0);
    } else if (e.splitType === 'percentage') {
      const percentage = e.splitDetails?.[user.uid] || 0;
      return sum + (e.amount * percentage / 100);
    } else if (e.splitType === 'exact') {
      return sum + (e.splitDetails?.[user.uid] || 0);
    }
    return sum;
  }, 0);

  const balance = userSpent - userShare;

  // Budget calculation
  const currentBudgetSpent = totalSpent;

  // Chart Data Preparation
  const getLineChartData = () => {
    if (!group || group.budgetType === 'total') return [];
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const data = [];
    
    if (group.budgetType === 'weekly') {
      // Show 52 weeks of the year
      const firstDayOfYear = new Date(currentYear, 0, 1);
      const startOfFirstWeek = new Date(firstDayOfYear);
      startOfFirstWeek.setDate(firstDayOfYear.getDate() - firstDayOfYear.getDay());
      startOfFirstWeek.setHours(0, 0, 0, 0);

      for (let i = 0; i < 52; i++) {
        const weekStart = new Date(startOfFirstWeek);
        weekStart.setDate(startOfFirstWeek.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const weekSpent = expenses
          .filter(e => {
            const ed = e.date.toDate();
            return ed >= weekStart && ed < weekEnd && ed.getFullYear() === currentYear;
          })
          .reduce((sum, e) => sum + e.amount, 0);
        
        data.push({ 
          name: `W${i + 1}`, 
          amount: weekSpent 
        });
      }
    } else if (group.budgetType === 'monthly') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 0; i < 12; i++) {
        const monthSpent = expenses
          .filter(e => {
            const ed = e.date.toDate();
            return ed.getMonth() === i && ed.getFullYear() === currentYear;
          })
          .reduce((sum, e) => sum + e.amount, 0);
        data.push({ name: monthNames[i], amount: monthSpent });
      }
    }
    return data;
  };

  const getPieChartData = () => {
    const categoryMap = new Map<string, number>();
    currentPeriodExpenses.forEach(e => {
      categoryMap.set(e.category, (categoryMap.get(e.category) || 0) + e.amount);
    });
    return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  };

  const getBarChartData = () => {
    const now = new Date();
    const currentMonthExpenses = expenses.filter(e => {
      const d = e.date.toDate();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    
    const categoryMap = new Map<string, number>();
    currentMonthExpenses.forEach(e => {
      categoryMap.set(e.category, (categoryMap.get(e.category) || 0) + e.amount);
    });

    const totalMonthSpend = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);

    return {
      data: Array.from(categoryMap.entries())
        .map(([name, value]) => ({ 
          name, 
          value,
          percentage: totalMonthSpend > 0 ? (value / totalMonthSpend) * 100 : 0
        }))
        .sort((a, b) => b.value - a.value),
      totalMonthSpend
    };
  };

  const lineData = getLineChartData();
  const pieData = getPieChartData();
  const { data: barData, totalMonthSpend } = getBarChartData();
  
  const splitTotal = Object.values(splitDetails).reduce((a, b) => a + b, 0);
  const isSplitValid = 
    splitType === 'equal' ||
    (splitType === 'percentage' && Math.abs(splitTotal - 100) <= 0.01) ||
    (splitType === 'exact' && Math.abs(splitTotal - parseFloat(amount || '0')) <= 0.01);

  const CHART_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#71717a'];

  const getPeriodLabel = () => {
    const now = new Date();
    const type = group?.budgetType || 'total';
    
    if (type === 'monthly') {
      return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    
    if (type === 'weekly') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const startMonth = startOfWeek.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' });
      
      if (startMonth === endMonth) {
        return `${startMonth} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${now.getFullYear()}`;
      }
      return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${now.getFullYear()}`;
    }
    
    return 'All Time';
  };

  if (!group) return null;

  return (
    <div className="max-w-6xl mx-auto">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl transition-all duration-200 mb-10 group shadow-sm"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        <span className="text-sm font-bold">Back to Dashboard</span>
      </button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-12">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span 
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                !group.themeColor ? (
                  group.type === 'household' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' :
                  group.type === 'trip' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20' :
                  'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20'
                ) : ''
              }`}
              style={group.themeColor ? { backgroundColor: `${group.themeColor}15`, color: group.themeColor, borderColor: `${group.themeColor}30`, borderWidth: '1px' } : {}}
            >
              {group.type}
            </span>
            <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">{getPeriodLabel()}</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3 font-display">{group.name}</h1>
          <p className="text-zinc-600 dark:text-zinc-300 max-w-2xl leading-relaxed font-medium">{group.description || 'No description provided.'}</p>
        </div>

        <div className="flex flex-wrap items-stretch gap-2 sm:gap-3 w-full md:w-auto">
          {userIsAdmin && (
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="w-12 sm:w-auto p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all shadow-sm flex items-center justify-center shrink-0"
              title="Group Settings"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          )}
          {userIsAdmin && (
            <button 
              onClick={() => setIsAddMemberOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-lg hover:shadow-indigo-500/10 transition-all active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              Invite
            </button>
          )}

          <div className="relative">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all shadow-sm flex items-center justify-center shrink-0"
              title="Notifications"
            >
              <Bell className={`w-5 h-5 ${upcomingExpenses.length > 0 ? 'text-amber-500 animate-[pulse_2s_infinite]' : ''}`} />
              {upcomingExpenses.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900">
                  {upcomingExpenses.length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[32px] shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white font-display">Upcoming Bills</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Due within 3 days</p>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                      {upcomingExpenses.length > 0 ? (
                        upcomingExpenses.map(expense => (
                          <div key={expense.id} className="p-4 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 group transition-all">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{expense.description}</p>
                                <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Due {expense.dueDate?.toDate().toLocaleDateString()}
                                </p>
                              </div>
                              <span className="text-xs font-bold text-zinc-900 dark:text-white">${expense.amount.toFixed(2)}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 px-6 text-center">
                          <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-zinc-300">
                            <Bell className="w-6 h-6" />
                          </div>
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No upcoming bills</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={() => {
              setEditingExpense(null);
              setIsAddExpenseOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-lg hover:shadow-indigo-500/10 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 lg:gap-6 mb-12">
        <button 
          onClick={() => setSelectedStatDetails({ title: 'Total Group Spend', amount: totalSpent })}
          className="text-left w-full bg-white dark:bg-zinc-900 p-6 md:p-5 lg:p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-zinc-950/20 relative overflow-hidden group hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-100 dark:bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
          <div className="relative">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4 font-display">Total Group Spend</p>
            <p 
              className="text-4xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-zinc-900 dark:text-white font-display tracking-tight truncate"
              title={`$${formatCurrency(totalSpent)}`}
            >
              ${formatCurrency(totalSpent)}
            </p>
            {group.maxBudget && (
              <div className="mt-6">
                <div className="flex justify-between text-[10px] font-bold uppercase mb-2 font-display">
                  <span className="text-zinc-500">Budget ({group.budgetType})</span>
                  <span className={currentBudgetSpent > group.maxBudget ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}>
                    {((currentBudgetSpent / group.maxBudget) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-700 ease-out ${currentBudgetSpent > group.maxBudget ? 'bg-red-500' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.min(100, (currentBudgetSpent / group.maxBudget) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 font-medium">
                  ${formatCurrency(currentBudgetSpent)} of ${formatCurrency(group.maxBudget)}
                </p>
              </div>
            )}
          </div>
        </button>
        <button 
          onClick={() => setSelectedStatDetails({ title: 'Your Share', amount: userShare, subtitle: `${totalSpent > 0 ? ((userSpent / totalSpent) * 100).toFixed(0) : 0}% of total paid by you` })}
          className="text-left w-full bg-white dark:bg-zinc-900 p-6 md:p-5 lg:p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/20 relative overflow-hidden group hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-100 dark:bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
          <div className="relative">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4 font-display">Your Share</p>
            <p 
              className="text-4xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-zinc-900 dark:text-white font-display tracking-tight truncate"
              title={`$${formatCurrency(userShare)}`}
            >
              ${formatCurrency(userShare)}
            </p>
            <p className="text-xs font-medium text-zinc-500 mt-4">
              {totalSpent > 0 ? ((userSpent / totalSpent) * 100).toFixed(0) : 0}% of total paid by you
            </p>
          </div>
        </button>
        <button 
          onClick={() => setSelectedStatDetails({ title: balance >= 0 ? 'You are owed' : 'You owe', amount: Math.abs(balance) })}
          className="text-left w-full bg-white dark:bg-zinc-900 p-6 md:p-5 lg:p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/20 relative overflow-hidden group hover:scale-[1.02] active:scale-95 transition-all duration-300 cursor-pointer"
        >
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 ${balance >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`} />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-zinc-500 font-display">
              {balance >= 0 ? 'You are owed' : 'You owe'}
            </p>
            <p 
              className={`text-4xl md:text-2xl lg:text-3xl xl:text-4xl font-bold font-display tracking-tight truncate ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
              title={`$${formatCurrency(Math.abs(balance))}`}
            >
              ${formatCurrency(Math.abs(balance))}
            </p>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {group.budgetType !== 'total' && (
          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.15em] mb-8 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Spending Trend ({group.budgetType})
            </h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={lineData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" opacity={0.1} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 500 }}
                    interval="preserveStart"
                    minTickGap={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 500 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', 
                      padding: '12px', 
                      backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff', 
                      color: theme === 'dark' ? '#ffffff' : '#18181b' 
                    }}
                    itemStyle={{ fontSize: '12px', fontWeight: 600, color: theme === 'dark' ? '#ffffff' : '#18181b' }}
                    labelStyle={{ fontSize: '10px', color: '#71717a', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}
                    formatter={(value: number) => [`$${formatCurrency(value)}`, 'Spent']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#4f46e5" 
                    strokeWidth={4} 
                    dot={{ r: 0 }}
                    activeDot={{ r: 6, fill: '#4f46e5', strokeWidth: 3, stroke: '#fff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div className={`bg-white dark:bg-zinc-900 p-4 sm:p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/20 ${group.budgetType === 'total' ? 'lg:col-span-1' : ''}`}>
          <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.15em] mb-8 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" />
            Category Distribution
          </h3>
          <div className="h-[280px] w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`$${formatCurrency(value)}`, 'Total']}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', 
                      padding: '12px', 
                      backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff', 
                      color: theme === 'dark' ? '#ffffff' : '#18181b' 
                    }}
                    itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#18181b' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 500, paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 text-sm">
                <PieChartIcon className="w-10 h-10 mb-2 opacity-20" />
                <p className="font-medium italic">No expenses in this period</p>
              </div>
            )}
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/20 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.15em] flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Monthly Category Spend
            </h3>
            {totalMonthSpend > 0 && (
              <div className="text-right">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Month Total</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-white font-mono">${formatCurrency(totalMonthSpend)}</p>
              </div>
            )}
          </div>
          <div className="h-[220px] w-full mb-6">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 600 }}
                    width={85}
                  />
                  <Tooltip 
                    cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                    formatter={(value: number) => [`$${formatCurrency(value)}`, 'Amount']}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', 
                      padding: '12px', 
                      backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff', 
                      color: theme === 'dark' ? '#ffffff' : '#18181b' 
                    }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={16}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 text-sm">
                <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
                <p className="font-medium italic text-[10px] uppercase tracking-widest text-center">No expenses this month</p>
              </div>
            )}
          </div>

          {barData.length > 0 && (
            <div className="mt-auto space-y-2 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
              {barData.map((category, index) => (
                <div key={category.name} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                      {category.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="text-[10px] font-mono text-zinc-400">
                      {category.percentage.toFixed(1)}%
                    </span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono">
                      ${formatCurrency(category.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => {
                  setViewTab('all');
                  setFilteringRecurrenceId(null);
                }}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                  viewTab === 'all' && !filteringRecurrenceId
                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                All Transactions
              </button>
              <button
                onClick={() => {
                  setViewTab('recurring');
                  setFilteringRecurrenceId(null);
                }}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${
                  viewTab === 'recurring' && !filteringRecurrenceId
                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3 h-3" />
                Recurring Series
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all shadow-sm"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
                  Sort: {sortField}
                  <ChevronDown className={`w-3 h-3 transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isSortDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsSortDropdownOpen(false)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="p-2 space-y-1">
                          {(['date', 'amount', 'category'] as const).map((field) => (
                            <button
                              key={field}
                              onClick={() => {
                                if (sortField === field) {
                                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setSortField(field);
                                  setSortOrder('desc');
                                }
                                setIsSortDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                                sortField === field 
                                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                                  : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                              }`}
                            >
                              {field}
                              {sortField === field && (
                                sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{expenses.length} Total</div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
            {filteringRecurrenceId && (
              <div className="p-4 sm:p-6 bg-indigo-50/50 dark:bg-indigo-500/5 border-b border-indigo-100 dark:border-indigo-500/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Recurring Series</h3>
                    <p className="text-[10px] font-medium text-zinc-500">Showing all occurrences for this expense</p>
                  </div>
                </div>
                <button 
                  onClick={() => setFilteringRecurrenceId(null)}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                >
                  Clear Filter
                </button>
              </div>
            )}
            {viewTab === 'recurring' && !filteringRecurrenceId && (
              <div className="p-4 sm:p-6 bg-indigo-50/30 dark:bg-indigo-500/5 border-b border-indigo-100/50 dark:border-indigo-500/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Recurring Subscriptions</h3>
                    <p className="text-[10px] font-medium text-zinc-500">Managed series of automatic transactions</p>
                  </div>
                </div>
              </div>
            )}
            {expenses.length === 0 ? (
              <div className="p-10 sm:p-20 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Receipt className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-300 dark:text-zinc-600" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">No transactions yet</h3>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto text-sm">Start tracking your shared expenses by adding your first transaction.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {sortedExpenses.map(expense => (
                  <div 
                    key={expense.id} 
                    onClick={() => setViewingExpense(expense)}
                    className={`p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between group transition-all duration-200 gap-4 cursor-pointer ${
                      expense.isRecurring 
                        ? 'bg-indigo-50/10 dark:bg-indigo-500/5 hover:bg-indigo-50/20 dark:hover:bg-indigo-500/10' 
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                      {(() => {
                        const config = CATEGORY_CONFIG[expense.category] || CATEGORY_CONFIG['Other'];
                        const Icon = config.icon;
                        return (
                          <div className={`relative w-12 h-12 sm:w-14 sm:h-14 ${config.bg} rounded-2xl flex items-center justify-center ${config.color} border border-zinc-100 dark:border-zinc-700/50 group-hover:scale-110 transition-transform shrink-0`}>
                            <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                            {expense.isRecurring && (
                              <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20 border-2 border-white dark:border-zinc-900">
                                <Repeat className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            {viewTab === 'recurring' ? 'Next Occurrence' : expense.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {viewTab === 'recurring' && (
                            <span className="text-xs font-bold text-zinc-900 dark:text-white">
                              {expense.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${(CATEGORY_CONFIG[expense.category] || CATEGORY_CONFIG['Other']).color}`}>
                            {expense.category}
                          </span>
                          {expense.isRecurring && (
                            <>
                              <span className="text-zinc-300 dark:text-zinc-700">•</span>
                              <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Recurring</span>
                            </>
                          )}
                        </div>
                        <p className="font-bold text-zinc-900 dark:text-white group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors truncate">{expense.description}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {expense.dueDate && (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border shrink-0 flex items-center gap-1 ${
                              expense.status === 'pending'
                                ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20'
                                : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-100 dark:border-zinc-700'
                            }`}>
                              <Clock className="w-3 h-3" />
                              Due {expense.dueDate.toDate().toLocaleDateString()}
                            </span>
                          )}
                          {expense.status === 'pending' && !expense.dueDate && (
                            <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 rounded-full text-[9px] sm:text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider border border-amber-100 dark:border-amber-500/20 shrink-0 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Pending Payment
                            </span>
                          )}
                          {expense.isRecurring && !filteringRecurrenceId && expense.recurrenceId && (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setManagingRecurrenceId(expense.recurrenceId!);
                                }}
                                className="px-3 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all active:scale-90 shrink-0 flex items-center gap-2 shadow-sm"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Manage
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFilteringRecurrenceId(expense.recurrenceId!);
                                }}
                                className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all active:scale-90 shrink-0 flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                              >
                                <Repeat className="w-3.5 h-3.5" />
                                View All
                              </button>
                              {viewTab === 'recurring' && (expense as any).occurrenceCount > 0 && (
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                  {(expense as any).occurrenceCount} Instances
                                </span>
                              )}
                            </div>
                          )}
                          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline shrink-0">•</span>
                          <span className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">Paid by {members.find(m => m.uid === expense.paidBy)?.displayName || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto shrink-0 mt-4 sm:mt-0">
                      <div className="text-left sm:text-right min-w-0">
                        <p 
                          className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white font-mono tracking-tight truncate"
                          title={`$${formatCurrency(expense.amount)}`}
                        >
                          ${formatCurrency(expense.amount)}
                        </p>
                        <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Amount</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {(user.uid === expense.paidBy || userIsAdmin) && (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingExpense(expense); }}
                              className="p-2 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl sm:opacity-0 group-hover:opacity-100 focus:opacity-100 focus:bg-indigo-50 dark:focus:bg-indigo-500/10 transition-all active:scale-90 outline-none focus:ring-2 focus:ring-indigo-500"
                              title="Edit Expense"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setExpenseToDelete(expense.id); }}
                              className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl sm:opacity-0 group-hover:opacity-100 focus:opacity-100 focus:bg-red-50 dark:focus:bg-red-500/10 transition-all active:scale-90 outline-none focus:ring-2 focus:ring-red-500"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white mb-8 flex items-center gap-3 font-display">
            <Users className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
            Group Members
          </h2>
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/20">
            <div className="space-y-6">
              {members.map(member => (
                <div key={member.uid} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 dark:text-zinc-500 font-bold border border-zinc-100 dark:border-zinc-700 group-hover:border-indigo-500 transition-colors">
                        {member.displayName?.charAt(0)}
                      </div>
                      {member.uid === group.createdBy && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                          <Users className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{member.displayName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                          member.role === 'admin' 
                            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20'
                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border border-zinc-100 dark:border-zinc-700'
                        }`}>
                          {member.role}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-wide">
                          ${formatCurrency(currentPeriodExpenses.filter(e => e.paidBy === member.uid).reduce((sum, e) => sum + e.amount, 0))} paid
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.uid === group.createdBy && (
                      <span className="shrink-0 text-[9px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-500/20">OWNER</span>
                    )}
                    {userIsAdmin && member.uid !== user.uid && member.uid !== group.createdBy && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={async () => {
                            const newRole = member.role === 'admin' ? 'member' : 'admin';
                            try {
                              await apiFetch(`/groups/${groupId}/members/${member.uid}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ role: newRole })
                              });
                              window.location.reload();
                            } catch (error) {
                              handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}/members/${member.uid}`);
                            }
                          }}
                          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-indigo-600 transition-colors"
                          title={member.role === 'admin' ? "Demote to Member" : "Promote to Admin"}
                        >
                          <TrendingUp className={`w-3.5 h-3.5 ${member.role === 'admin' ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Are you sure you want to remove ${member.displayName} from the group?`)) return;
                            try {
                              await apiFetch(`/groups/${groupId}/members/${member.uid}`, {
                                method: 'DELETE'
                              });
                              window.location.reload();
                            } catch (error) {
                              handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}/members/${member.uid}`);
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-zinc-400 hover:text-red-600 transition-colors"
                          title="Remove from Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isAddExpenseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddExpenseOpen(false);
                setEditingExpense(null);
              }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-expense-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl p-6 sm:p-10 outline-none"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 id="add-expense-title" className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white font-display">
                  {editingExpense ? 'Edit Expense' : 'Add Expense'}
                </h3>
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddExpenseOpen(false);
                    setEditingExpense(null);
                  }} 
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <form onSubmit={handleAddExpense} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">Amount</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-10 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono font-bold text-lg dark:text-white"
                      placeholder="0.00"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium dark:text-white"
                    placeholder="What was it for?"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-4">Category</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {CATEGORIES.map((cat) => {
                      const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['Other'];
                      const Icon = config.icon;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all duration-200 ${
                            category === cat
                              ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg shadow-zinc-900/10 scale-105'
                              : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                          }`}
                        >
                          <div className={`p-2 rounded-xl ${category === cat ? 'bg-white/10' : config.bg}`}>
                            <Icon className={`w-5 h-5 ${category === cat ? 'text-white' : config.color}`} />
                          </div>
                          <span className="text-[10px] font-bold truncate w-full text-center tracking-tight">{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2 text-zinc-400">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'paid' | 'pending')}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium appearance-none dark:text-white"
                    >
                      <option value="paid">Paid</option>
                      <option value="pending">Pending (Bill)</option>
                    </select>
                  </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">Split Type</label>
                  <div className="flex bg-zinc-50 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                    {(['equal', 'percentage', 'exact'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setSplitType(type);
                          if (type === 'equal') setSplitDetails({});
                          else if (type === 'percentage') {
                            const details: Record<string, number> = {};
                            const p = Math.floor(100 / members.length * 100) / 100;
                            members.forEach(m => details[m.uid] = p);
                            // Add remainder to current user to ensure 100%
                            const currentSum = p * members.length;
                            details[user.uid] = parseFloat((p + (100 - currentSum)).toFixed(2));
                            setSplitDetails(details);
                          } else {
                            const details: Record<string, number> = {};
                            const total = parseFloat(amount || '0');
                            const a = Math.floor(total / members.length * 100) / 100;
                            members.forEach(m => details[m.uid] = a);
                            // Add remainder to current user to ensure match
                            const currentSum = a * members.length;
                            details[user.uid] = parseFloat((a + (total - currentSum)).toFixed(2));
                            setSplitDetails(details);
                          }
                        }}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${
                          splitType === type
                            ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {splitType !== 'equal' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Member Split</h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {members.map(member => (
                        <div key={member.uid} className="flex items-center justify-between gap-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 bg-white dark:bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-400 border border-zinc-100 dark:border-zinc-700">
                              {member.displayName?.charAt(0)}
                            </div>
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{member.displayName}</span>
                          </div>
                          <div className="relative w-32">
                            <input
                              type="number"
                              step={splitType === 'percentage' ? "0.01" : "0.01"}
                              value={splitDetails[member.uid] || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setSplitDetails(prev => ({ ...prev, [member.uid]: val }));
                              }}
                              className="w-full pl-3 pr-8 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-right text-xs font-bold dark:text-white"
                              placeholder="0.00"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">
                              {splitType === 'percentage' ? '%' : '$'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {splitType === 'percentage' && (
                      <div className="px-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Total: {Object.values(splitDetails).reduce((a, b) => a + b, 0).toFixed(2)}%</span>
                          <button
                            type="button"
                            onClick={() => {
                              const details: Record<string, number> = {};
                              const p = 100 / members.length;
                              members.forEach(m => details[m.uid] = parseFloat(p.toFixed(2)));
                              setSplitDetails(details);
                            }}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
                          >
                            Split Evenly
                          </button>
                        </div>
                        {Math.abs(Object.values(splitDetails).reduce((a, b) => a + b, 0) - 100) > 0.01 && (
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                              Mismatch: {(100 - Object.values(splitDetails).reduce((a, b) => a + b, 0)).toFixed(2)}%
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const currentSum = Object.values(splitDetails).reduce((a, b) => a + b, 0);
                                const diff = 100 - currentSum;
                                setSplitDetails(prev => ({
                                  ...prev,
                                  [user.uid]: parseFloat(((prev[user.uid] || 0) + diff).toFixed(2))
                                }));
                              }}
                              className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-widest px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg"
                            >
                              Assign difference to me
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {splitType === 'exact' && (
                      <div className="px-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Total: ${Object.values(splitDetails).reduce((a, b) => a + b, 0).toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const details: Record<string, number> = {};
                              const a = parseFloat(amount || '0') / members.length;
                              members.forEach(m => details[m.uid] = parseFloat(a.toFixed(2)));
                              setSplitDetails(details);
                            }}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
                          >
                            Split Evenly
                          </button>
                        </div>
                        {Math.abs(Object.values(splitDetails).reduce((a, b) => a + b, 0) - parseFloat(amount)) > 0.01 && (
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                              Mismatch: ${(parseFloat(amount || '0') - Object.values(splitDetails).reduce((a, b) => a + b, 0)).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const total = parseFloat(amount || '0');
                                const currentSum = Object.values(splitDetails).reduce((a, b) => a + b, 0);
                                const diff = total - currentSum;
                                setSplitDetails(prev => ({
                                  ...prev,
                                  [user.uid]: parseFloat(((prev[user.uid] || 0) + diff).toFixed(2))
                                }));
                              }}
                              className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-widest px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg"
                            >
                              Assign difference to me
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">{status === 'paid' ? 'Transaction Date' : 'Bill Date'}</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">Due Date (Optional)</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium dark:text-white"
                    />
                  </div>
                </div>

                {!editingExpense && (
                  <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isRecurring}
                          onChange={(e) => setIsRecurring(e.target.checked)}
                          className="w-5 h-5 rounded-lg border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Set as Recurring Expense</span>
                      </label>
                    </div>

                    {isRecurring && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">Frequency</label>
                          <select
                            value={recurrenceFrequency}
                            onChange={(e) => setRecurrenceFrequency(e.target.value as any)}
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium appearance-none dark:text-white"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">End Date</label>
                          <input
                            type="date"
                            value={recurrenceEndDate}
                            min={date}
                            onChange={(e) => setRecurrenceEndDate(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium dark:text-white"
                            required={isRecurring}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isSplitValid || isSaving}
                  className="w-full py-4 bg-zinc-900 dark:bg-indigo-600 text-white rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-indigo-700 transition-all mt-4 shadow-lg shadow-zinc-200 dark:shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-5 h-5 animate-spin" />}
                  {isSaving ? 'Saving...' : (editingExpense ? 'Update Transaction' : 'Save Transaction')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddMemberOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsAddMemberOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-member-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl p-10 outline-none"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 id="add-member-title" className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white font-display">Invite Member</h3>
                <button 
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)} 
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">Enter the email address of the person you want to add.</p>
              
              {inviteError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-2xl">
                  {inviteError}
                </div>
              )}

              {inviteSuccess && (
                <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-2xl flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Member added successfully!
                </div>
              )}

              <form onSubmit={handleAddMember} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">Email Address</label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => {
                      setNewMemberEmail(e.target.value);
                      setInviteError(null);
                    }}
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium dark:text-white"
                    placeholder="friend@example.com"
                    required
                    disabled={inviteLoading || inviteSuccess}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={inviteLoading || inviteSuccess}
                  className="w-full py-4 bg-zinc-900 dark:bg-indigo-600 text-white rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-indigo-700 transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-zinc-200 dark:shadow-indigo-500/20 active:scale-95"
                >
                  {inviteLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add to Group'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl p-10 max-h-[90vh] overflow-y-auto outline-none"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 id="settings-title" className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white font-display">Group Settings</h3>
                <button 
                  type="button"
                  onClick={() => setIsSettingsOpen(false)} 
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <form onSubmit={handleUpdateSettings} className="space-y-8">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-6">General Info</h4>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">Group Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium dark:text-white"
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">Description</label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none h-24 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-4">Theme Color</label>
                      <div className="flex flex-wrap gap-2">
                        {COLORS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setEditThemeColor(color.value)}
                            className={`w-8 h-8 rounded-full ${color.bg} transition-all duration-200 flex items-center justify-center border-2 ${
                              editThemeColor === color.value ? 'border-zinc-900 dark:border-white scale-110' : 'border-transparent'
                            }`}
                          >
                            {editThemeColor === color.value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-6">Budget Limits</h4>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">Max Budget</label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editMaxBudget}
                          onChange={(e) => setEditMaxBudget(e.target.value)}
                          placeholder="No limit"
                          className="w-full pl-10 pr-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono font-bold dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2">Frequency</label>
                      <select
                        value={editBudgetType}
                        onChange={(e) => setEditBudgetType(e.target.value as BudgetType)}
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium appearance-none dark:text-white"
                      >
                        <option value="weekly">Per Week</option>
                        <option value="monthly">Per Month</option>
                        <option value="total">Total</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-zinc-900 dark:bg-indigo-600 text-white rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-indigo-700 transition-all shadow-lg shadow-zinc-200 dark:shadow-indigo-500/20 active:scale-95"
                >
                  Save Settings
                </button>

                {userIsAdmin && (
                  <div className="pt-8 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        setIsDeleteGroupConfirmOpen(true);
                      }}
                      className="w-full py-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete Group
                    </button>
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Delete Group Confirmation Modal */}
      <AnimatePresence>
        {isDeleteGroupConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteGroupConfirmOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              ref={deleteGroupModalRef}
              tabIndex={-1}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-group-title"
              aria-describedby="delete-group-desc"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl p-10 text-center outline-none"
            >
              <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 id="delete-group-title" className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3 font-display">Delete Group?</h3>
              <p id="delete-group-desc" className="text-zinc-500 dark:text-zinc-400 text-sm mb-10 leading-relaxed">This will permanently delete the group <strong>{group?.name}</strong> and all its expenses. This action cannot be undone.</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleteGroupConfirmOpen(false)}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteGroup}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-red-500/20 active:scale-95"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stat Details Modal */}
      <AnimatePresence>
        {selectedStatDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStatDetails(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              ref={statModalRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="stat-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl p-10 text-center outline-none"
            >
              <p id="stat-title" className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4 font-display">{selectedStatDetails.title}</p>
              <p className="text-5xl sm:text-6xl font-bold text-zinc-900 dark:text-white font-display tracking-tight mb-2 break-all">
                ${formatCurrency(selectedStatDetails.amount)}
              </p>
              {selectedStatDetails.subtitle && (
                <p className="text-sm font-medium text-zinc-500 mt-4">
                  {selectedStatDetails.subtitle}
                </p>
              )}
              <button
                onClick={() => setSelectedStatDetails(null)}
                className="w-full py-4 bg-zinc-900 dark:bg-indigo-600 text-white rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-indigo-700 transition-all mt-8 shadow-lg shadow-zinc-200 dark:shadow-indigo-500/20 active:scale-95"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {expenseToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setExpenseToDelete(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              ref={deleteExpenseModalRef}
              tabIndex={-1}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-expense-title"
              aria-describedby="delete-expense-desc"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl p-10 text-center outline-none"
            >
              <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 id="delete-expense-title" className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3 font-display">Delete Expense?</h3>
              <p id="delete-expense-desc" className="text-zinc-500 dark:text-zinc-400 text-sm mb-10 leading-relaxed">
                {expenses.find(e => e.id === expenseToDelete)?.isRecurring 
                  ? "This is part of a recurring series. Would you like to delete only this occurrence or the entire series?" 
                  : "Are you sure you want to delete this expense? This action cannot be undone."}
              </p>
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <button
                    onClick={() => setExpenseToDelete(null)}
                    disabled={isDeletingSeries}
                    className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!expenses.find(e => e.id === expenseToDelete)?.isRecurring) {
                        handleDeleteExpense(expenseToDelete!);
                      } else {
                        handleDeleteExpense(expenseToDelete!, updateChoice);
                      }
                    }}
                    disabled={isDeletingSeries}
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-red-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeletingSeries && <Loader2 className="w-5 h-5 animate-spin" />}
                    Delete
                  </button>
                </div>

                {expenses.find(e => e.id === expenseToDelete)?.isRecurring && (
                  <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-left mb-2">Select deletion scope:</p>
                    {(['this', 'future', 'series'] as const).map((choice) => (
                      <button
                        key={choice}
                        onClick={() => setUpdateChoice(choice)}
                        className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${
                          updateChoice === choice 
                            ? 'border-red-600 bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400' 
                            : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 hover:border-zinc-200 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="min-w-0 pr-4">
                          <p className="text-sm font-bold capitalize">
                            {choice === 'this' ? 'Just this occurrence' : choice === 'future' ? 'This and all future' : 'All instances in series'}
                          </p>
                          <p className="text-[10px] font-medium opacity-70">
                            {choice === 'this' ? 'Only the selected transaction will be removed' : choice === 'future' ? 'Removes this and all upcoming repeats' : 'Every occurrence of this expense will be removed'}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${updateChoice === choice ? 'border-red-600' : 'border-zinc-300 dark:border-zinc-600'}`}>
                          {updateChoice === choice && <div className="w-2.5 h-2.5 bg-red-600 rounded-full" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRecurrenceUpdateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[40px] p-8 shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 mx-auto">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3 font-display text-center">Update Series?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 leading-relaxed text-center">This is part of a recurring series. How would you like to apply these changes?</p>
              
              <div className="space-y-3 mb-8">
                {(['this', 'future', 'series'] as const).map((choice) => (
                  <button
                    key={choice}
                    onClick={() => setUpdateChoice(choice)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${
                      updateChoice === choice 
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                        : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 hover:border-zinc-200 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold capitalize">
                        {choice === 'this' ? 'This instance only' : choice === 'future' ? 'This and all future' : 'All instances in series'}
                      </p>
                      <p className="text-[10px] font-medium opacity-70">
                        {choice === 'this' ? 'Only the selected transaction will be updated' : choice === 'future' ? 'Updates this and all upcoming repeats' : 'Every occurrence of this expense will be updated'}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${updateChoice === choice ? 'border-indigo-600' : 'border-zinc-300 dark:border-zinc-600'}`}>
                      {updateChoice === choice && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowRecurrenceUpdateModal(false);
                    setUpdateChoice('this');
                  }}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddExpense()}
                  disabled={isSaving}
                  className="flex-1 py-4 bg-zinc-900 dark:bg-indigo-600 text-white rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-indigo-700 transition-all shadow-lg shadow-zinc-200 dark:shadow-indigo-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setViewingExpense(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl p-6 sm:p-10 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  {(() => {
                    const config = CATEGORY_CONFIG[viewingExpense.category] || CATEGORY_CONFIG['Other'];
                    const Icon = config.icon;
                    return (
                      <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center ${config.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    );
                  })()}
                  <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-display">{viewingExpense.category}</h3>
                </div>
                <button 
                  onClick={() => setViewingExpense(null)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-8">
                <div className="flex flex-col items-center justify-center text-center p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-[32px] border border-zinc-100 dark:border-zinc-700/50">
                  {viewingExpense.isRecurring && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border border-indigo-100 dark:border-indigo-500/20 mb-4">
                      <Repeat className="w-3 h-3" />
                      Recurring Series
                    </div>
                  )}
                  <div className="text-3xl font-bold text-zinc-900 dark:text-white font-mono tracking-tight mb-2">
                    ${formatCurrency(viewingExpense.amount)}
                  </div>
                  <h4 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{viewingExpense.description}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{viewingExpense.date.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    {viewingExpense.dueDate && (
                      <>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due {viewingExpense.dueDate.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    Contribution Breakdown
                    <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[8px] border border-zinc-200 dark:border-zinc-700 uppercase">{viewingExpense.splitType} split</span>
                  </h5>
                  <div className="space-y-3">
                    {members.map(member => {
                      let shareAmount = 0;
                      let shareDisplay = '';

                      if (viewingExpense.splitType === 'equal') {
                        shareAmount = viewingExpense.amount / members.length;
                        shareDisplay = 'Equal share';
                      } else if (viewingExpense.splitType === 'percentage') {
                        const percent = viewingExpense.splitDetails?.[member.uid] || 0;
                        shareAmount = (percent / 100) * viewingExpense.amount;
                        shareDisplay = `${percent}% share`;
                      } else if (viewingExpense.splitType === 'exact') {
                        shareAmount = viewingExpense.splitDetails?.[member.uid] || 0;
                        shareDisplay = 'Exact amount';
                      }

                      return (
                        <div key={member.uid} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-zinc-50 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-xs font-bold text-zinc-400 border border-zinc-100 dark:border-zinc-700">
                              {member.displayName?.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-zinc-900 dark:text-white">
                                {member.displayName}
                                {member.uid === viewingExpense.paidBy && (
                                  <span className="ml-2 text-[9px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-500/20">PAID</span>
                                )}
                              </p>
                              <p className="text-[10px] text-zinc-400 font-medium">{shareDisplay}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-zinc-900 dark:text-white font-mono">${formatCurrency(shareAmount)}</p>
                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{member.uid === viewingExpense.paidBy ? 'Contributed' : 'Owes'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(user.uid === viewingExpense.paidBy || userIsAdmin) && (
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => {
                        const exp = viewingExpense;
                        setViewingExpense(null);
                        setEditingExpense(exp);
                      }}
                      className="flex-1 py-4 bg-zinc-900 dark:bg-indigo-600 text-white rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                    <button 
                      onClick={() => {
                        const id = viewingExpense.id;
                        setViewingExpense(null);
                        setExpenseToDelete(id);
                      }}
                      className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {managingRecurrenceId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setManagingRecurrenceId(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl shadow-indigo-500/10 overflow-hidden flex flex-col max-h-[85vh] border border-zinc-100 dark:border-zinc-800"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Repeat className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-display">Manage Recurring Series</h3>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Series ID: {managingRecurrenceId.slice(0, 8)}...</p>
                  </div>
                </div>
                <button 
                  onClick={() => setManagingRecurrenceId(null)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-100 dark:border-zinc-700/50">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Series Info</p>
                    {(() => {
                      const seriesExpenses = expenses.filter(e => e.recurrenceId === managingRecurrenceId);
                      const first = seriesExpenses[0];
                      if (!first) return null;
                      return (
                        <div className="space-y-3">
                          <p className="text-lg font-bold text-zinc-900 dark:text-white">{first.description}</p>
                          <div className="flex items-center gap-2">
                             <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${(CATEGORY_CONFIG[first.category] || CATEGORY_CONFIG['Other']).bg} ${(CATEGORY_CONFIG[first.category] || CATEGORY_CONFIG['Other']).color}`}>
                              {first.category}
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono">${formatCurrency(first.amount)} / period</span>
                          </div>
                          <p className="text-[10px] font-medium text-zinc-500">
                            Total series value: <span className="font-bold text-zinc-900 dark:text-white">${formatCurrency(seriesExpenses.reduce((sum, e) => sum + e.amount, 0))}</span>
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="p-6 bg-indigo-50/30 dark:bg-indigo-500/5 rounded-3xl border border-indigo-100/50 dark:border-indigo-500/10">
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-4">Series Actions</p>
                    <div className="space-y-3">
                      <button 
                        onClick={() => {
                          const first = expenses.find(e => e.recurrenceId === managingRecurrenceId);
                          if (first) {
                            setManagingRecurrenceId(null);
                            setEditingExpense(first);
                            setUpdateChoice('series');
                          }
                        }}
                        className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit Entire Series
                      </button>
                      <button 
                        onClick={() => {
                          const first = expenses.find(e => e.recurrenceId === managingRecurrenceId);
                          if (first) {
                            setManagingRecurrenceId(null);
                            setExpenseToDelete(first.id);
                            setUpdateChoice('series');
                          }
                        }}
                        className="w-full py-3 bg-white dark:bg-zinc-800 text-red-600 border border-red-100 dark:border-red-900/30 rounded-2xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Entire Series
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 px-2">Series Instances ({expenses.filter(e => e.recurrenceId === managingRecurrenceId).length})</h4>
                  <div className="space-y-2">
                    {expenses.filter(e => e.recurrenceId === managingRecurrenceId).sort((a,b) => a.date.toMillis() - b.date.toMillis()).map((instance) => (
                      <div key={instance.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-white dark:bg-zinc-900 rounded-lg flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-800">
                             <span className="text-[8px] font-bold uppercase text-zinc-400">{instance.date.toDate().toLocaleDateString('en-US', { month: 'short' })}</span>
                             <span className="text-xs font-bold text-zinc-900 dark:text-white leading-none">{instance.date.toDate().getDate()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900 dark:text-white">{instance.date.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-bold uppercase tracking-wider ${instance.status === 'paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {instance.status}
                              </span>
                              {instance.dueDate && (
                                <span className="text-[9px] font-medium text-zinc-400 italic">Due {instance.dueDate.toDate().toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setManagingRecurrenceId(null);
                              setViewingExpense(instance);
                            }}
                            className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                            title="View Transaction"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setManagingRecurrenceId(null);
                              setEditingExpense(instance);
                              setUpdateChoice('this');
                            }}
                            className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                            title="Edit Instance"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800">
                <button 
                  onClick={() => setManagingRecurrenceId(null)}
                  className="w-full py-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-all active:scale-95"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
