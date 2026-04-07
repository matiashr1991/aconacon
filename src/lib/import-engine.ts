import * as XLSX from 'xlsx';

export interface ImportMapping {
  column: string;
  targetField: string;
}

export interface ParseOptions {
  sheetName?: string;
  headerRow?: number;
  mapping?: ImportMapping[];
}

export async function parseExcel(file: File | Buffer, options: ParseOptions = {}) {
  const { headerRow = 1, sheetName } = options;
  
  let data: any;
  if (file instanceof File) {
    data = await file.arrayBuffer();
  } else {
    data = file;
  }

  const workbook = XLSX.read(data, { type: 'buffer', cellDates: true, dateNF: 'dd/mm/yyyy' });
  const sheetNames = workbook.SheetNames;
  const targetSheet = sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[targetSheet];

  if (!worksheet) {
    throw new Error(`La hoja "${targetSheet}" no existe en el archivo.`);
  }

  // Get raw rows to let user choose header
  const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { 
    header: 1, 
    defval: '',
    raw: false, // Formatting enabled for human-readable dates in preview
    dateNF: 'dd/mm/yyyy'
  });
  
  // If we have a specific header row, re-parse with keys
  let parsedData = [];
  if (headerRow > 0 && rawRows.length >= headerRow) {
    const headers = rawRows[headerRow - 1] as string[];
    const rows = rawRows.slice(headerRow);
    parsedData = rows.map(row => {
      const obj: any = {};
      headers.forEach((h, i) => {
        if (h) {
          let value = row[i];
          // If it's a Date object (thanks to cellDates: true), format it
          // If it's a Date object (thanks to cellDates: true), format it for SQL
          if (value instanceof Date) {
            value = value.toISOString().split('T')[0]; // YYYY-MM-DD
          }
          obj[String(h).trim()] = value;
        }
      });
      return obj;
    });
  }

  return {
    sheets: sheetNames,
    rawRows: rawRows.slice(0, 20), // Send first 20 rows for preview
    data: parsedData,
    selectedSheet: targetSheet
  };
}

/**
 * Get sheet names from a workbook before parsing
 */
export async function getWorkbookMetadata(file: File | Buffer) {
  let data: any;
  if (file instanceof File) {
    data = await file.arrayBuffer();
  } else {
    data = file;
  }
  const workbook = XLSX.read(data, { type: 'buffer' });
  return {
    sheets: workbook.SheetNames
  };
}

/**
 * Standard Aconcagua Supplier Parser
 * Expects:
 * Row 1: Info (Skip)
 * Row 2: Headers
 * Row 3: Types (Skip)
 * Row 4+: Data
 */
export async function parseStandardSupplierExcel(file: File | Buffer) {
  let data: any;
  if (file instanceof File) {
    data = await file.arrayBuffer();
  } else {
    data = file;
  }

  const workbook = XLSX.read(data, { type: 'buffer' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  // We read the whole sheet as a 2D array first to handle the complex header structure
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });

  if (rows.length < 4) {
    throw new Error('El archivo no tiene el formato estándar (mínimo 4 filas requeridas).');
  }

  const headers = rows[1]; // Row 2 (0-indexed is 1)
  const dataRows = rows.slice(3); // From Row 4 onwards (0-indexed is 3)

  return dataRows.map((row) => {
    const obj: any = {};
    headers.forEach((header: string, index: number) => {
      if (header) {
        let value = row[index];
        // Clean up numeric strings with commas
        if (typeof value === 'string' && /^-?\d+,\d+$/.test(value)) {
          value = parseFloat(value.replace(',', '.'));
        }
        obj[header] = value;
      }
    });
    return obj;
  });
}

export function mapFields(data: any[], mapping: ImportMapping[]) {
  return data.map((row) => {
    const mappedRow: any = {};
    mapping.forEach((m) => {
      mappedRow[m.targetField] = row[m.column];
    });
    return mappedRow;
  });
}
