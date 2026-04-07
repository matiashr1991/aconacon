'use client';

import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  FileSpreadsheet, 
  Package, 
  Truck, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Bell,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: FileSpreadsheet, label: 'Ventas', href: '/ventas' },
  { icon: Truck, label: 'Proveedores', href: '/proveedores' },
  { icon: DollarSign, label: 'Precios', href: '/precios' },
  { icon: Package, label: 'Productos', href: '/productos' },
  { icon: BarChart3, label: 'Reportes', href: '/reportes' },
  { icon: Settings, label: 'Configuración', href: '/settings' },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? '80px' : '260px' }}
        className="relative flex flex-col border-r border-slate-200 bg-white z-50 overflow-hidden shadow-sm"
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-bold text-lg tracking-tight text-slate-900"
              >
                Aconcagua <span className="text-emerald-600">v2</span>
              </motion.span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-emerald-50 text-emerald-700 font-bold" 
                    : "text-slate-500 hover:bg-slate-50 font-medium"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-emerald-600" : "group-hover:text-emerald-500")} />
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute left-1 w-1 h-6 bg-emerald-600 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:bg-slate-50 transition-colors font-medium text-sm"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!collapsed && <span>Colapsar</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white shadow-sm flex items-center justify-between px-8 z-40">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Aconcagua v2</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white" />
            </button>
            <div className="h-6 w-[1px] bg-slate-200 mx-2" />
            <div className="flex items-center gap-3 pl-2 cursor-pointer group">
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Admin</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Aconcagua</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center overflow-hidden shadow-inner font-bold text-emerald-700">
                A
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
          <div className="max-w-7xl mx-auto py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
