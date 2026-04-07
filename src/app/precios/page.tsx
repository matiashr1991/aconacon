'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  getSuppliersAction, 
  getSupplierProductsAction, 
  bulkUpdatePriceListAction 
} from './actions';
import { 
  Search, Save, Download, Loader2, Package, Tag, Percent, 
  DollarSign, CheckCircle2, AlertCircle, Trash2, ArrowLeft,
  ChevronRight, Filter, Database, Edit3, Truck, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as ExcelJS from 'exceljs';

export default function PreciosPage() {
  const [suppliers, setSuppliers] = useState<{name: string | null, code: string | null}[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track changes to enable/disable Save button
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    getSuppliersAction().then(res => {
      if (res.success && res.data) {
        setSuppliers(res.data.filter(s => s.name));
      }
    });
  }, []);

  const loadProducts = async (name: string) => {
    if (!name) return;
    setLoading(true);
    const res = await getSupplierProductsAction(name);
    if (res.success && res.data) {
      setItems(res.data);
      setHasChanges(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedSupplier) {
      loadProducts(selectedSupplier);
    }
  }, [selectedSupplier]);

  // Handle local cell edit
  const handleEdit = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // Recalculate Net Price Discounted
        const gross = Number(updated.gross_price) || 0;
        const disc = Number(updated.discount_pct) || 0;
        const netDisc = gross * (1 - (disc / 100));
        updated.net_price_discounted = netDisc.toFixed(4);

        // Recalculate Net Price Plus Taxes
        const fixedTax = Number(updated.fixed_internal_taxes) || 0;
        const pctTax = Number(updated.pct_internal_taxes) || 0;
        const finalNet = netDisc + fixedTax + (netDisc * (pctTax / 100));
        updated.net_price_plus_internal_taxes = finalNet.toFixed(4);
        
        return updated;
      }
      return item;
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedSupplier) return;
    setIsSaving(true);
    
    const updates = items.map(item => ({
      id: item.id,
      data: {
        gross_price: item.gross_price,
        discount_pct: item.discount_pct,
        net_price_discounted: item.net_price_discounted,
        fixed_internal_taxes: item.fixed_internal_taxes,
        pct_internal_taxes: item.pct_internal_taxes,
        net_price_plus_internal_taxes: item.net_price_plus_internal_taxes,
        margin_hint: item.margin_hint,
        canceled_flag: item.canceled_flag
      }
    }));

    const res = await bulkUpdatePriceListAction(updates);
    if (res.success) {
      alert("Cambios guardados con éxito.");
      setHasChanges(false);
    } else {
      alert("Error al guardar: " + res.error);
    }
    setIsSaving(false);
  };

  const handleExport = async () => {
    if (items.length === 0) return;

    const supplierCode = suppliers.find(s => s.name === selectedSupplier)?.code || '';
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Precios');

    // Define columns
    worksheet.columns = [
      { header: 'Código Proveedor', key: 'supplier_code', width: 20 },
      { header: 'Razón Social', key: 'supplier_name', width: 35 },
      { header: 'Articulo', key: 'article_code', width: 15 },
      { header: 'Descripción Articulo', key: 'article_desc', width: 45 },
      { header: 'Código de barras', key: 'barcode', width: 25 },
      { header: 'Precio Unitario', key: 'gross_price', width: 15 },
      { header: 'Bonifc.', key: 'discount_pct', width: 12 },
      { header: 'Precio Neto Bonificado', key: 'net_price_disc', width: 20 },
      { header: 'Internos Fijos', key: 'int_fixed', width: 15 },
      { header: 'Internos %', key: 'int_pct', width: 12 },
      { header: 'Precio Neto + I. Interno', key: 'net_price_final', width: 20 },
      { header: 'Cod. Art. Proveedor', key: 'supp_art_code', width: 18 },
      { header: 'Art. Proveedor Secu', key: 'supp_art_code_sec', width: 18 },
      { header: 'Margen', key: 'margin', width: 12 },
      { header: 'Anulado', key: 'canceled', width: 12 }
    ];

    // --- ROW 1: CAMPOS OBLIGATORIOS Y FIJOS ---
    worksheet.spliceRows(1, 0, []); // Add empty first row
    const row1 = worksheet.getRow(1);
    row1.getCell(1).value = 'CAMPOS OBLIGATORIOS Y FIJOS';
    worksheet.mergeCells('A1:O1');
    row1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
    row1.getCell(1).font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 14 };
    row1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    row1.height = 30;

    // --- ROW 2: COLUMN NAMES ---
    const row2 = worksheet.getRow(2);
    const colColors: any = {
      1: 'FFFF0000', // Red
      2: 'FF00B050', // Green
      3: 'FFFF0000', // Red
      4: 'FF00B050', // Green
      5: 'FF00B050', // Green
      6: 'FFFF0000', // Red
      7: 'FF0070C0', // Blue
      8: 'FF00B050', // Green
      9: 'FF0070C0', // Blue
      10: 'FF0070C0', // Blue
      11: 'FF00B050', // Green
      12: 'FF0070C0', // Blue
      13: 'FF0070C0', // Blue
      14: 'FF0070C0', // Blue
      15: 'FF00B050'  // Green
    };

    for (let i = 1; i <= 15; i++) {
        const cell = row2.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        cell.font = { color: { argb: colColors[i] }, bold: true, size: 10 };
        cell.border = { 
            top: { style: 'thin' }, left: { style: 'thin' }, 
            bottom: { style: 'thin' }, right: { style: 'thin' } 
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    row2.height = 25;

    // --- ROW 3: DATA TYPES ---
    const types = ['ENTERO', 'CARÁCTER', 'CARÁCTER', 'ENTERO', 'CARÁCTER', 'DECIMAL', 'DECIMAL', 'DECIMAL', 'DECIMAL', 'DECIMAL', 'DECIMAL', 'CARÁCTER', 'CARÁCTER', 'DECIMAL', 'LÓGICO'];
    const row3 = worksheet.getRow(3);
    types.forEach((type, i) => {
        const cell = row3.getCell(i + 1);
        cell.value = type;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, size: 9, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { 
            top: { style: 'thin' }, left: { style: 'thin' }, 
            bottom: { style: 'thin' }, right: { style: 'thin' } 
        };
    });
    row3.height = 20;

    // --- DATA ROWS ---
    items.forEach(item => {
        const rowData = [
            supplierCode,
            selectedSupplier,
            item.article_code,
            item.article_desc,
            item.barcode || '',
            Number(item.gross_price) || 0,
            Number(item.discount_pct) || 0,
            Number(item.net_price_discounted) || 0,
            Number(item.fixed_internal_taxes) || 0,
            Number(item.pct_internal_taxes) || 0,
            Number(item.net_price_plus_internal_taxes) || 0,
            item.supplier_article_code || '',
            item.supplier_article_code_secondary || '',
            Number(item.margin_hint) || 0,
            item.canceled_flag ? 'SI' : 'NO'
        ];
        const row = worksheet.addRow(rowData);
        row.eachCell((cell) => {
            cell.border = { 
                top: { style: 'thin' }, left: { style: 'thin' }, 
                bottom: { style: 'thin' }, right: { style: 'thin' } 
            };
            cell.alignment = { vertical: 'middle' };
        });
    });

    // Write to buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `${date}_PRECIOS_${selectedSupplier.replace(/\s+/g, '_')}.xlsx`;
    
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i => 
      i.article_desc?.toLowerCase().includes(q) || 
      i.article_code?.toLowerCase().includes(q) ||
      i.barcode?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-widest mb-1">
              <Database className="w-3 h-3" /> Catálogo Maestro
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Gestión de Precios</h1>
            <p className="text-slate-500 font-medium">Actualiza costos y bonificaciones por proveedor para el cálculo de rentabilidad.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleExport}
              disabled={items.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Exportar Excel
            </button>
            <button 
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md ${hasChanges ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </button>
          </div>
        </div>

        {/* Filters Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Truck className="w-3 h-3" /> Seleccionar Proveedor
              </label>
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-all appearance-none cursor-pointer"
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
              >
                <option value="">-- Elige un proveedor --</option>
                {suppliers.map(s => (
                  <option key={s.name} value={s.name || ''}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Search className="w-3 h-3" /> Buscar Artículo
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Nombre, código o EAN..." 
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!selectedSupplier}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
              <p className="font-bold">Cargando lista de precios...</p>
            </div>
          ) : !selectedSupplier ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 opacity-60">
              <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">
                <Filter className="w-10 h-10 text-slate-200" />
              </div>
              <p className="font-bold text-lg">Selecciona un proveedor para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 uppercase text-[10px] font-black text-slate-400 tracking-widest">
                    <th className="px-6 py-4">Artículo</th>
                    <th className="px-4 py-4 text-center">P. Lista (Bruto)</th>
                    <th className="px-4 py-4 text-center">Bono %</th>
                    <th className="px-4 py-4 text-center bg-indigo-50/30 text-indigo-600">P. Neto</th>
                    <th className="px-4 py-4 text-center border-l border-slate-100">Int. Fijos</th>
                    <th className="px-4 py-4 text-center">Int. %</th>
                    <th className="px-4 py-4 text-center bg-emerald-50/30 text-emerald-700">Neto Final</th>
                    <th className="px-4 py-4 text-center">Anulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map(item => (
                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${item.canceled_flag ? 'opacity-50 grayscale' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-800 leading-tight line-clamp-1 max-w-[300px]">{item.article_desc}</span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-tighter mt-1">
                            ERP: {item.article_code} | EAN: {item.barcode || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2">
                          <span className="text-slate-400">$</span>
                          <input 
                            type="number" 
                            className="w-24 bg-transparent py-1.5 focus:outline-none text-center font-bold text-slate-700"
                            value={item.gross_price || 0}
                            onChange={(e) => handleEdit(item.id, 'gross_price', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2">
                          <input 
                            type="number" 
                            className="w-16 bg-transparent py-1.5 focus:outline-none text-center font-bold text-slate-700"
                            value={item.discount_pct || 0}
                            onChange={(e) => handleEdit(item.id, 'discount_pct', e.target.value)}
                          />
                          <span className="text-slate-400 font-bold">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-black text-indigo-600 bg-indigo-50/10">
                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(item.net_price_discounted)}
                      </td>
                      <td className="px-4 py-4 border-l border-slate-100">
                        <input 
                          type="number" 
                          className="w-16 mx-auto block bg-slate-50 border border-slate-100 rounded-lg py-1.5 focus:outline-none text-center font-medium text-slate-500 text-xs"
                          value={item.fixed_internal_taxes || 0}
                          onChange={(e) => handleEdit(item.id, 'fixed_internal_taxes', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <input 
                          type="number" 
                          className="w-16 mx-auto block bg-slate-50 border border-slate-100 rounded-lg py-1.5 focus:outline-none text-center font-medium text-slate-500 text-xs"
                          value={item.pct_internal_taxes || 0}
                          onChange={(e) => handleEdit(item.id, 'pct_internal_taxes', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-4 text-center font-black text-emerald-700 bg-emerald-50/10">
                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(item.net_price_plus_internal_taxes)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={!!item.canceled_flag}
                          onChange={(e) => handleEdit(item.id, 'canceled_flag', e.target.checked)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Helper Footer */}
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <Info className="w-3 h-3" />
          Los cambios realizados aquí afectan directamente el motor de cálculo de rentabilidad al ejecutar un nuevo cruce.
        </div>
      </div>
    </div>
  );
}
