'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  Loader2,
  Calendar,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  Save,
  UserPlus,
  Layers,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { processSupplierImportAction, validateSupplierAction, getSuppliersAction, registerSupplierAction, massiveSupplierImportAction } from './actions';
import { parseExcel, parseStandardSupplierExcel } from '@/lib/import-engine';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Supplier = {
  id: string;
  name: string;
  code: string | null;
  tax_id: string | null;
  created_at: Date | null;
  active: boolean | null;
};

export default function ProveedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  
  // Registration State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', code: '', taxId: '' });

  // Import State
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'mapping' | 'confirm_standard' | 'success'>('upload');
  const [rawData, setRawData] = useState<any[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isStandardFormat, setIsStandardFormat] = useState(false);
  const [detectedProvider, setDetectedProvider] = useState<{code: string, name: string} | null>(null);

  // Massive Batch Import State
  const [isMassiveModalOpen, setIsMassiveModalOpen] = useState(false);
  const [massiveFiles, setMassiveFiles] = useState<File[]>([]);
  const [massiveProgress, setMassiveProgress] = useState<Record<string, {status: 'pending'|'reading'|'importing'|'success'|'error', text: string}>>({});
  const [isMassiveRunning, setIsMassiveRunning] = useState(false);
  const massiveInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supplierFields = [
    { key: 'article_code', label: 'Código Artículo (Interno)', required: true },
    { key: 'article_desc', label: 'Descripción', required: true },
    { key: 'barcode', label: 'EAN / Barcode', required: false },
    { key: 'gross_price', label: 'Precio Bruto', required: true },
    { key: 'discount_pct', label: 'Descuento (%)', required: false },
    { key: 'net_price_discounted', label: 'Precio Neto', required: false },
    { key: 'fixed_internal_taxes', label: 'Imp. Internos Fijos', required: false },
    { key: 'pct_internal_taxes', label: 'Imp. Internos %', required: false },
    { key: 'supplier_article_code', label: 'Código Proveedor', required: false },
  ];

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    setLoading(true);
    try {
      const data = await getSuppliersAction();
      // Map external_code to code for UI usage
      const mapped = data.map((s: any) => ({
        ...s,
        code: s.external_code
      }));
      setSuppliers(mapped);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleRegisterSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name || !newSupplier.code) return;
    setRegistering(true);
    try {
      const result = await registerSupplierAction(newSupplier.name, newSupplier.code, newSupplier.taxId);
      if (!result.success) throw new Error(result.error);
      
      setIsRegisterModalOpen(false);
      setNewSupplier({ name: '', code: '', taxId: '' });
      fetchSuppliers();
    } catch (err: any) {
      console.error('Error registering supplier:', err);
      alert('Error: ' + err.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFile(file);
    try {
      let data: any[];
      try {
        data = await parseStandardSupplierExcel(file);
        if (data.length > 0 && data[0]['Código Proveedor']) {
          const providerInfo = await validateSupplierAction(data);
          setDetectedProvider(providerInfo);
          setIsStandardFormat(true);
          setRawData(data);
          setStep('confirm_standard');
          return;
        }
      } catch (err) {
        console.log('Not standard format');
      }

      const parsed = await parseExcel(file) as any;
      data = parsed.data;
      setRawData(data);
      setDetectedColumns(Object.keys(data[0] || {}));
      setIsStandardFormat(false);
      setStep('mapping');
    } catch (err: any) {
      alert(err.message || 'Error al leer el archivo');
    }
  };

  const handleImport = async () => {
    if (!file || !selectedSupplier) return;

    setImporting(true);

    try {
      const result = await processSupplierImportAction(
        file.name,
        selectedSupplier.id,
        rawData,
        mapping,
        isStandardFormat
      );

      if (!result.success) {
        throw new Error(result.error);
      }
      
      setStep('success');
      fetchSuppliers();
    } catch (err: any) {
      console.error('Import error:', err);
      alert('Error durante la importación: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Massive Processing Logic
  const handleMassiveDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files).filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
    setMassiveFiles([...files]);
    
    const initialProg: any = {};
    files.forEach(f => {
      initialProg[f.name] = { status: 'pending', text: 'Esperando...' };
    });
    setMassiveProgress(initialProg);
  };

  const runMassiveImport = async () => {
    setIsMassiveRunning(true);

    for (const f of massiveFiles) {
      setMassiveProgress(p => ({ ...p, [f.name]: { status: 'reading', text: 'Leyendo Excel...' } }));
      try {
        // Step A: Parse Standard Format
        const rawData = await parseStandardSupplierExcel(f);
        if (!rawData || rawData.length === 0) throw new Error('Archivo estructurado vacío o dañado.');
        if (!rawData[0]['Código Proveedor']) throw new Error('No se detectó la columna "Código Proveedor" en la fila cabecera (formato inválido).');

        // Step B: Native backend bulk injection
        setMassiveProgress(p => ({ ...p, [f.name]: { status: 'importing', text: 'Upserting Provider & Processing...' } }));
        
        const result = await massiveSupplierImportAction(f.name, rawData);
        if (!result.success) throw new Error(result.error);
        
        setMassiveProgress(p => ({ ...p, [f.name]: { status: 'success', text: `OK - ${result.supplierName} (${result.supplierCode})` } }));
      } catch (err: any) {
        setMassiveProgress(p => ({ ...p, [f.name]: { status: 'error', text: err.message || 'Error Desconocido' } }));
      }
    }

    setIsMassiveRunning(false);
    fetchSuppliers(); // Refresh dashboard cards!
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6 md:p-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Listas de Precios</h1>
          <p className="text-slate-500 font-medium">Gestión corporativa de proveedores y costos actualizados.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsMassiveModalOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm transition-all"
          >
            <Layers className="w-4 h-4" />
            Importación Masiva (Lote)
          </button>
          <button 
            onClick={() => setIsRegisterModalOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Proveedores Activos', value: suppliers.length, icon: Building2, color: 'text-emerald-600' },
          { label: 'Total Artículos', value: '12,482', icon: FileText, color: 'text-slate-600' },
          { label: 'Listas Vigentes', value: suppliers.length, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Alertas de Costo', value: '2', icon: AlertCircle, color: 'text-amber-600' },
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

      {/* Search area */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar proveedor..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Supplier Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="group bg-white border border-slate-200 hover:border-emerald-500/50 rounded-2xl p-6 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between"
              onClick={() => {
                setSelectedSupplier(supplier);
                setIsImportModalOpen(true);
                setStep('upload');
              }}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                    Activo
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">CÓDIGO: {supplier.code}</p>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{supplier.name}</h3>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Actualizado: {new Date(supplier.created_at!).toLocaleDateString()}
                </div>
                <div className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm hover:bg-emerald-700 transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  IMPORTAR LISTA
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALS */}

      {/* 1. Register Supplier Modal */}
      <AnimatePresence>
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => !registering && setIsRegisterModalOpen(false)}
            />
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Nuevo Proveedor</h3>
                </div>
                <button onClick={() => setIsRegisterModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegisterSupplier} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nombre / Razón Social</label>
                  <input required type="text" value={newSupplier.name} 
                    onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    placeholder="Ej: Aconcagua SRL"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Código Único</label>
                  <input required type="text" value={newSupplier.code} 
                    onChange={e => setNewSupplier(p => ({ ...p, code: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    placeholder="Ej: PROV-001"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">CUIT / ID Fiscal (Opcional)</label>
                  <input type="text" value={newSupplier.taxId} 
                    onChange={e => setNewSupplier(p => ({ ...p, taxId: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    placeholder="Ej: 30-7145..."
                  />
                </div>
                <button type="submit" disabled={registering}
                  className="w-full mt-4 bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  {registering ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Guardar Proveedor
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Import Modal (Existing) */}
      <AnimatePresence>
        {isImportModalOpen && selectedSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => !importing && setIsImportModalOpen(false)}
            />
            <motion.div initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Importar Lista de Precios</h3>
                    <p className="text-xs text-slate-500 font-medium">{selectedSupplier.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8">
                {step === 'upload' && (
                  <div onClick={() => fileInputRef.current?.click()}
                    className="group border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all hover:bg-emerald-50/30"
                  >
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900">Haz clic para subir Excel</p>
                      <p className="text-slate-500 text-sm font-medium">Soporta formatos .xlsx y .xls</p>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleFileChange} />
                  </div>
                )}

                {step === 'confirm_standard' && (
                  <div className="space-y-6">
                    <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-start gap-4">
                      <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-emerald-900">Formato Estándar Reconocido</h4>
                        <p className="text-sm text-emerald-800/70 font-medium">
                          Detectado layout de <span className="font-bold">{detectedProvider?.name}</span>. Todo listo para procesar.
                        </p>
                      </div>
                    </div>



                    <div className="flex gap-3 pt-4">
                      <button onClick={() => setStep('upload')} className="flex-1 px-6 py-2.5 rounded-lg border border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all text-slate-600">
                        Cambiar Archivo
                      </button>
                      <button onClick={handleImport} disabled={importing}
                        className="flex-[2] px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Importación'}
                      </button>
                    </div>
                  </div>
                )}

                {step === 'mapping' && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="text-sm font-medium text-amber-900">Layout desconocido. Por favor, asigna las columnas manualmente.</p>
                    </div>
                    {/* ... (Existing mapping UI) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                      {supplierFields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                            {field.label} {field.required && <span className="text-rose-500">*</span>}
                          </label>
                          <select 
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            value={mapping[field.key] || ''}
                            onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                          >
                            <option value="">Ignorar columna</option>
                            {detectedColumns.map(col => (<option key={col} value={col}>{col}</option>))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 pt-6 border-t border-slate-100">
                      <button onClick={() => setStep('upload')} className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">Atrás</button>
                      <button onClick={handleImport} disabled={importing} className="flex-[2] px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Datos'}
                      </button>
                    </div>
                  </div>
                )}

                {step === 'success' && (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><CheckCircle2 className="w-12 h-12" /></div>
                    <div><h4 className="text-2xl font-bold text-slate-900">¡Carga Completada!</h4><p className="text-slate-500 font-medium">Se han importado {rawData.length} registros con éxito.</p></div>
                    <button onClick={() => setIsImportModalOpen(false)} className="px-8 py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-all">Cerrar</button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Massive Import Modal */}
      <AnimatePresence>
        {isMassiveModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => !isMassiveRunning && setIsMassiveModalOpen(false)}
            />
            <motion.div initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Procesar Lote Masivo</h3>
                    <p className="text-xs text-slate-500 font-medium">Extrae datos, crea proveedores e importa sábanas automáticamente.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMassiveModalOpen(false)} 
                  disabled={isMassiveRunning}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                {massiveFiles.length === 0 ? (
                  <div onClick={() => massiveInputRef.current?.click()}
                    className="group border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-xl p-16 flex flex-col items-center gap-4 cursor-pointer transition-all hover:bg-indigo-50/30"
                  >
                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                      <Layers className="w-10 h-10" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-slate-900">Selecciona o arrastra los Excels</p>
                      <p className="text-slate-500 text-sm font-medium mt-1">Sube todos los Excels de tus proveedores a la vez.</p>
                    </div>
                    <input type="file" ref={massiveInputRef} className="hidden" accept=".xlsx,.xls" multiple onChange={handleMassiveDrop} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                        {massiveFiles.length} Archivos en cola
                      </div>
                      {!isMassiveRunning && (
                        <button onClick={() => setMassiveFiles([])} className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors">
                          Vaciar Lista
                        </button>
                      )}
                    </div>
                    
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      {massiveFiles.map((f, i) => {
                        const state = massiveProgress[f.name] || { status: 'pending', text: 'Esperando...' };
                        const isSuccess = state.status === 'success';
                        const isError = state.status === 'error';
                        const isWorking = state.status === 'reading' || state.status === 'importing';
                        
                        return (
                          <div key={i} className={cn(
                            "px-4 py-3 flex items-center justify-between text-sm transition-colors",
                            isSuccess ? "bg-emerald-50/50" : isError ? "bg-rose-50/50" : isWorking ? "bg-indigo-50/50" : "bg-white"
                          )}>
                            <div className="flex items-center gap-3 truncate pr-4">
                              {isSuccess ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> :
                               isError ? <XCircle className="w-4 h-4 text-rose-500 shrink-0" /> :
                               isWorking ? <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" /> :
                               <FileText className="w-4 h-4 text-slate-300 shrink-0" />
                              }
                              <span className="font-medium text-slate-700 truncate">{f.name}</span>
                            </div>
                            <span className={cn(
                              "text-xs font-bold shrink-0",
                              isSuccess ? "text-emerald-700" : isError ? "text-rose-600" : isWorking ? "text-indigo-600" : "text-slate-400"
                            )}>
                              {state.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {massiveFiles.length > 0 && (
                <div className="px-8 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                  <button 
                    onClick={runMassiveImport} 
                    disabled={isMassiveRunning}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {isMassiveRunning ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                    {isMassiveRunning ? 'Procesando en Servidor...' : 'Destruir e Importar Todo'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
