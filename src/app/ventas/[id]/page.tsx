'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  TrendingUp, 
  Package, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Search,
  Filter,
  Loader2,
  PieChart,
  Users,
  Store,
  Receipt,
  DollarSign
} from 'lucide-react';
import { getDashboardData } from './actions';

type Batch = any;
type ProfitLine = any;

export default function ImportReviewPage() {
  const { id } = useParams();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [lines, setLines] = useState<ProfitLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (id) fetchData(debouncedSearch);
  }, [id, debouncedSearch]);

  async function fetchData(search?: string) {
    try {
      setLoading(true);
      const { batch: batchData, lines: profitData, error } = await getDashboardData(id as string, search);
      if (error) throw new Error(error);
      setBatch(batchData);
      setLines(profitData || []);
    } catch (err) {
      console.error('Error fetching import detail:', err);
    } finally {
      setLoading(false);
    }
  }

  // Stats
  const totalNetSales = lines.reduce((acc: number, l: any) => acc + Number(l.net_subtotal || 0), 0);
  const linesWithCost = lines.filter((l: any) => l.purchase_cost_net_from_report && Number(l.purchase_cost_net_from_report) > 0);
  const costCoverage = lines.length > 0 ? (linesWithCost.length / lines.length * 100) : 0;
  const uniqueCustomers = new Set(lines.map((l: any) => l.customer).filter(Boolean)).size;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-slate-500 font-bold animate-pulse">Cargando importación...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-4">
          <button 
            onClick={() => window.location.href = '/ventas'}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver a Sábanas
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Revisión de Importación</h1>
            <p className="text-slate-500 font-medium">Lote de Ventas: <span className="text-slate-900 font-bold">{batch?.original_filename || 'Sin nombre'}</span></p>
          </div>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={() => window.location.href = '/reportes'}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white hover:bg-slate-900 rounded-xl font-bold shadow-sm transition-all text-sm"
            >
                <PieChart className="w-4 h-4" />
                Ir a Reportes de Rentabilidad
            </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Total Líneas</p>
            <p className="text-2xl font-bold text-slate-900">{lines.length.toLocaleString()}</p>
         </div>
         <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Clientes</p>
            <p className="text-2xl font-bold text-slate-900">{uniqueCustomers}</p>
         </div>
         <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Venta Neta Total</p>
            <p className="text-2xl font-bold text-slate-900">
                ${totalNetSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
         </div>
         <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Cobertura de Costos</p>
            <p className={`text-2xl font-bold ${costCoverage > 80 ? 'text-emerald-600' : costCoverage > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {costCoverage.toFixed(1)}%
            </p>
         </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
               <Filter className="w-4 h-4" /> Líneas Importadas
             </div>
             <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded border border-amber-100 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Máx 100 resultados. Use buscador.
             </span>
           </div>
           <div className="relative w-full sm:w-80">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <input 
               type="text"
               placeholder="Buscar por código, producto, cliente..."
               className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Cód.</th>
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Producto</th>
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Cant.</th>
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">P. Venta Neto</th>
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Subtotal Neto</th>
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right border-l">Costo Compra</th>
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Cliente</th>
                <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Proveedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <p className="text-slate-400 font-medium">No se encontraron líneas importadas.</p>
                  </td>
                </tr>
              ) : (
                lines.map((line: any) => {
                  const hasCost = line.purchase_cost_net_from_report && Number(line.purchase_cost_net_from_report) > 0;
                  return (
                    <tr key={line.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-3 align-top">
                        <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {line.product_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs align-top">
                        <p className="text-xs font-semibold text-slate-700 truncate">{line.product_description}</p>
                        {line.is_credit_note && (
                          <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded mt-1 inline-block">NC</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-600 text-center align-top">{line.quantity}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-900 text-right align-top">
                        ${Number(line.net_unit_sale_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-xs font-black text-indigo-900 text-right align-top">
                        ${Number(line.net_subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-4 py-3 text-xs font-bold text-right align-top border-l border-slate-100 ${hasCost ? 'text-emerald-700' : 'text-red-400'}`}>
                        {hasCost 
                          ? `$${Number(line.purchase_cost_net_from_report).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '—'
                        }
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="text-[10px] font-bold text-slate-600 truncate max-w-[180px] block">
                          {line.customer || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="text-[10px] font-medium text-slate-400 truncate max-w-[150px] block">
                          {line.supplier_text || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
