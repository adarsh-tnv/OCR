import JSZip from "jszip";
import type { OcrResult, OcrTable, OcrTableCell } from "./ocr.types.js";

const decodeXml = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");

const normalizeWhitespace = (value: string) => value.replace(/[ \t\r\f\v]+/g, " ").trim();

const textFromXmlFragment = (xml: string) => {
  const normalized = xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n");

  return [...normalized.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1] ?? ""))
    .join("");
};

const paragraphsFromXml = (xml: string) =>
  [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .map((match) => normalizeWhitespace(textFromXmlFragment(match[0])))
    .filter(Boolean);

const rowsFromCells = (rows: string[][], startRowIndex = 0): OcrTableCell[][] =>
  rows.map((row, rowIndex) =>
    row.map((text, columnIndex) => ({
      text,
      rowIndex: rowIndex + startRowIndex,
      columnIndex
    }))
  );

const tablesFromDocumentXml = (xml: string): OcrTable[] =>
  [...xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)]
    .map((tableMatch) => {
      const rows = [...tableMatch[0].matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)]
        .map((rowMatch) =>
          [...rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)]
            .map((cellMatch) => normalizeWhitespace(paragraphsFromXml(cellMatch[0]).join(" ")))
            .filter(Boolean)
        )
        .filter((row) => row.length > 0);

      if (!rows.length) return null;

      const [headerRow, ...bodyRows] = rows;
      return {
        page: 1,
        headerRows: headerRow ? rowsFromCells([headerRow]) : [],
        bodyRows: rowsFromCells(bodyRows, headerRow ? 1 : 0)
      };
    })
    .filter((table): table is OcrTable => Boolean(table));

const wordCount = (value: string) => value.split(/\s+/).filter(Boolean).length;

export class DocxDocumentClient {
  async processDocument(buffer: Buffer): Promise<OcrResult> {
    const zip = await JSZip.loadAsync(buffer);
    const documentFile = zip.file("word/document.xml");

    if (!documentFile) {
      throw new Error("DOCX file does not contain word/document.xml");
    }

    const documentXml = await documentFile.async("string");
    const relatedXmlFiles = Object.values(zip.files)
      .filter(
        (file) =>
          !file.dir &&
          /^word\/(?:header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(file.name)
      )
      .sort((left, right) => left.name.localeCompare(right.name));

    const relatedTextSections = await Promise.all(
      relatedXmlFiles.map(async (file) => paragraphsFromXml(await file.async("string")).join("\n"))
    );

    const rawText = [paragraphsFromXml(documentXml).join("\n"), ...relatedTextSections]
      .map((section) => section.trim())
      .filter(Boolean)
      .join("\n\n");

    if (!rawText.trim()) {
      throw new Error("DOCX text extraction did not find any readable text");
    }

    return {
      rawText,
      tables: tablesFromDocumentXml(documentXml),
      formFields: [],
      pageMetadata: [
        {
          pageNumber: 1,
          width: null,
          height: null,
          detectedLanguages: [],
          tokenCount: wordCount(rawText)
        }
      ],
      pageCount: 1,
      language: null,
      confidence: 0.99,
      visualSignals: {
        qrCodeDetected: false,
        sealDetected: false,
        logoDetected: false
      }
    };
  }
}

export const docxDocumentClient = new DocxDocumentClient();
