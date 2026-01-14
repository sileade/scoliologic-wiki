/**
 * Export service for converting wiki pages to different formats
 * Supports: Markdown, HTML, and PDF (via HTML)
 */

/**
 * Convert TipTap JSON content to Markdown
 */
export function jsonToMarkdown(contentJson: object, title: string): string {
  let markdown = `# ${title}\n\n`;

  function processNode(node: any): string {
    if (!node) return "";

    switch (node.type) {
      case "doc":
        return (node.content || []).map(processNode).join("");

      case "heading":
        const level = node.attrs?.level || 1;
        const headingContent = (node.content || []).map(processNode).join("");
        return `${"#".repeat(level)} ${headingContent}\n\n`;

      case "paragraph":
        const paraContent = (node.content || []).map(processNode).join("");
        return paraContent ? `${paraContent}\n\n` : "";

      case "text":
        let text = node.text || "";
        if (node.marks) {
          node.marks.forEach((mark: any) => {
            switch (mark.type) {
              case "bold":
                text = `**${text}**`;
                break;
              case "italic":
                text = `*${text}*`;
                break;
              case "code":
                text = "`" + text + "`";
                break;
              case "strikethrough":
                text = `~~${text}~~`;
                break;
            }
          });
        }
        return text;

      case "bulletList":
        return (node.content || [])
          .map((item: any) => `- ${processNode(item)}`)
          .join("");

      case "orderedList":
        return (node.content || [])
          .map((item: any, idx: number) => `${idx + 1}. ${processNode(item)}`)
          .join("");

      case "listItem":
        const itemContent = (node.content || []).map(processNode).join("");
        return itemContent.trim() + "\n";

      case "codeBlock":
        const code = (node.content || []).map(processNode).join("");
        const language = node.attrs?.language || "text";
        return `\`\`\`${language}\n${code}\`\`\`\n\n`;

      case "blockquote":
        const quoteContent = (node.content || []).map(processNode).join("");
        return quoteContent
          .split("\n")
          .map((line: string) => `> ${line}`)
          .join("\n") + "\n\n";

      case "image":
        const alt = node.attrs?.alt || "Image";
        const src = node.attrs?.src || "";
        return `![${alt}](${src})`;

      case "hardBreak":
        return "\n";

      case "horizontalRule":
        return "---\n\n";

      case "link":
        const linkText = (node.content || []).map(processNode).join("");
        const href = node.attrs?.href || "#";
        return `[${linkText}](${href})`;

      case "table":
        return processTable(node);

      default:
        return (node.content || []).map(processNode).join("");
    }
  }

  function processTable(node: any): string {
    const rows = node.content || [];
    if (rows.length === 0) return "";

    let table = "";
    rows.forEach((row: any, rowIdx: number) => {
      const cells = row.content || [];
      const cellContent = cells
        .map((cell: any) => {
          const content = (cell.content || []).map(processNode).join("").trim();
          return content;
        })
        .join(" | ");

      table += `| ${cellContent} |\n`;

      // Add separator after header
      if (rowIdx === 0) {
        const separators = cells.map(() => "---").join(" | ");
        table += `| ${separators} |\n`;
      }
    });

    return table + "\n";
  }

  markdown += processNode(contentJson);
  return markdown;
}

/**
 * Convert TipTap JSON content to HTML
 */
export function jsonToHTML(contentJson: object, title: string): string {
  const html = convertToHTML(contentJson);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
    }
    h1 { font-size: 2em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    p {
      margin-bottom: 16px;
    }
    code {
      background-color: #f6f8fa;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: monospace;
    }
    pre {
      background-color: #f6f8fa;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 16px;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 16px;
      margin-left: 0;
      color: #666;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    table th, table td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    table th {
      background-color: #f6f8fa;
      font-weight: 600;
    }
    img {
      max-width: 100%;
      height: auto;
      margin: 16px 0;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    ul, ol {
      margin-bottom: 16px;
      padding-left: 2em;
    }
    li {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${html}
</body>
</html>`;
}

/**
 * Convert TipTap JSON to HTML
 */
function convertToHTML(node: any): string {
  if (!node) return "";

  if (Array.isArray(node)) {
    return node.map(convertToHTML).join("");
  }

  switch (node.type) {
    case "doc":
      return (node.content || []).map(convertToHTML).join("");

    case "heading":
      const level = node.attrs?.level || 1;
      const headingContent = (node.content || []).map(convertToHTML).join("");
      return `<h${level}>${headingContent}</h${level}>`;

    case "paragraph":
      const paraContent = (node.content || []).map(convertToHTML).join("");
      return `<p>${paraContent}</p>`;

    case "text":
      let text = (node.text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      if (node.marks) {
        node.marks.forEach((mark: any) => {
          switch (mark.type) {
            case "bold":
              text = `<strong>${text}</strong>`;
              break;
            case "italic":
              text = `<em>${text}</em>`;
              break;
            case "code":
              text = `<code>${text}</code>`;
              break;
            case "strikethrough":
              text = `<del>${text}</del>`;
              break;
          }
        });
      }
      return text;

    case "bulletList":
      const bulletItems = (node.content || []).map(convertToHTML).join("");
      return `<ul>${bulletItems}</ul>`;

    case "orderedList":
      const orderedItems = (node.content || []).map(convertToHTML).join("");
      return `<ol>${orderedItems}</ol>`;

    case "listItem":
      const itemContent = (node.content || []).map(convertToHTML).join("");
      return `<li>${itemContent}</li>`;

    case "codeBlock":
      const code = (node.content || []).map(convertToHTML).join("");
      const language = node.attrs?.language || "text";
      return `<pre><code class="language-${language}">${code}</code></pre>`;

    case "blockquote":
      const quoteContent = (node.content || []).map(convertToHTML).join("");
      return `<blockquote>${quoteContent}</blockquote>`;

    case "image":
      const alt = node.attrs?.alt || "Image";
      const src = node.attrs?.src || "";
      return `<img src="${src}" alt="${alt}" />`;

    case "hardBreak":
      return "<br />";

    case "horizontalRule":
      return "<hr />";

    case "link":
      const linkText = (node.content || []).map(convertToHTML).join("");
      const href = node.attrs?.href || "#";
      return `<a href="${href}">${linkText}</a>`;

    case "table":
      return convertTable(node);

    default:
      return (node.content || []).map(convertToHTML).join("");
  }
}

function convertTable(node: any): string {
  const rows = node.content || [];
  if (rows.length === 0) return "";

  let table = "<table>";
  rows.forEach((row: any, rowIdx: number) => {
    const cells = row.content || [];
    const isHeader = rowIdx === 0;
    const tag = isHeader ? "th" : "td";

    table += "<tr>";
    cells.forEach((cell: any) => {
      const content = (cell.content || []).map(convertToHTML).join("");
      table += `<${tag}>${content}</${tag}>`;
    });
    table += "</tr>";
  });
  table += "</table>";

  return table;
}

/**
 * Export page as Markdown file content
 */
export function exportAsMarkdown(
  title: string,
  contentJson: object,
  author?: string,
  date?: Date
): string {
  let markdown = "";

  // Add metadata
  if (author || date) {
    markdown += "---\n";
    if (author) markdown += `author: ${author}\n`;
    if (date) markdown += `date: ${date.toISOString().split("T")[0]}\n`;
    markdown += "---\n\n";
  }

  markdown += jsonToMarkdown(contentJson, title);
  return markdown;
}

/**
 * Export page as HTML file content
 */
export function exportAsHTML(title: string, contentJson: object): string {
  return jsonToHTML(contentJson, title);
}
