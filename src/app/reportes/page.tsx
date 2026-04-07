'use client';

import React, { useState, useEffect } from 'react';
import { 
  getSalesBatchesAction, 
  getProfitabilitySummaryAction, 
  getProfitabilityLinesAction, 
  getProfitabilityGroupedByProductAction,
  getProfitabilityGroupedBySupplierAction,
  runProfitabilityMatchAction,
  getDrilldownLinesAction
} from './actions';
import { 
  PieChart, Calendar, RefreshCcw, Loader2, FileSpreadsheet, Activity, DollarSign, 
  TrendingUp, CheckCircle2, AlertCircle, Box, Truck, Search, ChevronRight, X, Info, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReportesPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  
  // Date Filters
  const [salesDateFrom, setSalesDateFrom] = useState('');
  const [salesDateTo, setSalesDateTo] = useState('');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  
  // Tabs
  const [reportType, setReportType] = useState<'details' | 'products' | 'suppliers'>('details');

  const [loading, setLoading] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  
  const [summary, setSummary] = useState<any>(null);
  const [detailsData, setDetailsData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [suppliersData, setSuppliersData] = useState<any[]>([]);
  const [metadata, setMetadata] = useState({ total: 0, page: 1, limit: 100, totalPages: 1 });
  
  // Visibility State
  const [hasGenerated, setHasGenerated] = useState(false);

  // Drill-down State
  const [selectedDrilldown, setSelectedDrilldown] = useState<{ type: 'product' | 'supplier', value: string, title: string } | null>(null);
  const [drilldownData, setDrilldownData] = useState<any[]>([]);
  const [isDrilldownLoading, setIsDrilldownLoading] = useState(false);
  
  useEffect(() => {
    getSalesBatchesAction().then(res => {
      if (res.success && res.data) {
        setBatches(res.data);
        if (res.data.length > 0) setSelectedBatch(res.data[0].id);
      }
    });
  }, []);


  const loadData = async (batchId: string, page = 1, searchOverride?: string) => {
    if (!batchId) return;
    setLoading(true);

    const activeSearch = searchOverride !== undefined ? searchOverride : appliedSearch;

    const summRes = await getProfitabilitySummaryAction(batchId, salesDateFrom, salesDateTo);
    if (summRes.success) setSummary(summRes.data);

    if (reportType === 'details') {
      const res = await getProfitabilityLinesAction(batchId, page, 100, salesDateFrom, salesDateTo, activeSearch);
      if (res.success) {
        setDetailsData(res.data || []);
        setMetadata(res.metadata || { total: 0, page: 1, limit: 100, totalPages: 1 });
      }
    } else if (reportType === 'products') {
      const res = await getProfitabilityGroupedByProductAction(batchId, salesDateFrom, salesDateTo, activeSearch);
      if (res.success) setProductsData(res.data || []);
    } else if (reportType === 'suppliers') {
      const res = await getProfitabilityGroupedBySupplierAction(batchId, salesDateFrom, salesDateTo, activeSearch);
      if (res.success) setSuppliersData(res.data || []);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (hasGenerated) {
      loadData(selectedBatch, metadata.page || 1);
    }
  }, [reportType, appliedSearch, hasGenerated]);

  const handleSearch = () => {
    setAppliedSearch(searchQuery);
  };

  const handleRunMath = async () => {
    if (!selectedBatch) return alert("Selecciona un lote primero");
    if (!salesDateFrom || !salesDateTo) return alert("Debes indicar el rango de fechas (Desde/Hasta)");
    
    setIsComputing(true);
    const res = await runProfitabilityMatchAction(selectedBatch);
    if (res.success) {
      setHasGenerated(true);
      // Explicitly load initial summary and top results
      await loadData(selectedBatch, 1, searchQuery);
      setAppliedSearch(searchQuery);
    } else {
      alert("Error al procesar: " + res.error);
    }
    // Small timeout for better UX if computed too fast
    setTimeout(() => setIsComputing(false), 800);
  };

  const formatCurrency = (val: string | number | null) => {
    if (val === null || val === undefined) return '-';
    const num = Number(val);
    return isNaN(num) ? '-' : new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const loadDrilldownData = async (type: 'product' | 'supplier', value: string) => {
    if (!selectedBatch) return;
    setIsDrilldownLoading(true);
    const res = await getDrilldownLinesAction(selectedBatch, type, value, salesDateFrom, salesDateTo);
    if (res.success) {
      setDrilldownData(res.data || []);
    }
    setIsDrilldownLoading(false);
  };

  useEffect(() => {
    if (selectedDrilldown) {
      loadDrilldownData(selectedDrilldown.type, selectedDrilldown.value);
    } else {
      setDrilldownData([]);
    }
  }, [selectedDrilldown]);

  return (
    <div className="space-y-6 relative">
      
      {/* Immersive Computations Loading Overlay */}
      <AnimatePresence>
        {isComputing && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }} 
              className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center"
            >
              <div className="relative w-20 h-20">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-indigo-600" />
                <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} className="absolute inset-2 rounded-full border-4 border-slate-100 border-b-emerald-500" />
                <RefreshCcw className="absolute inset-0 m-auto w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Analizando Rentabilidad</h3>
                <p className="text-sm text-slate-500 mt-2 font-medium">Cruzando precios vigentes y resolviendo deducciones a la velocidad de la luz...</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <PieChart className="w-8 h-8 text-indigo-600" />
            Control de Rentabilidad Avanzado
          </h1>
          <p className="text-slate-500 font-medium">Motor de Inteligencia de Negocios para cruce de listas masivas y análisis de márgenes.</p>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Lote / Periodo de Ventas</label>
            <div className="relative">
              <FileSpreadsheet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500" />
              <select 
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium appearance-none"
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
              >
                <option value="">Selecciona un Lote</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.original_filename} - Subido: {new Date(b.uploaded_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha Ventas (Desde)</label>
            <input 
              type="date" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-600"
              value={salesDateFrom} onChange={(e) => setSalesDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha Ventas (Hasta)</label>
            <input 
              type="date" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-600"
              value={salesDateTo} onChange={(e) => setSalesDateTo(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-slate-100 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">Motor Analítico: Cruce de Datos</label>
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-3">
              <div className="p-2 bg-amber-200 rounded-lg">
                <Calendar className="w-4 h-4 text-amber-700" />
              </div>
              <p className="text-[11px] text-amber-800 font-medium leading-tight">
                El sistema detectará automáticamente la fecha de cada venta y buscará el costo vigente en esa fecha histórica. 
                <span className="block mt-1 font-bold">Matching: Artículo → EAN → Cód. Secundario.</span>
              </p>
            </div>
          </div>
          <div className="md:col-span-2">
            <button 
              onClick={handleRunMath}
              disabled={isComputing || !selectedBatch || !targetDate}
              className="w-full h-[50px] bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <RefreshCcw className="w-5 h-5" /> Generar Cruce de Rentabilidad
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard KPI Summary */}
      {summary && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Activity className="w-4 h-4" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Venta Bruta (Filtro)</h3>
            </div>
            <p className="text-3xl font-black text-slate-800">{formatCurrency(summary.totalSalesGross)}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <DollarSign className="w-4 h-4" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Costo Neto Localizado</h3>
            </div>
            <p className="text-3xl font-black text-rose-600">{formatCurrency(summary.totalCostAmount)}</p>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center gap-2 text-indigo-600 mb-2 relative z-10">
              <TrendingUp className="w-4 h-4" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Margen Bruto</h3>
            </div>
            <div className="relative z-10">
              <p className="text-3xl font-black text-indigo-900">{formatCurrency(summary.totalGrossMargin)}</p>
              <p className="text-sm font-bold text-indigo-700 mt-1">Margen Promedio: {summary.marginPct ? Number(summary.marginPct).toFixed(2) : '0.00'}%</p>
            </div>
            <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 text-indigo-500/5 rotate-12 z-0" />
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Líneas Analizadas</h3>
            </div>
            <div>
              <p className="text-3xl font-black text-slate-800">{summary.matchedItems} <span className="text-lg text-slate-400">/ {summary.totalItems}</span></p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Dashboard State Presenter */}
      {!hasGenerated ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-dashed border-slate-200 rounded-[32px] p-20 flex flex-col items-center text-center space-y-6"
        >
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center animate-pulse">
            <Activity className="w-12 h-12" />
          </div>
          <div className="max-w-md">
            <h2 className="text-2xl font-black text-slate-800 italic">Listo para Analizar</h2>
            <p className="text-slate-500 font-medium mt-2">
              Selecciona un lote y define el rango de fechas arriba. <br />
              Luego haz clic en <span className="text-indigo-600 font-bold">"Generar Cruce de Rentabilidad"</span> para procesar los datos históricos.
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col">
        {/* Tab Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-b border-slate-100 gap-4">
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setReportType('details')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportType === 'details' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FileSpreadsheet className="w-4 h-4" /> Detalle (Linea a Linea)
            </button>
            <button 
              onClick={() => setReportType('products')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportType === 'products' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Box className="w-4 h-4" /> Agrupado por Artículos
            </button>
            <button 
              onClick={() => setReportType('suppliers')}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportType === 'suppliers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Truck className="w-4 h-4" /> Agrupado por Proveedor
            </button>
          </div>

          <div className="relative w-full sm:w-80 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Proveedor, Artículo, Cliente..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm text-slate-700 transition-shadow"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button 
              onClick={handleSearch}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap"
            >
              Filtrar
            </button>
          </div>
        </div>

        {/* Data Tables depending on active tab */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            {/* Table Header */}
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 uppercase text-[11px] font-bold text-slate-400 tracking-wider">
                {reportType === 'details' && (
                  <>
                    <th className="px-6 py-4">Status / Origen</th>
                    <th className="px-6 py-4">Comercial (Suc / Vend)</th>
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-6 py-4 text-center border-l border-slate-100">Cant.</th>
                    <th className="px-6 py-4 text-right">Venta Total</th>
                    <th className="px-6 py-4 text-right border-l border-slate-100 bg-rose-50/30">Costo Unit.</th>
                    <th className="px-6 py-4 text-right bg-rose-50/30">Costo Total</th>
                    <th className="px-6 py-4 text-right border-l border-slate-100 bg-indigo-50/30">Margen ($ / %)</th>
                  </>
                )}
                {reportType === 'products' && (
                  <>
                    <th className="px-6 py-4">Artículo</th>
                    <th className="px-6 py-4 text-center border-l border-slate-100">Cant. Acum.</th>
                    <th className="px-6 py-4 text-right">Venta Total</th>
                    <th className="px-6 py-4 text-right border-l border-slate-100 bg-rose-50/30">Costo Total Absorbido</th>
                    <th className="px-6 py-4 text-right border-l border-slate-100 bg-indigo-50/30">Rentabilidad Global ($ / %)</th>
                  </>
                )}
                {reportType === 'suppliers' && (
                  <>
                    <th className="px-6 py-4">Marca / Proveedor Principal</th>
                    <th className="px-6 py-4 text-center border-l border-slate-100">Unidades Totales</th>
                    <th className="px-6 py-4 text-right">Facturación Generada</th>
                    <th className="px-6 py-4 text-right border-l border-slate-100 bg-rose-50/30">Costo Directo (Pagado al Prov.)</th>
                    <th className="px-6 py-4 text-right border-l border-slate-100 bg-indigo-50/30">Retorno Obtenido ($ / %)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                     Generando Vista de Inteligencia...
                  </td>
                </tr>
              ) : (
                <>
                  {/* DETAILS TAB */}
                  {reportType === 'details' && (
                    appliedSearch === '' && detailsData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                             <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                               <Search className="w-6 h-6 opacity-30" />
                             </div>
                             <div>
                               <p className="font-bold text-slate-600">Búsqueda Requerida</p>
                               <p className="text-xs">Para ver el detalle línea a línea, ingrese un filtro o presione <button onClick={() => setAppliedSearch(' ')} className="text-indigo-600 font-bold hover:underline">Ver Primeros 100</button></p>
                             </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      detailsData.map(item => (
                        <tr key={item.saleLineId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              {item.status === 'complete' ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-tight">
                                  <CheckCircle2 className="w-3 h-3" /> OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold uppercase tracking-tight">
                                  <AlertCircle className="w-3 h-3" /> Sin Costo
                                </span>
                              )}
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${item.costMethod === 'supplier_list_historical' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                {item.costMethod === 'supplier_list_historical' ? 'Lista Proveedor' : item.costMethod === 'sales_report' ? 'Sábana Ventas' : (item.costMethod || 'N/A')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              {item.sucursal && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md self-start">{item.sucursal}</span>}
                              {item.vendedor && <span className="text-[11px] font-medium text-slate-500 mt-1 uppercase tracking-tight">{item.vendedor}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 line-clamp-1 max-w-[250px] break-words whitespace-normal leading-tight">{item.productName}</span>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-tighter">{item.productCode}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-black text-slate-600 border-l border-slate-100">{Number(item.quantity).toLocaleString('es-AR')}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(item.saleNetTotal)}</td>
                          <td className="px-6 py-4 text-right border-l border-slate-100 font-medium text-rose-600 bg-rose-50/10 hover:bg-rose-50/40">{formatCurrency(item.costUnitNet)}</td>
                          <td className="px-6 py-4 text-right font-bold text-rose-700 bg-rose-50/10 hover:bg-rose-50/40">{formatCurrency(item.costTotal)}</td>
                          <td className="px-6 py-4 text-right border-l border-slate-100 bg-indigo-50/10 hover:bg-indigo-50/40">
                            <div className="flex flex-col items-end">
                              <span className="font-black text-indigo-700">{formatCurrency(item.grossMargin)}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 mt-1 rounded ${Number(item.marginPct) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {Number(item.marginPct).toFixed(2)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )
                  )}

                  {/* PRODUCTS TAB */}
                  {reportType === 'products' && (
                    appliedSearch === '' && productsData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                             <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                               <Box className="w-6 h-6 opacity-30" />
                             </div>
                             <div>
                               <p className="font-bold text-slate-600">Búsqueda de Artículos</p>
                               <p className="text-xs">Para analizar por artículo, ingrese un filtro o presione <button onClick={() => setAppliedSearch(' ')} className="text-indigo-600 font-bold hover:underline">Ver Top 100</button></p>
                             </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      productsData.map(item => (
                        <tr 
                          key={item.productCode} 
                          className="hover:bg-indigo-50/30 transition-colors cursor-pointer group/row"
                          onClick={() => setSelectedDrilldown({ 
                            type: 'product', 
                            value: item.productCode, 
                            title: item.productName 
                          })}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover/row:bg-indigo-100 group-hover/row:text-indigo-600 transition-colors">
                                <Box className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 line-clamp-1 max-w-[350px] whitespace-normal break-words">{item.productName}</span>
                                <span className="text-xs text-slate-400 font-mono mt-0.5">{item.productCode}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-black text-slate-600 border-l border-slate-100">{Number(item.totalQuantity)}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(item.totalSalesGross)}</td>
                          <td className="px-6 py-4 text-right border-l border-slate-100 font-bold text-rose-700 bg-rose-50/10 group-hover/row:bg-rose-50/40">{formatCurrency(item.totalCostAmount)}</td>
                          <td className="px-6 py-4 text-right border-l border-slate-100 bg-indigo-50/10 group-hover/row:bg-indigo-50/40">
                            <div className="flex items-center justify-end gap-3">
                              <div className="flex flex-col items-end">
                                <span className="font-black text-indigo-700 text-base">{formatCurrency(item.totalGrossMargin)}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 mt-1 rounded-full ${Number(item.marginPct) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {Number(item.marginPct).toFixed(2)}%
                                </span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-slate-300 group-hover/row:text-indigo-500 transition-colors" />
                            </div>
                          </td>
                        </tr>
                      ))
                    )
                  )}

                  {/* SUPPLIERS TAB */}
                  {reportType === 'suppliers' && (
                    appliedSearch === '' && suppliersData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                             <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                               <Truck className="w-6 h-6 opacity-30" />
                             </div>
                             <div>
                               <p className="font-bold text-slate-600">Búsqueda de Proveedores</p>
                               <p className="text-xs">Para analizar por proveedor, ingrese un filtro o presione <button onClick={() => setAppliedSearch(' ')} className="text-indigo-600 font-bold hover:underline">Ver Todos</button></p>
                             </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      suppliersData.map(item => (
                        <tr 
                          key={item.supplierName} 
                          className="hover:bg-indigo-50/30 transition-colors cursor-pointer group/row"
                          onClick={() => setSelectedDrilldown({ 
                            type: 'supplier', 
                            value: item.supplierName, 
                            title: item.supplierName 
                          })}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover/row:bg-indigo-100 group-hover/row:text-indigo-600 transition-colors">
                                <Truck className="w-5 h-5" />
                              </div>
                              <span className="font-black text-slate-800 text-base">{item.supplierName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-black text-slate-600 text-base border-l border-slate-100">
                            {Number(item.totalQuantity).toLocaleString('es-AR')} u.
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900 text-base">{formatCurrency(item.totalSalesGross)}</td>
                          <td className="px-6 py-4 text-right border-l border-slate-100 font-bold text-rose-700 bg-rose-50/10 group-hover/row:bg-rose-50/40 text-base">{formatCurrency(item.totalCostAmount)}</td>
                          <td className="px-6 py-4 text-right border-l border-slate-100 bg-indigo-50/10 group-hover/row:bg-indigo-50/40">
                            <div className="flex justify-end items-center gap-4">
                              <div className="flex flex-col items-end">
                                <span className="font-black text-indigo-700 text-lg">{formatCurrency(item.totalGrossMargin)}</span>
                                <span className={`text-sm font-bold px-2 py-1 rounded-full ${Number(item.marginPct) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {Number(item.marginPct).toFixed(2)}%
                                </span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-slate-300 group-hover/row:text-indigo-500 transition-colors" />
                            </div>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Basic Pagination for lines */}
        {reportType === 'details' && metadata.totalPages > 1 && !loading && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-sm font-medium text-slate-500">
              Pagina {metadata.page} de {metadata.totalPages}
            </span>
            <div className="flex gap-2">
              <button 
                disabled={metadata.page === 1} onClick={() => loadData(selectedBatch, metadata.page - 1)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >Anterior</button>
              <button 
                disabled={metadata.page >= metadata.totalPages} onClick={() => loadData(selectedBatch, metadata.page + 1)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >Siguiente</button>
            </div>
          </div>
        )}
      </div>
    )}

      {/* Drill-down Modal */}
      <AnimatePresence>
        {selectedDrilldown && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setSelectedDrilldown(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-[95vw] xl:max-w-7xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Info className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 block mb-0.5">Desglose Detallado</span>
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                       {selectedDrilldown.title}
                       <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{selectedDrilldown.value}</span>
                    </h2>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDrilldown(null)}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-auto p-8">
                {isDrilldownLoading ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                    <p className="font-bold text-sm">Consultando transacciones individuales...</p>
                  </div>
                ) : drilldownData.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                     <AlertCircle className="w-12 h-12 mb-2 opacity-20" />
                     <p className="font-bold">No se encontraron líneas para este filtro.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {/* Calculation Helper Card */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex gap-6 items-start shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600 flex-shrink-0">
                        <HelpCircle className="w-5 h-5" />
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Margen Teórico (TEO)</h4>
                          <p className="text-xs text-slate-600 leading-relaxed mb-2">
                            Compara los <strong>Precios de Lista</strong> (Brutos) de venta y compra. Ignora bonificaciones. 
                          </p>
                          <div className="text-[10px] bg-white border border-slate-100 rounded px-2 py-1 font-mono text-slate-400 inline-block">
                            (P.Lista Vta - P.Lista Compra) / P.Lista Vta
                          </div>
                        </div>
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Margen Real (REAL)</h4>
                          <p className="text-xs text-slate-600 leading-relaxed mb-2">
                            Tu ganancia efectiva. Compara lo que <strong>cobras neto</strong> vs lo que <strong>pagas neto</strong> (con bonos).
                          </p>
                          <div className="text-[10px] bg-white border border-slate-100 rounded px-2 py-1 font-mono text-slate-400 inline-block">
                            (Neto Venta - Neto Compra) / Neto Venta
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr className="uppercase text-[10px] font-black text-slate-400 tracking-tighter">
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4">Sucursal / Vendedor</th>
                            <th className="px-6 py-4">Cliente / Artículo</th>
                            <th className="px-4 py-4 text-center border-l border-slate-100 bg-amber-50/20">
                              <span className="block text-slate-400 font-medium">Lista</span>
                              Venta
                            </th>
                            <th className="px-4 py-4 text-center bg-amber-50/20">
                              <span className="block text-slate-400 font-medium">Bonif.</span>
                              Comer.
                            </th>
                            <th className="px-4 py-4 text-center bg-amber-50/20 font-bold text-amber-700">
                              <span className="block text-amber-600/40 font-medium">Efectivo</span>
                              Venta
                            </th>
                            <th className="px-4 py-4 text-center border-l border-slate-100 bg-emerald-50/20">
                              <span className="block text-slate-400 font-medium">Lista</span>
                              Compra
                            </th>
                            <th className="px-4 py-4 text-center bg-emerald-50/20 font-bold text-emerald-700">
                              <span className="block text-emerald-600/40 font-medium">Neto</span>
                              Compra
                            </th>
                            <th className="px-4 py-4 text-center border-l border-slate-100 bg-rose-50/30">Cant.</th>
                            <th className="px-6 py-4 text-right border-l border-slate-100 bg-indigo-50/30">Margen ($/%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {drilldownData.map((line) => {
                            const saleGross = Number(line.saleGrossUnitPrice) || 0;
                            const saleNet = Number(line.saleUnitPrice) || 0;
                            const costGross = Number(line.costUnitGross) || 0;
                            const costNet = Number(line.costUnitNet) || 0;
                            
                            // Theoretical Margin (List to List)
                            const theoreticalMargin = costGross > 0 ? ((saleGross - costGross) / saleGross) * 100 : 0;
                            const realMargin = Number(line.marginPct) || 0;
                            
                            return (
                              <tr key={line.saleLineId} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-slate-500 font-mono">
                                  {line.saleDate ? new Date(line.saleDate).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-black text-indigo-600 text-[10px]">{line.sucursal || 'Central'}</span>
                                    <span className="text-slate-500 font-medium">{line.vendedor || 'S/V'}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col max-w-[200px]">
                                    <span className="font-bold text-slate-800 truncate leading-tight" title={line.customer}>{line.customer || 'Mostrador'}</span>
                                    <span className="text-[10px] text-indigo-500 font-bold">{line.productCode} - {line.productName}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-center bg-amber-50/10 font-medium text-slate-600">{formatCurrency(saleGross)}</td>
                                <td className="px-4 py-4 text-center bg-amber-50/10">
                                   <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                                      {Number(line.saleDiscountPct).toFixed(1)}%
                                   </span>
                                </td>
                                <td className="px-4 py-4 text-center bg-amber-50/10 font-black text-amber-700">{formatCurrency(saleNet)}</td>
                                
                                <td className="px-4 py-4 text-center bg-emerald-50/10 font-medium text-slate-600">{formatCurrency(costGross)}</td>
                                <td className="px-4 py-4 text-center bg-emerald-50/10 font-black text-emerald-700">{formatCurrency(costNet)}</td>

                                <td className="px-4 py-4 text-center border-l border-slate-100 font-black text-slate-700 bg-rose-50/10">
                                  {Number(line.quantity).toLocaleString('es-AR')}
                                </td>
                                
                                <td className="px-6 py-4 text-right border-l border-slate-100 bg-indigo-50/10">
                                  <div className="flex flex-col items-end">
                                    <span className="font-black text-indigo-700">{formatCurrency(line.grossMargin)}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Real:</span>
                                      <span className={`text-[11px] font-black ${realMargin > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {realMargin.toFixed(2)}%
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Teo:</span>
                                      <span className="text-[11px] font-black text-slate-400">
                                        {theoreticalMargin.toFixed(2)}%
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="text-[10px] text-slate-400 font-medium">
                   Análisis de doble margen efectuado con costos netos recalculados.
                </div>
                <div className="flex items-center gap-6">
                   <div className="flex flex-col items-end">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Venta Total</span>
                     <span className="text-sm font-black text-slate-900">{formatCurrency(drilldownData.reduce((acc, l) => acc + Number(l.saleNetTotal || 0), 0))}</span>
                   </div>
                   <div className="flex flex-col items-end border-l border-slate-200 pl-6">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rentabilidad</span>
                     <span className="text-sm font-black text-emerald-600">{formatCurrency(drilldownData.reduce((acc, l) => acc + Number(l.grossMargin || 0), 0))}</span>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
