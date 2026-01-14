/**
 * PDF Generator Module
 * 
 * Generates PDF documents from wiki pages using Puppeteer.
 */

import puppeteer, { Browser, Page } from "puppeteer";

// Types
interface PageContent {
  title: string;
  content: string;
  author?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PDFOptions {
  format?: "A4" | "Letter" | "Legal";
  landscape?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  headerTemplate?: string;
  footerTemplate?: string;
  displayHeaderFooter?: boolean;
  printBackground?: boolean;
}

// Singleton browser instance
let browser: Browser | null = null;

/**
 * Get or create browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browser;
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Generate PDF from wiki page content
 */
export async function generatePDF(
  pageContent: PageContent,
  options: PDFOptions = {}
): Promise<Buffer> {
  const browserInstance = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browserInstance.newPage();

    // Set viewport
    await page.setViewport({ width: 1200, height: 800 });

    // Generate HTML content
    const html = generateHTML(pageContent, options);

    // Set content
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: options.format || "A4",
      landscape: options.landscape || false,
      margin: options.margin || {
        top: "20mm",
        right: "15mm",
        bottom: "20mm",
        left: "15mm",
      },
      displayHeaderFooter: options.displayHeaderFooter ?? true,
      headerTemplate: options.headerTemplate || generateHeaderTemplate(pageContent.title),
      footerTemplate: options.footerTemplate || generateFooterTemplate(),
      printBackground: options.printBackground ?? true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Generate PDF from multiple wiki pages
 */
export async function generateMultiPagePDF(
  pages: PageContent[],
  options: PDFOptions = {}
): Promise<Buffer> {
  const browserInstance = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browserInstance.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // Generate combined HTML
    const html = generateMultiPageHTML(pages, options);
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: options.format || "A4",
      landscape: options.landscape || false,
      margin: options.margin || {
        top: "20mm",
        right: "15mm",
        bottom: "20mm",
        left: "15mm",
      },
      displayHeaderFooter: options.displayHeaderFooter ?? true,
      headerTemplate: options.headerTemplate || generateHeaderTemplate("Scoliologic Wiki"),
      footerTemplate: options.footerTemplate || generateFooterTemplate(),
      printBackground: options.printBackground ?? true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Generate HTML template for single page
 */
function generateHTML(pageContent: PageContent, _options: PDFOptions): string {
  const { title, content, author, createdAt, updatedAt } = pageContent;

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    ${getBaseStyles()}
  </style>
</head>
<body>
  <article class="wiki-page">
    <header class="page-header">
      <h1 class="page-title">${escapeHtml(title)}</h1>
      <div class="page-meta">
        ${author ? `<span class="author">Автор: ${escapeHtml(author)}</span>` : ""}
        ${createdAt ? `<span class="date">Создано: ${formatDate(createdAt)}</span>` : ""}
        ${updatedAt ? `<span class="date">Обновлено: ${formatDate(updatedAt)}</span>` : ""}
      </div>
    </header>
    <main class="page-content">
      ${content}
    </main>
  </article>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML template for multiple pages
 */
function generateMultiPageHTML(pages: PageContent[], _options: PDFOptions): string {
  const pagesHtml = pages
    .map(
      (page, index) => `
    <article class="wiki-page ${index > 0 ? "page-break" : ""}">
      <header class="page-header">
        <h1 class="page-title">${escapeHtml(page.title)}</h1>
        <div class="page-meta">
          ${page.author ? `<span class="author">Автор: ${escapeHtml(page.author)}</span>` : ""}
          ${page.updatedAt ? `<span class="date">Обновлено: ${formatDate(page.updatedAt)}</span>` : ""}
        </div>
      </header>
      <main class="page-content">
        ${page.content}
      </main>
    </article>
  `
    )
    .join("\n");

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scoliologic Wiki - Экспорт</title>
  <style>
    ${getBaseStyles()}
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `.trim();
}

/**
 * Get base CSS styles for PDF
 */
function getBaseStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: white;
    }

    .wiki-page {
      max-width: 100%;
    }

    .page-break {
      page-break-before: always;
    }

    .page-header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #3b82f6;
    }

    .page-title {
      font-size: 24pt;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 8px;
    }

    .page-meta {
      font-size: 10pt;
      color: #666;
    }

    .page-meta span {
      margin-right: 16px;
    }

    .page-content {
      font-size: 11pt;
    }

    /* Typography */
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 12px;
      font-weight: 600;
      color: #1e3a5f;
    }

    h1 { font-size: 20pt; }
    h2 { font-size: 16pt; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    h3 { font-size: 14pt; }
    h4 { font-size: 12pt; }

    p {
      margin-bottom: 12px;
    }

    /* Lists */
    ul, ol {
      margin-left: 24px;
      margin-bottom: 12px;
    }

    li {
      margin-bottom: 4px;
    }

    /* Code */
    code {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 10pt;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
    }

    pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 16px;
    }

    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }

    th, td {
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background: #f3f4f6;
      font-weight: 600;
    }

    tr:nth-child(even) {
      background: #f9fafb;
    }

    /* Blockquotes */
    blockquote {
      border-left: 4px solid #3b82f6;
      padding-left: 16px;
      margin: 16px 0;
      color: #4b5563;
      font-style: italic;
    }

    /* Links */
    a {
      color: #3b82f6;
      text-decoration: none;
    }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      margin: 16px 0;
    }

    /* Horizontal rule */
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 24px 0;
    }

    /* Callouts */
    .callout {
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
    }

    .callout-info {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
    }

    .callout-warning {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
    }

    .callout-error {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
    }

    .callout-success {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
    }
  `;
}

/**
 * Generate header template for PDF
 */
function generateHeaderTemplate(title: string): string {
  return `
    <div style="font-size: 9px; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between; color: #666;">
      <span>${escapeHtml(title)}</span>
      <span>Scoliologic Wiki</span>
    </div>
  `;
}

/**
 * Generate footer template for PDF
 */
function generateFooterTemplate(): string {
  return `
    <div style="font-size: 9px; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between; color: #666;">
      <span>Экспортировано: ${new Date().toLocaleDateString("ru-RU")}</span>
      <span>Страница <span class="pageNumber"></span> из <span class="totalPages"></span></span>
    </div>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Export types
 */
export type { PageContent, PDFOptions };
