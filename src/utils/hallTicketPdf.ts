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
}

/** Tearable tickets per A4 sheet — taller cards, room for branding & schedule. */
export const TICKETS_PER_PAGE = 3;

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

function formatDate(value?: string | null): string {
  if (!value) return 'To be announced';
  const normalized = value.slice(0, 10);
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = date.toLocaleDateString('en-IN', { weekday: 'short' });
  const month = date.toLocaleDateString('en-IN', { month: 'short' });
  return `${weekday}, ${String(date.getDate()).padStart(2, '0')} ${month} ${date.getFullYear()}`;
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

function scheduleSummary(papers: ExamPaper[]): string {
  const dates = papers
    .map((paper) => paper.exam_date?.slice(0, 10) || '')
    .filter(Boolean)
    .sort();
  const count = papers.length;
  const subjectLabel = `${count} subject${count === 1 ? '' : 's'}`;
  if (dates.length === 0) return subjectLabel;
  const first = formatDate(dates[0]);
  const last = formatDate(dates[dates.length - 1]);
  return first === last ? `${subjectLabel} | ${first}` : `${subjectLabel} | ${first} - ${last}`;
}

function scheduleTable(papers: ExamPaper[]): string {
  const sorted = [...papers].sort((a, b) => {
    const left = `${a.exam_date || '9999'}|${a.start_time || '99:99'}|${a.subject_name}`;
    const right = `${b.exam_date || '9999'}|${b.start_time || '99:99'}|${b.subject_name}`;
    return left.localeCompare(right);
  });

  // Always a single table so every subject gets a Sign of Invigilator cell.
  // Compact two-column mode drops that column — skip it and let the taller
  // 3-per-page ticket absorb longer schedules instead.
  const rows = sorted
    .map(
      (paper, index) => `<tr>
        <td class="serial">${index + 1}</td>
        <td class="subject">${escapeHtml(paper.subject_name)}</td>
        <td>${escapeHtml(formatDate(paper.exam_date))}</td>
        <td>${escapeHtml(formatTimeRange(paper.start_time, paper.end_time))}</td>
        <td class="marks">${escapeHtml(Number(paper.max_marks) || '—')}</td>
        <td class="invigilator-sign"><span class="sign-line"></span></td>
      </tr>`,
    )
    .join('');

  return `<table class="schedule">
    <thead>
      <tr>
        <th>#</th>
        <th>Subject</th>
        <th>Date</th>
        <th>Time</th>
        <th>Marks</th>
        <th>Sign of Invigilator</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
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
  const schoolAddress = (options.school?.school_address || '').trim();
  const tagline = (options.school?.school_tagline || options.school?.school_affiliation || '').trim();
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
        <div class="header-brand">
          ${logoMarkup(logo, schoolName, 'school-logo')}
          <div class="school-block">
            <div class="school-name">${escapeHtml(schoolName)}</div>
            ${tagline ? `<div class="school-tagline">${escapeHtml(tagline)}</div>` : ''}
            ${schoolAddress ? `<div class="school-address">${escapeHtml(schoolAddress)}</div>` : ''}
          </div>
        </div>
        <div class="ticket-badge">
          <strong class="badge-title">Hall Ticket</strong>
          <span class="badge-exam">${escapeHtml(options.examName)}</span>
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
        <div>
          <span>Academic Year</span>
          <strong>${escapeHtml(options.academicYear || '—')}</strong>
        </div>
      </div>

      <div class="schedule-heading">
        <span class="schedule-label">Examination schedule</span>
        <span class="schedule-summary">${escapeHtml(scheduleSummary(options.papers))}</span>
      </div>
      <div class="schedule-wrap">${scheduleTable(options.papers)}</div>

      <footer class="ticket-footer">
        <div class="sign-block">
          <i></i>
          <span>Student signature</span>
        </div>
        <div class="sign-block">
          <i></i>
          <span>Class teacher</span>
        </div>
        <div class="sign-block">
          <i></i>
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
      padding: 6mm 7mm;
      display: grid;
      grid-template-rows: repeat(${TICKETS_PER_PAGE}, minmax(0, 1fr));
      page-break-inside: avoid;
      break-inside: avoid-page;
      overflow: hidden;
      background: #fff;
    }
    .hall-sheet + .hall-sheet { page-break-before: always; break-before: page; }

    .ticket-slot {
      min-height: 0;
      position: relative;
      padding: 1mm 0 2.2mm;
    }
    .ticket-slot:not(:nth-child(${TICKETS_PER_PAGE}n))::before {
      content: "";
      position: absolute;
      z-index: 3;
      left: -3mm;
      right: -3mm;
      bottom: 0.2mm;
      height: 1px;
      border-bottom: 0.3mm dashed #94a3b8;
    }
    .ticket-slot:not(:nth-child(${TICKETS_PER_PAGE}n))::after {
      content: "CUT HERE";
      position: absolute;
      z-index: 4;
      left: 50%;
      bottom: -0.85mm;
      transform: translateX(-50%);
      padding: 0 2mm;
      background: #fff;
      color: #94a3b8;
      font-size: 4.6pt;
      line-height: 2mm;
      letter-spacing: 0.7pt;
      font-weight: 700;
    }

    .ticket {
      position: relative;
      height: 100%;
      border: 0.35mm solid #243b8f;
      border-radius: 2mm;
      padding: 2.6mm 3.2mm 2.1mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background:
        linear-gradient(90deg, #f59e0b 0, #f59e0b 1.1mm, transparent 1.1mm),
        linear-gradient(180deg, #f8faff 0%, #ffffff 19mm);
    }

    .watermark {
      position: absolute;
      z-index: 0;
      top: 54%;
      left: 50%;
      width: 38mm;
      height: 38mm;
      object-fit: contain;
      opacity: 0.045;
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
      font-size: 16pt;
      font-weight: 800;
      opacity: 0.06;
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

    /* ── Header ─────────────────────────────────────────────── */
    .ticket-header {
      display: flex;
      align-items: stretch;
      gap: 3mm;
      min-height: 14mm;
    }
    .header-brand {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 2.6mm;
    }
    .school-logo {
      width: 12.5mm;
      height: 12.5mm;
      flex: 0 0 12.5mm;
      object-fit: contain;
      border-radius: 2mm;
      background: #fff;
      border: 0.25mm solid #c7d2fe;
      padding: 0.4mm;
    }
    .school-logo--fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #1e3a8a, #312e81);
      border: none;
      color: #fff;
      font-size: 7pt;
      font-weight: 800;
      letter-spacing: 0.2pt;
    }
    .school-block { flex: 1; min-width: 0; }
    .school-name {
      font-size: 10.4pt;
      line-height: 1.1;
      font-weight: 800;
      color: #172554;
      text-transform: uppercase;
      letter-spacing: 0.2pt;
    }
    .school-tagline {
      margin-top: 0.5mm;
      font-size: 6.2pt;
      font-weight: 600;
      color: #4338ca;
      letter-spacing: 0.15pt;
    }
    .school-address {
      margin-top: 0.55mm;
      font-size: 5.8pt;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ticket-badge {
      width: 32mm;
      flex: 0 0 32mm;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      text-align: right;
      padding: 0;
      background: transparent;
      border: none;
      box-shadow: none;
      color: #172554;
    }
    .badge-title {
      display: block;
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: 0.6pt;
      text-transform: uppercase;
      line-height: 1.1;
      color: #1e3a8a;
    }
    .badge-exam {
      display: block;
      margin-top: 0.8mm;
      max-width: 100%;
      font-size: 7pt;
      font-weight: 700;
      line-height: 1.15;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .header-rule {
      height: 0.6mm;
      margin: 1.4mm 0 1.4mm;
      border-radius: 1mm;
      background: #1e3a8a;
    }

    /* ── Student meta ───────────────────────────────────────── */
    .student-meta {
      display: grid;
      grid-template-columns: 2.1fr 1.15fr 1.25fr 0.75fr 1fr;
      gap: 0;
      padding: 1.3mm 1.5mm;
      margin-bottom: 1.3mm;
      border-radius: 1.4mm;
      background: #f4f6ff;
      border: 0.2mm solid #d7def7;
    }
    .student-meta div { min-width: 0; padding: 0 1.3mm; }
    .student-meta div:first-child { padding-left: 0; }
    .student-meta div:last-child { padding-right: 0; }
    .student-meta div + div { border-left: 0.2mm solid #d7def7; }
    .student-meta span {
      display: block;
      font-size: 5pt;
      line-height: 1;
      text-transform: uppercase;
      color: #667085;
      letter-spacing: 0.25pt;
      font-weight: 700;
    }
    .student-meta strong {
      display: block;
      margin-top: 0.55mm;
      font-size: 7.4pt;
      line-height: 1.15;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta-wide strong { font-size: 8.2pt; color: #172554; }

    .schedule-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 3mm;
      margin-bottom: 0.8mm;
    }
    .schedule-label {
      font-size: 5.6pt;
      font-weight: 800;
      letter-spacing: 0.45pt;
      text-transform: uppercase;
      color: #1e3a8a;
    }
    .schedule-summary {
      font-size: 5.2pt;
      font-weight: 600;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .schedule-wrap {
      flex: 0 1 auto;
      min-height: 0;
      overflow: hidden;
    }

    .schedule {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 6.4pt;
    }
    .schedule th, .schedule td {
      border: 0.2mm solid #aab7cf;
      padding: 0.7mm 0.9mm;
      line-height: 1.15;
      vertical-align: middle;
    }
    .schedule th {
      background: #243b8f;
      color: #fff;
      font-size: 5.1pt;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.15pt;
      font-weight: 700;
    }
    .schedule tbody tr { height: 6.4mm; }
    .schedule tbody tr:nth-child(even) td { background-color: #f8faff; }
    .schedule th:first-child, .schedule td.serial { width: 5.5mm; text-align: center; }
    .schedule .subject { width: 26%; font-weight: 700; color: #172554; }
    .schedule th:nth-child(3) { width: 20%; }
    .schedule th:nth-child(4) { width: 20%; }
    .schedule th:nth-child(5), .schedule td.marks { width: 11mm; text-align: center; }
    .schedule th:nth-child(6), .schedule td.invigilator-sign {
      width: 28mm;
      text-align: center;
    }
    .schedule th:nth-child(6) { background: #243b8f; color: #fff; }
    .schedule td.invigilator-sign {
      background-color: #fff;
      vertical-align: bottom;
      padding-bottom: 1.2mm;
    }
    .schedule td.invigilator-sign .sign-line {
      display: block;
      width: 78%;
      height: 0;
      margin: 0 auto;
      border-top: 0.25mm solid #94a3b8;
    }

    .ticket-footer {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 4mm;
      margin-top: auto;
      padding-top: 1mm;
      flex: 0 0 auto;
    }
    .sign-block {
      flex: 1;
      text-align: center;
      font-size: 5.4pt;
      color: #475569;
      font-weight: 600;
    }
    .sign-block i {
      display: block;
      border-top: 0.25mm solid #64748b;
      margin: 0 1mm 0.7mm;
      height: 4.6mm;
    }

    .ticket--single .schedule tbody tr { height: 8.2mm; }
    .ticket--dense .ticket-header { min-height: 12.5mm; }
    .ticket--dense .school-logo { width: 11mm; height: 11mm; flex-basis: 11mm; }
    .ticket--dense .school-address { display: none; }
    .ticket--dense .header-rule { margin: 1mm 0; height: 0.7mm; }
    .ticket--dense .student-meta { padding-top: 1mm; padding-bottom: 1mm; margin-bottom: 1mm; }
    .ticket--dense .schedule tbody tr { height: 4.7mm; }
    .ticket--dense .schedule th,
    .ticket--dense .schedule td { padding-top: 0.35mm; padding-bottom: 0.35mm; font-size: 5.5pt; }
    .ticket--dense .sign-block i { height: 3.4mm; }

    .ticket--very-dense { padding-top: 2mm; padding-bottom: 1.5mm; }
    .ticket--very-dense .ticket-header { min-height: 10.5mm; }
    .ticket--very-dense .school-logo { width: 9mm; height: 9mm; flex-basis: 9mm; }
    .ticket--very-dense .school-name { font-size: 8.6pt; }
    .ticket--very-dense .school-tagline,
    .ticket--very-dense .school-address { display: none; }
    .ticket--very-dense .header-rule { margin: 0.7mm 0; height: 0.6mm; }
    .ticket--very-dense .student-meta { padding-top: 0.7mm; padding-bottom: 0.7mm; margin-bottom: 0.7mm; }
    .ticket--very-dense .student-meta span { font-size: 4.4pt; }
    .ticket--very-dense .student-meta strong { font-size: 6.2pt; }
    .ticket--very-dense .schedule-heading { margin-bottom: 0.4mm; }
    .ticket--very-dense .schedule tbody tr { height: 3.7mm; }
    .ticket--very-dense .schedule th,
    .ticket--very-dense .schedule td { padding: 0.2mm 0.45mm; font-size: 4.8pt; }
    .ticket--very-dense .schedule th { font-size: 4.4pt; }
    .ticket--very-dense .ticket-footer { padding-top: 0.3mm; }
    .ticket--very-dense .sign-block i { height: 2.4mm; }
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
      const logoUrl = options.school?.school_logo_url?.trim();
      try {
        const { getLogoDataUri } = await import('./certificatePrint');
        return (await getLogoDataUri(logoUrl || undefined)) || null;
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

  const logoDataUri = await resolveLogoDataUri(options);
  const resolved: HallTicketPdfOptions = { ...options, logoDataUri };

  const fileName = getHallTicketFileName(resolved);
  if (typeof document !== 'undefined') {
    await downloadHallTicketsWeb(resolved, fileName);
  } else {
    await downloadHallTicketsNative(resolved, fileName);
  }
  return fileName;
}
