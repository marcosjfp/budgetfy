import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Expense, Group } from '../types';
import { formatCurrency } from '../utils/format';

interface CalendarViewProps {
  expenses: (Expense & { groupId: string })[];
  groups: Group[];
  onSelectGroup: (id: string) => void;
}

export default function CalendarView({ expenses, groups, onSelectGroup }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    
    // Fill previous month padding
    const firstDayIndex = date.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    // Fill current month
    while (date.getMonth() === month) {
      days.push({
        date: new Date(date),
        isCurrentMonth: true
      });
      date.setDate(date.getDate() + 1);
    }

    // Fill next month padding
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  }, [currentDate]);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  const getExpensesForDate = (date: Date) => {
    return expenses.filter(e => {
      const expenseDate = e.dueDate?.toDate() || e.date.toDate();
      return (
        expenseDate.getDate() === date.getDate() &&
        expenseDate.getMonth() === date.getMonth() &&
        expenseDate.getFullYear() === date.getFullYear()
      );
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden mb-12">
      <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-display tracking-tight text-zinc-900 dark:text-white">
              {monthName} <span className="text-zinc-400 font-medium">{year}</span>
            </h2>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Budget Calendar</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl text-zinc-500 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors"
          >
            Today
          </button>
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl text-zinc-500 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-4 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50/50 dark:bg-white/5">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {daysInMonth.map((day, idx) => {
          const dayExpenses = getExpensesForDate(day.date);
          const isToday = day.date.toDateString() === new Date().toDateString();
          const hasPending = dayExpenses.some(e => e.status === 'pending');
          const hasOverdue = dayExpenses.some(e => e.status === 'pending' && day.date < new Date());

          return (
            <div 
              key={idx} 
              className={`min-h-[140px] p-2 border-r border-b border-zinc-100 dark:border-zinc-800 last:border-r-0 relative transition-colors ${
                !day.isCurrentMonth ? 'bg-zinc-50/30 dark:bg-zinc-800/20' : 'bg-transparent hover:bg-zinc-50/50 dark:hover:bg-white/5'
              } ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : ''}`}
            >
              <div className="flex items-center justify-between mb-2 p-1">
                <span className={`text-xs font-bold ${
                  !day.isCurrentMonth ? 'text-zinc-300 dark:text-zinc-600' : 
                  isToday ? 'w-6 h-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center -ml-1' :
                  'text-zinc-500'
                }`}>
                  {day.date.getDate()}
                </span>
                {dayExpenses.length > 0 && (
                  <div className="flex gap-1">
                    {hasOverdue && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" title="Overdue Items" />}
                    {hasPending && !hasOverdue && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" title="Pending Items" />}
                    {!hasPending && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" title="All Paid" />}
                  </div>
                )}
              </div>
              
              <div className="space-y-1 overflow-y-auto max-h-[100px] custom-scrollbar">
                {dayExpenses.slice(0, 3).map(expense => (
                  <button
                    key={expense.id}
                    onClick={() => onSelectGroup(expense.groupId)}
                    className={`w-full text-left p-1.5 rounded-lg text-[9px] font-bold truncate border transition-all ${
                      expense.status === 'pending' 
                        ? (day.date < new Date() 
                          ? 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400' 
                          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400')
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    ${formatCurrency(expense.amount)} {expense.description}
                  </button>
                ))}
                {dayExpenses.length > 3 && (
                  <p className="text-[8px] font-bold text-zinc-400 text-center mt-1">+{dayExpenses.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
