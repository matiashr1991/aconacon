import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { MatchingService } from '../lib/services/matching-service';

function parseNumeric(str: any): { value: number, raw: any, isValid: boolean, isOutlier: boolean } {
  if (str === null || str === undefined || str === '') return { value: 0, raw: str, isValid: true, isOutlier: false };
  if (typeof str === 'number') {
    const isBad = !isFinite(str) || isNaN(str);
    return { value: isBad ? 0 : str, raw: str, isValid: !isBad, isOutlier: isBad };
  }
  
  let clean = String(str).replace(/[^\d.,-]/g, '');
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  
  const num = Number(clean);
  const isValid = !isNaN(num) && isFinite(num);
  return { value: isValid ? num : 0, raw: str, isValid, isOutlier: !isValid && String(str).trim().length > 0 };
}

async function analyze() {
  const filePath = 'D:\\aconn\\20260310142741-ReporteComprobantesDetallado.xls';
  console.log(`\n🔍 Analizando: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ Archivo no encontrado');
    return;
  }

  const startTime = Date.now();
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
  console.log(`📊 Filas detectadas: ${rows.length}`);
  
  if (rows.length < 2) {
    console.error('❌ Archivo vacío o sin encabezados');
    return;
  }

  const headers = rows[0] as string[];
  console.log(`📋 Encabezados: ${headers.join(' | ')}`);

  let errors = 0;
  const outliers: any[] = [];
  
  const numericCols = headers.filter(h => 
    /precio|subtotal|neto|bruto|bultos|cantidad|unidades|bonif/i.test(String(h)) &&
    !/fecha|vigencia/i.test(String(h))
  );
  
  console.log(`🔢 Monitoreando columnas numéricas: ${numericCols.join(', ')}`);

  const lastRows: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowObj: any = {};
    headers.forEach((h, idx) => { rowObj[h] = row[idx]; });
    
    if (i >= rows.length - 5) {
      lastRows.push({ rowIndex: i + 1, data: rowObj });
    }

    // 1. Validar Fecha
    const dateIdx = headers.findIndex(h => /fecha/i.test(String(h)));
    const dateVal = row[dateIdx];
    if (!dateVal || isNaN(new Date(dateVal).getTime())) {
      if (i > rows.length - 10) {
        console.log(`⚠️ Fila ${i + 1}: Posible fila de TOTAL/Metadata (Fecha inválida: "${dateVal}")`);
      }
    }

    // 2. Validar Numéricos
    numericCols.forEach(colName => {
      const colIdx = headers.indexOf(colName);
      const val = row[colIdx];
      const result = parseNumeric(val);
      
      if (result.isOutlier) {
        errors++;
        if (outliers.length < 20) {
          outliers.push({ row: i + 1, col: colName, val: val, reason: 'No es numérico finito' });
        }
      }
    });

    // 3. Validar Código de Artículo (Requerido)
    const artIdx = headers.findIndex(h => /codigo|art/i.test(String(h)));
    if (artIdx !== -1 && !row[artIdx] && i < rows.length - 5) {
       // Si no tiene código de artículo y no es del final, es sospechoso
       // console.warn(`⚠️ Fila ${i+1}: Artículo vacío`);
    }
  }

  console.log(`\n--- RESULTADOS ---`);
  console.log(`❌ Errores numéricos críticos encontrados: ${errors}`);
  
  if (outliers.length > 0) {
    console.log(`\n📍 EJEMPLOS DE ERRORES:`);
    console.log(JSON.stringify(outliers.slice(0, 10), null, 2));
  }

  if (lastRows.length > 0) {
    console.log(`\n📄 ÚLTIMAS FILAS:`);
    console.log(JSON.stringify(lastRows.slice(-2), null, 2));
  }

  console.log(`\n🏁 Análisis completado en ${(Date.now() - startTime)/1000}s`);
}

analyze().catch(console.error);
