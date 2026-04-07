'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Package, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  Receipt
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';

import { getDashboardStatsAction } from './dashboard-actions';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalCost: 0,
    importCount: 0,
    matchRate: 0,
    recentActivity: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const result = await getDashboardStatsAction();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-10 p-6 md:p-10">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Panel de Control</h1>
          <p className="text-slate-500 font-medium">Resumen corporativo de rentabilidad y costos.</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-semibold text-slate-600">
          <Calendar className="w-4 h-4 text-emerald-600" />
          Marzo 2026
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Ventas Netas Totales', value: `$${(stats.totalSales / 1000000).toFixed(1)}M`, growth: '', up: true, icon: TrendingUp },
          { label: 'Costo Estimado', value: `$${(stats.totalCost / 1000000).toFixed(1)}M`, growth: '', up: false, icon: Package },
          { label: 'Rentabilidad Brutal', value: `$${((stats.totalSales - stats.totalCost) / 1000000).toFixed(1)}M`, growth: '', up: true, icon: BarChart3 },
          { label: 'Tasa de Match', value: `${stats.matchRate.toFixed(1)}%`, growth: '', up: true, icon: CheckCircle2 },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-emerald-500/30 hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <stat.icon className="w-5 h-5" />
              </div>
              {stat.growth && (
                <div className={cn(
                  "flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full",
                  stat.up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                )}>
                  {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.growth}
                </div>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h2>
          </div>
        ))}
      </div>

      {/* Quick Actions & Pending Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions (Primary Focus) */}
        <div className="lg:col-span-1 space-y-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            Acciones Rápidas
          </h3>
          <div className="flex flex-col gap-4">
            <Link 
              href="/ventas" 
              className="group p-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-sm hover:shadow-lg hover:shadow-emerald-600/20 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold">Subir Sábana de Ventas</p>
                  <p className="text-xs text-white/70 font-medium">Importar reporte mensual</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link 
              href="/proveedores" 
              className="group p-5 bg-white border border-slate-200 hover:border-emerald-600 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between text-slate-900"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-50 text-emerald-600 rounded-lg group-hover:bg-emerald-50 transition-colors">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">Listas de Proveedores</p>
                  <p className="text-xs text-slate-500 font-medium">Actualizar Snapshot de costos</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>

        {/* Status / History (Simple List) */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Actividad Reciente
          </h3>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100 overflow-hidden">
            {stats.recentActivity.length === 0 ? (
              <div className="p-20 text-center text-slate-400 font-medium">No hay actividad reciente.</div>
            ) : (
              stats.recentActivity.map((batch, i) => (
                <div key={i} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-lg bg-slate-50", batch.source_type === 'sales' ? 'text-emerald-600' : 'text-blue-600')}>
                      {batch.source_type === 'sales' ? <Receipt className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{batch.original_filename}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Sistema • {new Date(batch.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    batch.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  )}>
                    {batch.status === 'completed' ? 'Procesado' : 'Pendiente'}
                  </span>
                </div>
              ))
            )}
          </div>
          <button className="w-full py-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
            Ver todo el historial
          </button>
        </div>
      </div>
    </div>
  );
}
