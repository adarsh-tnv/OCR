import {
  BlockType,
  FeatureType,
  GetDocumentAnalysisCommand,
  JobStatus,
  StartDocumentAnalysisCommand,
  TextractClient,
  type Block
} from "@aws-sdk/client-textract";
import { env } from "../../config/env.js";
import type { OcrFormField, OcrPageMetadata, OcrResult, OcrTable, OcrTableCell } from "./ocr.types.js";

const textract = new TextractClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY
  }
});

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const getChildIds = (block: Block, type = "CHILD") =>
  block.Relationships?.filter((relationship) => relationship.Type === type).flatMap(
    (relationship) => relationship.Ids ?? []
  ) ?? [];

const textFromBlock = (block: Block | undefined, blockById: Map<string, Block>) => {
  if (!block) return "";

  const text = getChildIds(block)
    .map((id) => {
      const child = blockById.get(id);
      if (!child) return "";
      if (child.BlockType === BlockType.SELECTION_ELEMENT) {
        return child.SelectionStatus === "SELECTED" ? "[selected]" : "";
      }
      return child.Text ?? "";
    })
    .filter(Boolean)
    .join(" ")
    .trim();

  return text || block.Text || "";
};

const getFormFields = (blocks: Block[], blockById: Map<string, Block>): OcrFormField[] =>
  blocks
    .filter((block) => block.BlockType === BlockType.KEY_VALUE_SET && block.EntityTypes?.includes("KEY"))
    .map((keyBlock) => {
      const valueId = keyBlock.Relationships?.find((relationship) => relationship.Type === "VALUE")?.Ids?.[0];
      const valueBlock = valueId ? blockById.get(valueId) : undefined;

      const confidence = average(
        [keyBlock.Confidence, valueBlock?.Confidence].filter((value): value is number => typeof value === "number")
      );

      return {
        page: keyBlock.Page ?? 1,
        name: textFromBlock(keyBlock, blockById),
        value: textFromBlock(valueBlock, blockById),
        confidence: confidence === null ? null : confidence / 100
      };
    })
    .filter((field) => field.name || field.value);

const cellToOcrCell = (cell: Block, blockById: Map<string, Block>): OcrTableCell => ({
  text: textFromBlock(cell, blockById),
  rowIndex: Math.max(0, (cell.RowIndex ?? 1) - 1),
  columnIndex: Math.max(0, (cell.ColumnIndex ?? 1) - 1)
});

const rowsFromCells = (cells: OcrTableCell[]) => {
  const rows = new Map<number, OcrTableCell[]>();
  cells.forEach((cell) => {
    const row = rows.get(cell.rowIndex) ?? [];
    row.push(cell);
    rows.set(cell.rowIndex, row);
  });

  return [...rows.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, row]) => row.sort((left, right) => left.columnIndex - right.columnIndex));
};

const getTables = (blocks: Block[], blockById: Map<string, Block>): OcrTable[] =>
  blocks
    .filter((block) => block.BlockType === BlockType.TABLE)
    .map((table) => {
      const cells = getChildIds(table)
        .map((id) => blockById.get(id))
        .filter((block): block is Block => block?.BlockType === BlockType.CELL);

      const headerCells = cells
        .filter((cell) => cell.EntityTypes?.includes("COLUMN_HEADER"))
        .map((cell) => cellToOcrCell(cell, blockById));
      const headerIds = new Set(headerCells.map((cell) => `${cell.rowIndex}:${cell.columnIndex}`));
      const bodyCells = cells
        .map((cell) => cellToOcrCell(cell, blockById))
        .filter((cell) => !headerIds.has(`${cell.rowIndex}:${cell.columnIndex}`));

      return {
        page: table.Page ?? 1,
        headerRows: rowsFromCells(headerCells),
        bodyRows: rowsFromCells(bodyCells)
      };
    });

const getPageMetadata = (blocks: Block[], pageCount: number): OcrPageMetadata[] =>
  Array.from({ length: Math.max(1, pageCount) }, (_, index) => {
    const pageNumber = index + 1;
    return {
      pageNumber,
      width: null,
      height: null,
      detectedLanguages: [],
      tokenCount: blocks.filter((block) => block.BlockType === BlockType.WORD && (block.Page ?? 1) === pageNumber)
        .length
    };
  });

const getFeatureTypes = () => {
  const configured = env.TEXTRACT_FEATURE_TYPES.split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  const allowed = new Set(Object.values(FeatureType));
  const featureTypes = configured.filter((item): item is FeatureType => allowed.has(item as FeatureType));
  return featureTypes.length ? featureTypes : [FeatureType.FORMS, FeatureType.TABLES, FeatureType.SIGNATURES];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class TextractDocumentClient {
  async processDocument(input: { bucket: string; key: string }): Promise<OcrResult> {
    const job = await textract.send(
      new StartDocumentAnalysisCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: input.bucket,
            Name: input.key
          }
        },
        FeatureTypes: getFeatureTypes()
      })
    );

    if (!job.JobId) {
      throw new Error("Textract did not return a job ID");
    }

    let result = await this.waitForResult(job.JobId);
    const blocks = result.Blocks ?? [];
    while (result.NextToken) {
      result = await textract.send(
        new GetDocumentAnalysisCommand({
          JobId: job.JobId,
          NextToken: result.NextToken
        })
      );
      blocks.push(...(result.Blocks ?? []));
    }

    const blockById = new Map(blocks.flatMap((block) => (block.Id ? [[block.Id, block] as const] : [])));
    const lines = blocks.filter((block) => block.BlockType === BlockType.LINE);
    const words = blocks.filter((block) => block.BlockType === BlockType.WORD);
    const pageCount =
      result.DocumentMetadata?.Pages ??
      Math.max(1, ...blocks.map((block) => block.Page ?? 1).filter((page) => Number.isFinite(page)));

    const wordConfidence = average(
      words.map((word) => word.Confidence).filter((value): value is number => typeof value === "number")
    );

    return {
      rawText: lines.map((line) => line.Text).filter(Boolean).join("\n"),
      tables: getTables(blocks, blockById),
      formFields: getFormFields(blocks, blockById),
      pageMetadata: getPageMetadata(blocks, pageCount),
      pageCount,
      language: null,
      confidence: wordConfidence === null ? null : wordConfidence / 100,
      visualSignals: {
        qrCodeDetected: false,
        sealDetected: false,
        logoDetected: false
      }
    };
  }

  private async waitForResult(jobId: string) {
    for (let attempt = 0; attempt < env.TEXTRACT_MAX_POLL_ATTEMPTS; attempt += 1) {
      const result = await textract.send(new GetDocumentAnalysisCommand({ JobId: jobId }));

      if (result.JobStatus === JobStatus.SUCCEEDED || result.JobStatus === JobStatus.PARTIAL_SUCCESS) {
        return result;
      }

      if (result.JobStatus === JobStatus.FAILED) {
        throw new Error(result.StatusMessage ? `Textract job failed: ${result.StatusMessage}` : "Textract job failed");
      }

      await sleep(env.TEXTRACT_POLL_INTERVAL_MS);
    }

    throw new Error(`Textract job ${jobId} did not complete before polling timed out`);
  }
}

export const textractDocumentClient = new TextractDocumentClient();
