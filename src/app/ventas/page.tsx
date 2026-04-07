'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Package,
  Receipt,
  FileText,
  Trash2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parseExcel } from '@/lib/import-engine';
import { Database } from '@/lib/database.types';
import { getSalesBatches, processSalesImportAction, deleteBatchAction } from './actions';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ImportBatch = Database['public']['Tables']['import_batch']['Row'];

export default function VentasPage() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Import State
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'sheet_selection' | 'header_selection' | 'mapping' | 'success'>('upload');
  const [workbookSheets, setWorkbookSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(1);
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, stage: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const salesFields = [
    // DATOS DEL COMPROBANTE
    { key: 'sale_date', label: 'Fecha Venta', required: true, group: 'COMPROBANTE' },
    { key: 'voucher_type', label: 'Tipo Comprobante (FCVTA, DVVTA...)', required: false, group: 'COMPROBANTE' },
    { key: 'comprobante_desc', label: 'Desc. Comprobante', required: false, group: 'COMPROBANTE' },
    { key: 'voucher_number', label: 'Nro de Comprobante', required: false, group: 'COMPROBANTE' },
    
    // CLIENTE
    { key: 'customer_code', label: 'Código de Cliente', required: false, group: 'CLIENTE' },
    { key: 'customer_name', label: 'Razón Social / Nombre', required: true, group: 'CLIENTE' },

    // CONTEXTO COMERCIAL
    { key: 'branch', label: 'Sucursal', required: false, group: 'CONTEXTO COMERCIAL' },
    { key: 'seller', label: 'Vendedor', required: false, group: 'CONTEXTO COMERCIAL' },
    { key: 'supplier_text', label: 'Proveedor', required: false, group: 'CONTEXTO COMERCIAL' },

    // ARTÍCULO
    { key: 'product_code', label: 'Código Artículo', required: true, group: 'ARTÍCULO Y CANTIDADES' },
    { key: 'product_description', label: 'Descripción Artículo', required: true, group: 'ARTÍCULO Y CANTIDADES' },
    { key: 'quantity', label: 'Cantidad (Bultos con Cargo)', required: true, group: 'ARTÍCULO Y CANTIDADES' },

    // PRECIOS DE VENTA
    { key: 'gross_unit_sale_price', label: 'Precio Unitario Bruto', required: false, group: 'PRECIOS DE VENTA' },
    { key: 'sale_discount_pct', label: 'Bonificación %', required: false, group: 'PRECIOS DE VENTA' },
    { key: 'net_unit_sale_price', label: 'Precio Neto Unitario', required: true, group: 'PRECIOS DE VENTA' },
    { key: 'net_subtotal', label: 'Subtotal Neto', required: true, group: 'PRECIOS DE VENTA' },

    // COSTOS (DEL REPORTE ERP)
    { key: 'purchase_cost_gross', label: 'Precio Compra Bruto', required: false, group: 'COSTOS DE COMPRA (ERP)' },
    { key: 'purchase_cost_net', label: 'Precio Compra Neto', required: true, group: 'COSTOS DE COMPRA (ERP)' },
  ];

  useEffect(() => {
    fetchBatches();
  }, []);

  async function fetchBatches() {
    try {
      const batches = await getSalesBatches();
      setBatches(batches as any);
    } catch (err) {
      console.error('Error fetching batches:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFile(file);
    try {
      const workbook = await parseExcel(file) as any;
      setWorkbookSheets(workbook.sheets);
      setSelectedSheet(workbook.selectedSheet);
      setRawRows(workbook.rawRows);
      
      if (workbook.sheets.length > 1) {
        setStep('sheet_selection');
      } else {
        setStep('header_selection');
      }
    } catch (err: any) {
      alert(err.message || 'Error al leer el archivo');
    }
  };

  const handleSheetChange = async (sheetName: string) => {
    if (!file) return;
    setSelectedSheet(sheetName);
    try {
      const workbook = await parseExcel(file, { sheetName }) as any;
      setRawRows(workbook.rawRows);
      setStep('header_selection');
    } catch (err: any) {
      alert('Error al leer la hoja seleccionada');
    }
  };

  const confirmHeaderRow = async (index: number) => {
    if (!file) return;
    const headerLine = index + 1;
    setHeaderRowIndex(headerLine);
    try {
      const workbook = await parseExcel(file, { sheetName: selectedSheet, headerRow: headerLine }) as any;
      setRawData(workbook.data);
      const cols = Object.keys(workbook.data[0] || {});
      setDetectedColumns(cols);
      
      const synonyms: Record<string, string[]> = {
        sale_date: ['fecha comprobante', 'fecha venta', 'emision', 'emisión', 'doc. fecha', 'f.venta', 'f. vta', 'fecha'],
        voucher_type: ['comprobante'],
        comprobante_desc: ['descripcion comprobante'],
        voucher_number: ['numero', 'nro comprobante', 'nro doc', 'número', 'nro. comp.', 'doc. numero', 'documento'],
        customer_code: ['cliente'],
        customer_name: ['razon social'],
        branch: ['descripcion sucursal', 'sucursal'],
        seller: ['descripcion vendedor', 'vendedor'],
        supplier_text: ['proveedor'],
        product_code: ['codigo de articulo', 'codigo', 'cod. art.', 'sku', 'cód. art.', 'cod_art', 'articulo'],
        product_description: ['descripcion de articulo', 'descripcion', 'detalle', 'descripción', 'descripción articulo'],
        quantity: ['bultos con cargo', 'bultos total', 'cantidad', 'cant.', 'unidades', 'bultos'],
        gross_unit_sale_price: ['precio unitario bruto'],
        sale_discount_pct: ['bonificacion %', 'bonificacion', 'bonific.'],
        net_unit_sale_price: ['precio neto unitario', 'precio unitario neto', 'p. unitario neto'],
        net_subtotal: ['subtotal neto', 'neto gravado', 'neto', 'subtotal'],
        purchase_cost_gross: ['precio de compra bruto'],
        purchase_cost_net: ['precio de compra neto'],
      };

      const suggestedMapping: Record<string, string> = {};
      cols.forEach(col => {
        const normalized = col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, ' ');
        for (const [target, labels] of Object.entries(synonyms)) {
          if (labels.some(l => normalized === l || normalized.includes(l))) {
            if (!suggestedMapping[target]) {
              suggestedMapping[target] = col;
            }
          }
        }
      });

      setMapping(suggestedMapping);
      setStep('mapping');
    } catch (err: any) {
      alert('Error al procesar la fila de títulos');
    }
  };

  const handleImport = async () => {
    if (!file || !period) return;
    setImporting(true);

    try {
      // 1. Prepare Data
      const fallbackDate = `${period}-01`;

      const mappedRows = rawData.map((row, idx) => {
        const mapped: any = {};
        
        // Match standard fields
        Object.entries(mapping).forEach(([target, source]) => {
          if (source) {
            let value = row[source];
            
            // Numeric fields detection 
            const numericFields = ['quantity', 'gross_unit_sale_price', 'sale_discount_pct', 'net_unit_sale_price', 'net_subtotal', 'purchase_cost_gross', 'purchase_cost_net'];
            
            if (numericFields.includes(target)) {
               mapped[target] = value;
               return;
            }

            // Date fields
            if (target === 'sale_date') {
              mapped[target] = value || fallbackDate;
              return;
            }
            
            mapped[target] = value;
          }
        });

        return mapped;
      });

      // 2. Submit to Server Action (Runs Drizzle completely on Node server)
      setImportProgress({ current: 0, total: mappedRows.length, stage: 'Procesando en local...' });
      const result = await processSalesImportAction(file.name, mappedRows, period);

      if (!result.success) {
        throw new Error(result.error);
      }

      setStep('success');
      setImportProgress({ current: 0, total: 0, stage: '' });
      fetchBatches();
    } catch (err: any) {
      console.error('Import error detailed:', err);
      // Detailed error for the user
      const dbError = err.error?.message || err.message;
      const dbDetails = err.error?.details || err.details || '';
      const suggestion = "Revisá que no hayas mapeado columnas con texto (ej. Descripciones) en campos de Precio/Cantidad.";
      
      alert(`Error durante la importación:\n\n${dbError || err.message}\n${dbDetails}\n\n${suggestion}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6 md:p-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sábanas de Ventas</h1>
          <p className="text-slate-500 font-medium">Ingesta mensual y revisión técnica de datos.</p>
        </div>
        <button 
          onClick={() => {
            setIsImportModalOpen(true);
            setStep('upload');
          }}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Importar Nueva Sábana
        </button>
      </div>

      {/* Stats Bar (Simple & Clean) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Reportes Cargados', value: batches.length, icon: FileSpreadsheet, color: 'text-emerald-600' },
          { label: 'Ventas Mar-26', value: '$24.5M', icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'Costo Resolver', value: '98.2%', icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Registros Totales', value: '—', icon: Layers, color: 'text-slate-600' },
        ].map((stat, i) => (
          <div key={i} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-4">
            <div className={cn("p-2.5 rounded-lg bg-slate-50", stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* List Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Historial de Importaciones</h3>
          <div className="flex gap-2">
            <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Filter className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : batches.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">No hay ventas cargadas</p>
              <p className="text-slate-500 font-medium">Comienza importando tu primer reporte mensual.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {batches.map((batch) => {
              const currentBatch = batch as any;
              const fromAction = Number(currentBatch.row_count || 0);
              const fromNotes = Number(currentBatch.notes?.match(/(\d+) filas/)?.[1] || 0);
              const totalRows = fromAction || fromNotes;

              return (
              <div key={batch.id} className="relative bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 pr-10">{currentBatch.original_filename || 'Sin nombre'}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {currentBatch.uploaded_at ? new Date(currentBatch.uploaded_at).toLocaleDateString() : '-'} • {totalRows.toLocaleString('es-AR')} registros
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      batch.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      {batch.status === 'completed' ? 'Procesado' : 'Pendiente'}
                    </span>
                    <button 
                      onClick={async (e) => {
                         e.stopPropagation();
                         if (confirm('¿Estás seguro que deseas eliminar esta sábana de ventas? Todos los registros, costos e historial relacionados serán eliminados. Esta acción no se puede deshacer.')) {
                            const res = await deleteBatchAction(batch.id);
                            if (res.success) {
                               fetchBatches();
                            } else {
                               alert(res.error);
                            }
                         }
                      }}
                      title="Eliminar Sábana"
                      className="text-slate-300 hover:text-rose-500 transition-colors p-1 rounded-md hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={() => window.location.href = `/ventas/${batch.id}`}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    Revisar Importación
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => !importing && setIsImportModalOpen(false)}
            />
            
            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Importar Sábana de Ventas</h3>
                    <p className="text-xs text-slate-500 font-medium">Mapeo y normalización automática de datos.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8">
                {step === 'upload' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        Período de Ventas
                      </label>
                      <input 
                        type="month"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-semibold text-sm"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                      />
                    </div>
                    
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="group border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all hover:bg-emerald-50/30"
                    >
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors">
                        <Upload className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-900">Selecciona el reporte mensual</p>
                        <p className="text-slate-500 text-sm font-medium">Soporta formatos .xlsx y .xls</p>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                      />
                    </div>
                  </div>
                )}

                {step === 'sheet_selection' && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 flex items-start gap-3">
                      <Layers className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="text-sm">
                        <p className="font-bold text-emerald-900">Se detectaron múltiples hojas</p>
                        <p className="text-emerald-700">Seleccioná la pestaña que contiene el detalle de los artículos.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                      {workbookSheets.map(s => (
                        <button
                          key={s}
                          onClick={() => handleSheetChange(s)}
                          className={cn(
                            "px-4 py-3 rounded-xl border-2 text-left transition-all",
                            selectedSheet === s 
                              ? "border-emerald-600 bg-emerald-50 text-emerald-900" 
                              : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                          )}
                        >
                          <p className="text-xs font-bold uppercase tracking-widest mb-1">Hoja</p>
                          <p className="font-bold truncate">{s}</p>
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-3 pt-6 border-t border-slate-100">
                      <button 
                        onClick={() => setStep('upload')}
                        className="w-full px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold"
                      >
                        Atrás y elegir otro archivo
                      </button>
                    </div>
                  </div>
                )}

                {step === 'header_selection' && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-3">
                      <Filter className="w-5 h-5 text-amber-600 shrink-0" />
                      <div className="text-sm">
                        <p className="font-bold text-amber-900">Seleccioná la fila de títulos</p>
                        <p className="text-amber-700">Hacé clic en la fila que contiene nombres como "Codigo de Articulo" o "Descripcion".</p>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                      <div className="overflow-x-auto max-h-[50vh]">
                        <table className="w-full text-xs text-left border-collapse">
                          <tbody className="divide-y divide-slate-100">
                            {rawRows.map((row, i) => (
                              <tr 
                                key={i} 
                                onClick={() => confirmHeaderRow(i)}
                                className="group cursor-pointer hover:bg-emerald-50 transition-colors"
                              >
                                <td className="px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 border-r border-slate-100 sticky left-0 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                                  {i + 1}
                                </td>
                                {row.map((cell, j) => (
                                  <td key={j} className="px-4 py-2 whitespace-nowrap text-slate-600 border-r border-slate-50 last:border-r-0">
                                    {String(cell || '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => setStep(workbookSheets.length > 1 ? 'sheet_selection' : 'upload')}
                        className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold"
                      >
                        Atrás
                      </button>
                    </div>
                  </div>
                )}

                {step === 'mapping' && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-emerald-900">
                            Hoja: <span className="text-emerald-600">{selectedSheet}</span> • Fila de títulos: <span className="text-emerald-600">{headerRowIndex}</span>
                          </p>
                          <p className="text-xs text-emerald-700">{rawData.length} artículos detectados para importar.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setStep('header_selection')}
                        className="px-3 py-1 bg-white border border-emerald-200 text-emerald-600 rounded-md text-[10px] font-bold uppercase hover:bg-emerald-50"
                      >
                        Ajustar Títulos
                      </button>
                    </div>

                    <div className="max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar space-y-8">
                      {Array.from(new Set(salesFields.map(f => f.group))).map(groupName => (
                        <div key={groupName} className="space-y-4">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{groupName}</h4>
                            <div className="h-px bg-slate-100 flex-1" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {salesFields.filter(f => f.group === groupName).map((field) => (
                              <div key={field.key} className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block truncate">
                                  {field.label} {field.required && <span className="text-rose-500">*</span>}
                                </label>
                                <select 
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                  value={mapping[field.key] || ''}
                                  onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                                >
                                  <option value="">Ignorar columna</option>
                                  {detectedColumns.map(col => (
                                    <option key={col} value={col}>{col}</option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3 pt-6 border-t border-slate-100">
                      <button 
                        onClick={() => setStep('header_selection')}
                        className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                        disabled={importing}
                      >
                        Atrás
                      </button>
                      <button 
                        onClick={handleImport}
                        disabled={importing || !period || salesFields.filter(f => f.required && !mapping[f.key]).length > 0}
                        className="flex-[2] px-4 py-2 flex flex-col items-center justify-center bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        <div className="flex items-center gap-2 text-sm font-bold">
                          {importing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {importProgress.stage === 'inserting' ? `Insertando...` : 
                               importProgress.stage === 'matching' ? 'Resolviendo Costos...' : 
                               'Procesando...'}
                            </>
                          ) : 'Confirmar e Iniciar Carga'}
                        </div>
                        {salesFields.filter(f => f.required && !mapping[f.key]).length > 0 && !importing && (
                          <div className="text-[10px] text-emerald-100/80 mt-0.5 font-medium flex items-center justify-center">
                            Faltan campos obligatorios (*)
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {step === 'success' && (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-slate-900">¡Sábana Importada!</h4>
                      <p className="text-slate-500 font-medium">Los datos ya están disponibles para su revisión.</p>
                    </div>
                    <button 
                      onClick={() => setIsImportModalOpen(false)}
                      className="px-8 py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-all"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
