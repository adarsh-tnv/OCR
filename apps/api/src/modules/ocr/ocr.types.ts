export interface OcrTableCell {
  text: string;
  rowIndex: number;
  columnIndex: number;
}

export interface OcrTable {
  page: number;
  headerRows: OcrTableCell[][];
  bodyRows: OcrTableCell[][];
}

export interface OcrFormField {
  page: number;
  name: string;
  value: string;
  confidence: number | null;
}

export interface OcrPageMetadata {
  pageNumber: number;
  width: number | null;
  height: number | null;
  detectedLanguages: string[];
  tokenCount: number;
}

export interface OcrResult {
  rawText: string;
  tables: OcrTable[];
  formFields: OcrFormField[];
  pageMetadata: OcrPageMetadata[];
  pageCount: number;
  language: string | null;
  confidence: number | null;
  visualSignals: {
    qrCodeDetected: boolean;
    sealDetected: boolean;
    logoDetected: boolean;
  };
}
