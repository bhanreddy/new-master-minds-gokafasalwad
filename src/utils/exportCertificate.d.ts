export type ExportDocumentType = 'TC' | 'TC_A4_HALF' | 'BONAFIDE' | 'RECEIPT';

export interface ExportOptions {
  duplicate?: boolean;
  title?: string;
}

export interface ExportPageConfig {
  pdfFormat: 'a4' | [number, number];
  orientation?: 'portrait' | 'landscape';
  pageWidth: number;
  pageHeight: number;
  contentHeight: number;
  pageCss: string;
}

export const PAGE_CONFIGS: Record<ExportDocumentType, ExportPageConfig>;

export function getExportPageConfig(type: ExportDocumentType): ExportPageConfig;

export function captureElementToImage(target: HTMLElement | { current: HTMLElement | null } | null): Promise<string>;

export function exportToPDF(
  target: HTMLElement | { current: HTMLElement | null } | null,
  type: ExportDocumentType,
  filename: string,
  options?: ExportOptions,
): Promise<void>;

export function printElementToWindow(
  target: HTMLElement | { current: HTMLElement | null } | null,
  type: ExportDocumentType,
  options?: ExportOptions,
): Promise<void>;
