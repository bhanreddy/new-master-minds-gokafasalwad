import type { ExamPaper } from '../services/examService';
import type { SchoolSettings } from '../services/schoolSettingsService';

export interface HallTicketStudent {
  id: string;
  display_name: string;
  admission_no: string;
  roll_number?: string | number | null;
}

export interface HallTicketPdfOptions {
  examName: string;
  academicYear?: string | null;
  className: string;
  sectionName: string;
  students: HallTicketStudent[];
  papers: ExamPaper[];
  school?: Partial<SchoolSettings> | null;
  /** Pre-resolved logo (data URI preferred). Resolved automatically on download if omitted. */
  logoDataUri?: string | null;
  /** Pre-resolved principal signature. Resolved from school settings when omitted. */
  principalSignatureDataUri?: string | null;
}

/** Compact tearable tickets per A4 sheet. */
export const TICKETS_PER_PAGE = 4;

const A4_PAGE_WIDTH_PX = 794;

function escapeHtml(value?: string | number | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fileSafe(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'exam'
  );
}

function formatCompactDate(value?: string | null): string {
  if (!value) return 'TBA';
  const normalized = value.slice(0, 10);
  const [year, month, day] = normalized.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatTime(value?: string | null): string {
  if (!value) return 'TBA';
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatTimeRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'To be announced';
  if (!end) return formatTime(start);
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function schoolInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || 'S'
  );
}

function scheduleTable(papers: ExamPaper[]): string {
  const sorted = [...papers].sort((a, b) => {
    const left = `${a.exam_date || '9999'}|${a.start_time || '99:99'}|${a.subject_name}`;
    const right = `${b.exam_date || '9999'}|${b.start_time || '99:99'}|${b.subject_name}`;
    return left.localeCompare(right);
  });

  const dates = sorted
    .map(
      (paper) => `<th scope="col">${escapeHtml(formatCompactDate(paper.exam_date))}</th>`,
    )
    .join('');

  const subjects = sorted
    .map(
      (paper) => `<td>
        <strong>${escapeHtml(paper.subject_name)}</strong>
        <span class="subject-time">${escapeHtml(formatTimeRange(paper.start_time, paper.end_time))}</span>
        <i class="invigilator-sign-line"></i>
        <small>Sign of invigilator</small>
      </td>`,
    )
    .join('');

  return `<table class="schedule">
    <thead>
      <tr>${dates}</tr>
    </thead>
    <tbody><tr>${subjects}</tr></tbody>
  </table>`;
}

function logoMarkup(logoDataUri: string | null | undefined, schoolName: string, className: string): string {
  if (logoDataUri) {
    return `<img class="${className}" src="${escapeHtml(logoDataUri)}" alt="" />`;
  }
  return `<div class="${className} ${className}--fallback">${escapeHtml(schoolInitials(schoolName))}</div>`;
}

function ticketHtml(options: HallTicketPdfOptions, student: HallTicketStudent): string {
  const schoolName = options.school?.school_name || 'School';
  const schoolMedium = (options.school?.school_medium || '').trim();
  const logo = options.logoDataUri;
  const densityClass =
    options.papers.length > 9
      ? 'ticket--very-dense'
      : options.papers.length > 6
        ? 'ticket--dense'
        : options.papers.length === 1
          ? 'ticket--single'
          : '';

  return `<section class="ticket-slot">
    <article class="ticket ${densityClass}">
      ${logoMarkup(logo, schoolName, 'watermark')}

      <header class="ticket-header">
        ${logoMarkup(logo, schoolName, 'school-logo')}
        <div class="school-block">
          <div class="school-name">${escapeHtml(schoolName)}</div>
          <div class="hall-ticket-title">
            Hall Ticket | ${escapeHtml(options.examName)}
            ${options.academicYear ? ` | ${escapeHtml(options.academicYear)}` : ''}
          </div>
        </div>
        <div class="header-end">
          ${schoolMedium ? `<span class="medium-label">${escapeHtml(schoolMedium)}</span>` : ''}
          ${logoMarkup(logo, schoolName, 'school-logo')}
        </div>
      </header>

      <div class="header-rule" aria-hidden="true"></div>

      <div class="student-meta">
        <div class="meta-wide">
          <span>Student</span>
          <strong>${escapeHtml(student.display_name)}</strong>
        </div>
        <div>
          <span>Admission No.</span>
          <strong>${escapeHtml(student.admission_no || '—')}</strong>
        </div>
        <div>
          <span>Class / Section</span>
          <strong>${escapeHtml(options.className)} / ${escapeHtml(options.sectionName)}</strong>
        </div>
        <div>
          <span>Roll No.</span>
          <strong>${escapeHtml(student.roll_number ?? '—')}</strong>
        </div>
      </div>

      <div class="schedule-heading">
        <span class="schedule-label">Examination schedule</span>
        <span class="schedule-summary">${options.papers.length} subject${options.papers.length === 1 ? '' : 's'}</span>
      </div>
      <div class="schedule-wrap">${scheduleTable(options.papers)}</div>

      <footer class="ticket-footer">
        <div class="sign-block">
          <i></i>
          <span>Class teacher</span>
        </div>
        <div class="sign-block principal-sign-block">
          ${options.principalSignatureDataUri
            ? `<img class="principal-signature" src="${escapeHtml(options.principalSignatureDataUri)}" alt="" />`
            : '<i></i>'}
          <span>Principal</span>
        </div>
      </footer>
    </article>
  </section>`;
}

export function buildHallTicketHtml(options: HallTicketPdfOptions): string {
  const pages: string[] = [];
  for (let index = 0; index < options.students.length; index += TICKETS_PER_PAGE) {
    const ticketRows = options.students
      .slice(index, index + TICKETS_PER_PAGE)
      .map((student) => ticketHtml(options, student))
      .join('');
    pages.push(`<main class="hall-sheet">${ticketRows}</main>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.examName)} Hall Tickets</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #0f172a;
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    }

    .hall-sheet {
      width: 210mm;
      height: 297mm;
      padding: 4.5mm 6mm;
      display: grid;
      grid-template-rows: repeat(${TICKETS_PER_PAGE}, 61mm);
      row-gap: 5mm;
      align-content: start;
      page-break-inside: avoid;
      break-inside: avoid-page;
      overflow: hidden;
      background: #fff;
    }
    .hall-sheet + .hall-sheet { page-break-before: always; break-before: page; }

    .ticket-slot {
      min-height: 0;
      position: relative;
      height: 61mm;
      padding: 0;
    }
    .ticket-slot:not(:nth-child(${TICKETS_PER_PAGE}n))::before {
      content: "";
      position: absolute;
      z-index: 3;
      left: -3mm;
      right: -3mm;
      bottom: 1mm;
      height: 1px;
      border-bottom: 0.3mm dashed #94a3b8;
    }
    .ticket-slot:not(:nth-child(${TICKETS_PER_PAGE}n))::after {
      content: "CUT HERE";
      position: absolute;
      z-index: 4;
      left: 50%;
      bottom: 0.05mm;
      transform: translateX(-50%);
      padding: 0 2mm;
      background: #fff;
      color: #94a3b8;
      font-size: 4.3pt;
      line-height: 2mm;
      letter-spacing: 0.65pt;
      font-weight: 700;
    }

    .ticket {
      position: relative;
      height: 58mm;
      border: 0.3mm solid #243b8f;
      border-radius: 1.6mm;
      padding: 1.6mm 2.5mm 1.3mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background:
        linear-gradient(90deg, #f59e0b 0, #f59e0b 0.9mm, transparent 0.9mm),
        linear-gradient(180deg, #f8faff 0%, #ffffff 14mm);
    }

    .watermark {
      position: absolute;
      z-index: 0;
      top: 56%;
      left: 50%;
      width: 35mm;
      height: 35mm;
      object-fit: contain;
      opacity: 0.1;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .watermark--fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #1e3a8a;
      color: #fff;
      font-size: 15pt;
      font-weight: 800;
      opacity: 0.1;
    }

    .ticket-header,
    .header-rule,
    .student-meta,
    .schedule-heading,
    .schedule-wrap,
    .ticket-footer {
      position: relative;
      z-index: 1;
    }

    /* Compact reference-style header: icon, centred identity, medium + icon. */
    .ticket-header {
      display: flex;
      align-items: center;
      gap: 2mm;
      min-height: 10.2mm;
    }
    .school-logo {
      width: 9.5mm;
      height: 9.5mm;
      flex: 0 0 9.5mm;
      object-fit: contain;
      border-radius: 1.4mm;
      background: #fff;
      border: 0.25mm solid #c7d2fe;
      padding: 0.3mm;
    }
    .school-logo--fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #1e3a8a, #312e81);
      border: none;
      color: #fff;
      font-size: 5.8pt;
      font-weight: 800;
      letter-spacing: 0.2pt;
    }
    .school-block {
      flex: 1;
      min-width: 0;
      text-align: center;
    }
    .school-name {
      font-size: 9.4pt;
      line-height: 1.05;
      font-weight: 800;
      color: #172554;
      text-transform: uppercase;
      letter-spacing: 0.15pt;
    }
    .hall-ticket-title {
      margin-top: 0.35mm;
      font-size: 7.2pt;
      line-height: 1.1;
      color: #1e3a8a;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.22pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-end {
      width: 21mm;
      flex: 0 0 21mm;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 1.2mm;
    }
    .medium-label {
      font-size: 6pt;
      font-weight: 700;
      color: #172554;
      text-transform: uppercase;
    }

    .header-rule {
      height: 0.45mm;
      margin: 0.7mm 0 0.75mm;
      border-radius: 1mm;
      background: #1e3a8a;
    }

    .student-meta {
      display: grid;
      grid-template-columns: 2.25fr 1.2fr 1.3fr 0.75fr;
      gap: 0;
      padding: 0.75mm 1.1mm;
      margin-bottom: 0.7mm;
      border-radius: 1mm;
      background: #f4f6ff;
      border: 0.2mm solid #d7def7;
    }
    .student-meta div { min-width: 0; padding: 0 0.9mm; }
    .student-meta div:first-child { padding-left: 0; }
    .student-meta div:last-child { padding-right: 0; }
    .student-meta div + div { border-left: 0.2mm solid #d7def7; }
    .student-meta span {
      display: block;
      font-size: 4.3pt;
      line-height: 1;
      text-transform: uppercase;
      color: #667085;
      letter-spacing: 0.25pt;
      font-weight: 700;
    }
    .student-meta strong {
      display: block;
      margin-top: 0.35mm;
      font-size: 6.3pt;
      line-height: 1.15;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta-wide strong { font-size: 7pt; color: #172554; }

    .schedule-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 3mm;
      margin-bottom: 0.45mm;
    }
    .schedule-label {
      font-size: 4.8pt;
      font-weight: 800;
      letter-spacing: 0.4pt;
      text-transform: uppercase;
      color: #1e3a8a;
    }
    .schedule-summary {
      font-size: 4.5pt;
      font-weight: 600;
      color: #64748b;
      white-space: nowrap;
    }
    .schedule-wrap {
      flex: 0 1 auto;
      min-height: 0;
      overflow: hidden;
    }

    /* Every paper is one horizontal column: date above subject, time and marks. */
    .schedule {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 5.3pt;
    }
    .schedule th, .schedule td {
      border: 0.2mm solid #aab7cf;
      padding: 0.5mm 0.45mm;
      line-height: 1.08;
      vertical-align: middle;
      text-align: center;
      overflow-wrap: anywhere;
    }
    .schedule th {
      height: 3.8mm;
      background: #243b8f;
      color: #fff;
      font-size: 4.5pt;
      letter-spacing: 0.05pt;
      font-weight: 700;
    }
    .schedule tbody tr { height: 14.5mm; }
    .schedule td { background-color: rgba(255, 255, 255, 0.9); }
    .schedule td strong {
      display: block;
      font-size: 5.4pt;
      line-height: 1.05;
      color: #172554;
    }
    .schedule td .subject-time,
    .schedule td small {
      display: block;
      margin-top: 0.35mm;
      color: #64748b;
      font-size: 3.9pt;
      line-height: 1.05;
    }
    .schedule td .invigilator-sign-line {
      display: block;
      width: 80%;
      height: 2.5mm;
      margin: 0.35mm auto 0;
      border-bottom: 0.2mm solid #64748b;
    }
    .schedule td small {
      margin-top: 0.2mm;
      font-size: 3.3pt;
    }

    .ticket-footer {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 0;
      min-height: 6.5mm;
      margin-top: 0.7mm;
      padding: 0;
      flex: 0 0 6.5mm;
      border: 0.2mm solid #d7def7;
      border-radius: 1mm;
      background: rgba(248, 250, 255, 0.78);
      overflow: hidden;
    }
    .sign-block {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 0.55mm 1mm 0.45mm;
      text-align: center;
      font-size: 4.8pt;
      color: #475569;
      font-weight: 600;
    }
    .sign-block + .sign-block { border-left: 0.2mm solid #d7def7; }
    .sign-block i {
      display: block;
      flex: 1 1 auto;
      min-height: 2.4mm;
      border-bottom: 0.25mm solid #64748b;
      margin: 0 1mm 0.5mm;
    }
    .principal-signature {
      display: block;
      flex: 1 1 auto;
      width: 84%;
      min-height: 2.4mm;
      max-height: 5.5mm;
      height: auto;
      margin: 0 auto 0.5mm;
      border-bottom: 0.25mm solid #64748b;
      object-fit: contain;
      object-position: center bottom;
    }

    .ticket--single .schedule tbody tr { height: 15mm; }
    .ticket--dense .ticket-header { min-height: 9.2mm; }
    .ticket--dense .school-logo { width: 8.5mm; height: 8.5mm; flex-basis: 8.5mm; }
    .ticket--dense .header-rule { margin: 0.55mm 0; height: 0.4mm; }
    .ticket--dense .student-meta { padding-top: 0.55mm; padding-bottom: 0.55mm; margin-bottom: 0.55mm; }
    .ticket--dense .schedule tbody tr { height: 13.5mm; }
    .ticket--dense .schedule th,
    .ticket--dense .schedule td { padding-left: 0.25mm; padding-right: 0.25mm; }
    .ticket--dense .schedule td strong { font-size: 4.8pt; }
    .ticket--dense .schedule td .subject-time { font-size: 3.5pt; }
    .ticket--dense .schedule td small { font-size: 3pt; }
    .ticket--dense .sign-block i,
    .ticket--dense .principal-signature { min-height: 2.2mm; }

    .ticket--very-dense { padding-top: 1.2mm; padding-bottom: 1mm; }
    .ticket--very-dense .ticket-header { min-height: 8.2mm; }
    .ticket--very-dense .school-logo { width: 7.5mm; height: 7.5mm; flex-basis: 7.5mm; }
    .ticket--very-dense .school-name { font-size: 8pt; }
    .ticket--very-dense .header-rule { margin: 0.4mm 0; height: 0.35mm; }
    .ticket--very-dense .student-meta { padding-top: 0.4mm; padding-bottom: 0.4mm; margin-bottom: 0.4mm; }
    .ticket--very-dense .student-meta span { font-size: 4.1pt; }
    .ticket--very-dense .student-meta strong { font-size: 5.9pt; }
    .ticket--very-dense .schedule-heading { margin-bottom: 0.3mm; }
    .ticket--very-dense .schedule tbody tr { height: 12.5mm; }
    .ticket--very-dense .schedule th,
    .ticket--very-dense .schedule td { padding: 0.2mm; }
    .ticket--very-dense .schedule th { height: 3mm; font-size: 3.7pt; }
    .ticket--very-dense .schedule td strong { font-size: 4.1pt; }
    .ticket--very-dense .schedule td .subject-time { font-size: 3.1pt; }
    .ticket--very-dense .schedule td small { font-size: 2.7pt; }
    .ticket--very-dense .ticket-footer { padding-top: 0.2mm; }
    .ticket--very-dense .sign-block i,
    .ticket--very-dense .principal-signature { min-height: 2mm; }
  </style>
</head>
<body>${pages.join('')}</body>
</html>`;
}

export function getHallTicketFileName(options: HallTicketPdfOptions): string {
  return `hall-tickets_${fileSafe(options.examName)}_${fileSafe(options.className)}-${fileSafe(options.sectionName)}.pdf`;
}

async function resolveLogoDataUri(options: HallTicketPdfOptions): Promise<string | null> {
  const candidate =
    options.logoDataUri ||
    (await (async () => {
      try {
        const { getLogoDataUri } = await import('./certificatePrint');
        // Hall tickets follow the installed school's app branding. Calling
        // without a remote URL resolves the bundled app icon.
        return (await getLogoDataUri()) || null;
      } catch {
        return null;
      }
    })());

  if (!candidate) return null;

  // Reject broken/empty images — html2canvas crashes on 0×0 bitmaps via createPattern.
  if (typeof Image === 'undefined') return candidate;
  const ok = await new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
    img.onerror = () => resolve(false);
    img.src = candidate;
  });
  return ok ? candidate : null;
}

async function resolvePrincipalSignatureDataUri(options: HallTicketPdfOptions): Promise<string | null> {
  const candidate =
    options.principalSignatureDataUri ||
    (await (async () => {
      const signatureUrl = options.school?.principal_signature_url?.trim();
      if (!signatureUrl) return null;
      try {
        const { getLogoDataUri } = await import('./certificatePrint');
        return (await getLogoDataUri(signatureUrl)) || null;
      } catch {
        return null;
      }
    })());

  if (!candidate) return null;
  if (typeof Image === 'undefined') return candidate;
  const ok = await new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => resolve(false);
    image.src = candidate;
  });
  return ok ? candidate : null;
}

/** Wait until every <img> in the offscreen tree has settled (load or error). */
function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          if (img.complete && img.naturalWidth === 0) {
            // Broken image — remove so html2canvas never paints a 0×0 canvas.
            img.replaceWith(document.createElement('span'));
            resolve();
            return;
          }
          const done = () => {
            if (img.naturalWidth === 0) {
              img.replaceWith(document.createElement('span'));
            }
            resolve();
          };
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  ).then(() => undefined);
}

async function downloadHallTicketsWeb(options: HallTicketPdfOptions, fileName: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('Hall-ticket download is only available in a browser context.');
  }

  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const html2canvas = html2canvasModule.default;
  const wrapper = document.createElement('div');
  wrapper.setAttribute('aria-hidden', 'true');
  // Keep on-screen (opacity 0) so layout/images get real dimensions. Off-left
  // positioning can yield 0-size canvases inside html2canvas createPattern.
  wrapper.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${A4_PAGE_WIDTH_PX}px`,
    'opacity:0',
    'pointer-events:none',
    'background:#ffffff',
    'z-index:-1',
  ].join(';');
  wrapper.innerHTML = buildHallTicketHtml(options);
  document.body.appendChild(wrapper);

  try {
    await waitForImages(wrapper);
    // Let the browser finish layout after any logo fallback swaps.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const sheets = Array.from(wrapper.querySelectorAll('.hall-sheet')) as HTMLElement[];
    if (sheets.length === 0) throw new Error('No hall-ticket pages were generated.');

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    for (let index = 0; index < sheets.length; index += 1) {
      const canvas = await html2canvas(sheets[index], {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        imageTimeout: 8000,
        logging: false,
      });
      if (!canvas.width || !canvas.height) {
        throw new Error('Could not render hall-ticket page. Please try again.');
      }
      if (index > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }
    pdf.save(fileName);
  } finally {
    wrapper.remove();
  }
}

async function downloadHallTicketsNative(options: HallTicketPdfOptions, fileName: string): Promise<void> {
  const Print = await import('expo-print');
  const Sharing = await import('expo-sharing');
  const { uri } = await Print.printToFileAsync({ html: buildHallTicketHtml(options) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      dialogTitle: `Download ${fileName}`,
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
    return;
  }
  await Print.printAsync({ uri });
}

export async function downloadHallTicketPdf(options: HallTicketPdfOptions): Promise<string> {
  if (options.students.length === 0) throw new Error('No students found for this class and section.');
  if (options.papers.length === 0) throw new Error('No exam papers are scheduled for this class.');

  const [logoDataUri, principalSignatureDataUri] = await Promise.all([
    resolveLogoDataUri(options),
    resolvePrincipalSignatureDataUri(options),
  ]);
  const resolved: HallTicketPdfOptions = {
    ...options,
    logoDataUri,
    principalSignatureDataUri,
  };

  const fileName = getHallTicketFileName(resolved);
  if (typeof document !== 'undefined') {
    await downloadHallTicketsWeb(resolved, fileName);
  } else {
    await downloadHallTicketsNative(resolved, fileName);
  }
  return fileName;
}
