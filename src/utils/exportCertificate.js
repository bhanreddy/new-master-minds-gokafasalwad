import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const PAGE_CONFIGS = {
  TC: {
    pdfFormat: [216, 330],
    pageWidth: 216,
    pageHeight: 330,
    contentHeight: 330,
    pageCss: '216mm 330mm portrait',
  },
  TC_A4_HALF: {
    pdfFormat: [210, 148.5],
    orientation: 'landscape',
    pageWidth: 210,
    pageHeight: 148.5,
    contentHeight: 148.5,
    pageCss: '210mm 148.5mm landscape',
  },
  BONAFIDE: {
    pdfFormat: 'a4',
    orientation: 'landscape',
    pageWidth: 297,
    pageHeight: 210,
    contentHeight: 210,
    pageCss: '297mm 210mm landscape',
  },
  RECEIPT: {
    pdfFormat: 'a4',
    pageWidth: 210,
    pageHeight: 297,
    contentHeight: 148.5,
    pageCss: '210mm 297mm portrait',
  },
};

const resolveElement = (target) => {
  if (!target) return null;
  if (target instanceof HTMLElement) return target;
  if (target.current instanceof HTMLElement) return target.current;
  return null;
};

export const getExportPageConfig = (type) => {
  const config = PAGE_CONFIGS[type];
  if (!config) {
    throw new Error(`Unsupported export type: ${type}`);
  }
  return config;
};

export const captureElementToImage = async (target) => {
  const element = resolveElement(target);
  if (!element) {
    throw new Error('Certificate preview not found.');
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
  });

  return canvas.toDataURL('image/png');
};

export const exportToPDF = async (target, type, filename, options = {}) => {
  const imgData = await captureElementToImage(target);
  const config = getExportPageConfig(type);

  const pdf = new jsPDF({
    orientation: config.orientation || 'portrait',
    unit: 'mm',
    format: config.pdfFormat,
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const contentH = config.contentHeight || pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, 'PNG', 0, 0, pageW, contentH);

  if (options.duplicate) {
    pdf.addImage(imgData, 'PNG', 0, config.contentHeight, pageW, config.contentHeight);
  }

  pdf.save(filename);
};

export const printElementToWindow = async (target, type, options = {}) => {
  if (typeof window === 'undefined') return;

  const imgData = await captureElementToImage(target);
  const config = getExportPageConfig(type);
  const duplicate = Boolean(options.duplicate);

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }

  const secondCopy = duplicate
    ? `<img src="${imgData}" style="width:${config.pageWidth}mm;height:${config.contentHeight}mm;display:block;" />`
    : '';

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${options.title || 'Document'}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: ${config.pageWidth}mm;
        min-height: ${config.pageHeight}mm;
        background: #ffffff;
      }
      img {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @page {
        size: ${config.pageCss};
        margin: 0;
      }
      @media print {
        html, body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
  </head>
  <body>
    <img src="${imgData}" style="width:${config.pageWidth}mm;height:${config.contentHeight}mm;display:block;" />
    ${secondCopy}
  </body>
</html>`);
  printWindow.document.close();
  printWindow.focus();

  const images = Array.from(printWindow.document.querySelectorAll('img'));
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }));

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    printWindow.addEventListener('afterprint', () => {
      try { printWindow.close(); } catch { /* noop */ }
    });
  }, 250);
};
