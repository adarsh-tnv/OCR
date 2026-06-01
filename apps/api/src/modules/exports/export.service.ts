import JSZip from "jszip";
import PDFDocument from "pdfkit";
import { certificateService } from "../certificates/certificate.service.js";

const certificateRows = (certificate: Awaited<ReturnType<typeof certificateService.getById>>) => [
  ["Certificate number", certificate.certificateNumber ?? ""],
  ["Standard", certificate.certificateStandard ?? ""],
  ["Organization", certificate.organizationName ?? ""],
  ["Organization address", certificate.organizationAddress ?? ""],
  ["Scope", certificate.scopeOfCertification ?? ""],
  ["Certification body", certificate.certificationBody ?? ""],
  ["Accreditation body", certificate.accreditationBody ?? ""],
  ["Issue date", certificate.issueDate?.toISOString().slice(0, 10) ?? ""],
  ["Expiry date", certificate.expiryDate?.toISOString().slice(0, 10) ?? ""],
  ["Status", certificate.certificateStatus],
  ["Confidence score", String(certificate.confidenceScore)]
];

const escapeSpreadsheetFormula = (value: unknown) => {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};

const csvCell = (value: unknown) => `"${escapeSpreadsheetFormula(value).replaceAll('"', '""')}"`;

const escapeXml = (value: unknown) =>
  escapeSpreadsheetFormula(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const columnName = (index: number) => {
  let value = index;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
};

const worksheetXml = (rows: Array<Array<unknown>>) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="32" customWidth="1"/>
    <col min="2" max="2" width="80" customWidth="1"/>
  </cols>
  <sheetData>
    ${rows
      .map(
        (row, rowIndex) => `<row r="${rowIndex + 1}">
      ${row
        .map(
          (cell, cellIndex) =>
            `<c r="${columnName(cellIndex + 1)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(
              cell
            )}</t></is></c>`
        )
        .join("")}
    </row>`
      )
      .join("")}
  </sheetData>
</worksheet>`;

export class ExportService {
  async exportJson(certificateId: string) {
    return certificateService.getById(certificateId);
  }

  async exportCsv(certificateId: string) {
    const certificate = await certificateService.getById(certificateId);
    return certificateRows(certificate)
      .map(([key, value]) => `${csvCell(key)},${csvCell(value)}`)
      .join("\n");
  }

  async exportExcel(certificateId: string) {
    const certificate = await certificateService.getById(certificateId);
    const rows = [["Field", "Value"], ...certificateRows(certificate)];
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
    );
    zip.folder("_rels")?.file(
      ".rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    );
    zip.folder("xl")?.file(
      "workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Certificate" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    );
    zip.folder("xl")?.folder("_rels")?.file(
      "workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
    );
    zip.folder("xl")?.folder("worksheets")?.file("sheet1.xml", worksheetXml(rows));
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }

  async exportPdf(certificateId: string) {
    const certificate = await certificateService.getById(certificateId);
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.fontSize(16).text("ISO Certificate Extraction", { underline: true });
      doc.moveDown();
      certificateRows(certificate).forEach(([field, value]) => {
        doc.fontSize(10).font("Helvetica-Bold").text(`${field}:`, { continued: true });
        doc.font("Helvetica").text(` ${value}`);
      });
      doc.end();
    });
  }
}

export const exportService = new ExportService();
