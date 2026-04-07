'use client';

import React, { useState, useEffect } from 'react';
import { getProductsCatalogAction, getSuppliersFilterAction, updateProductAction } from './actions';
import { Package, Search, Filter, Pencil, Loader2, DollarSign, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductosPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierId, setSupplierId] = useState('ALL');
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [metadata, setMetadata] = useState({ total: 0, totalPages: 1, limit: 50, page: 1 });

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null); // holds the full row data
  const [editForm, setEditForm] = useState({
    name: '',
    barcode: '',
    listPrice: 0,
    discountPercent: 0,
    internalTaxes: 0
  });

  // Load Filters
  useEffect(() => {
    getSuppliersFilterAction().then(res => {
      if (res.success) setSuppliersList(res.data || []);
    });
  }, []);

  // Fetch Data Routine
  const fetchLocalCatalog = async (p = 1) => {
    setLoading(true);
    const result = await getProductsCatalogAction(searchQuery, supplierId, p, 50);
    if (result.success) {
      setData(result.data || []);
      setMetadata(result.metadata || { total: 0, totalPages: 1, limit: 50, page: 1 });
      setPage(p);
    } else {
      console.error(result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Debounce slightly to prevent spamming while typing
    const id = setTimeout(() => {
      fetchLocalCatalog(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchQuery, supplierId]);

  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setEditForm({
      name: item.productName || '',
      barcode: item.barcode || '',
      listPrice: Number(item.listPrice) || 0,
      discountPercent: Number(item.discountPercent) || 0,
      internalTaxes: Number(item.internalTaxes) || 0
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setSavingSettings(true);
    
    // Server action logic
    const res = await updateProductAction(editingItem.productId, editingItem.priceItemId, editForm);
    setSavingSettings(false);
    
    if (res.success) {
      setIsEditModalOpen(false);
      fetchLocalCatalog(page); // refresh current page smoothly
    } else {
      alert("Error al guardar: " + res.error);
    }
  };

  // Formatters
  const formatCurrency = (val: string | number) => {
    const num = Number(val);
    return isNaN(num) ? '$0.00' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Package className="w-8 h-8 text-emerald-600" />
            Catálogo Maestro
          </h1>
          <p className="text-slate-500 font-medium">Búsqueda rápida y edición global de productos.</p>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-4 gap-6 items-center">
          <div className="text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Artículos Activos</p>
            <p className="text-2xl font-black text-slate-800">{metadata.total.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por código, nombre o barras..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <select 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium appearance-none"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="ALL">Todos los Proveedores</option>
            {suppliersList.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 uppercase text-xs font-bold text-slate-400 tracking-wider">
                <th className="px-6 py-4">Proveedor</th>
                <th className="px-6 py-4">Código / Barras</th>
                <th className="px-6 py-4">Descripción</th>
                <th className="px-6 py-4 text-right">Bruto/Bonif.</th>
                <th className="px-6 py-4 text-right">Costo Final</th>
                <th className="px-6 py-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Buscando en Base de Datos...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center font-medium text-slate-400">
                    Cero resultados. Ajustá los filtros de búsqueda.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={`${item.productId}-${item.priceItemId}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{item.supplierName}</span>
                        <span className="text-xs font-medium text-slate-500 uppercase">PROV: {item.supplierCode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="font-mono font-medium text-slate-700 bg-slate-100 px-1 py-0.5 rounded w-max">{item.productCode}</span>
                        <span className="text-xs text-slate-400 mt-1">{item.barcode || 'Sin EAN'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="font-medium text-slate-800 break-words whitespace-normal line-clamp-2 max-w-sm">
                        {item.productName}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-slate-700">{formatCurrency(item.listPrice)}</span>
                        {Number(item.discountPercent) > 0 && (
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full mt-1">
                            -{Number(item.discountPercent).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex font-black text-lg text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl">
                        {formatCurrency(item.finalNetPrice)}
                      </span>
                      {Number(item.internalTaxes) > 0 && <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">+Imp Int.</p>}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button 
                        onClick={() => handleEditClick(item)}
                        className="p-2 hover:bg-slate-200 text-slate-400 hover:text-emerald-700 rounded-lg transition-colors inline-block"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-sm font-medium text-slate-500">
            Mostrando pág {metadata.page} de {metadata.totalPages || 1}
          </span>
          <div className="flex gap-2">
            <button 
              disabled={page === 1} onClick={() => fetchLocalCatalog(page - 1)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Anterior
            </button>
            <button 
              disabled={page >= metadata.totalPages} onClick={() => fetchLocalCatalog(page + 1)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal Context */}
      <AnimatePresence>
        {isEditModalOpen && editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsEditModalOpen(false)}
            />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900">Editar Detalle de Producto</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre / Descripción</label>
                  <input type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800"
                    value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Código de Barras</label>
                  <input type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800"
                    placeholder="EAN 13"
                    value={editForm.barcode} onChange={e => setEditForm({...editForm, barcode: e.target.value})} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Precio Bruto ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="number" step="0.01" className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800"
                        value={editForm.listPrice} onChange={e => setEditForm({...editForm, listPrice: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bonificación (%)</label>
                    <input type="number" step="0.01" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800"
                      value={editForm.discountPercent} onChange={e => setEditForm({...editForm, discountPercent: parseFloat(e.target.value) || 0})} 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Imp. Internos Fijos ($)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="number" step="0.01" className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800"
                      value={editForm.internalTaxes} onChange={e => setEditForm({...editForm, internalTaxes: parseFloat(e.target.value) || 0})} 
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <p className="text-xs text-slate-400 font-medium">* Editar esto modificará el Costo Final Neto usado como base por todo el sistema y actualizará la fecha de vigencia.</p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-500 font-semibold hover:bg-slate-200 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button 
                  disabled={savingSettings} onClick={handleSaveEdit}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar y Recalcular'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
