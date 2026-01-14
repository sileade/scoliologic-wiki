/**
 * Markdown Exporter Module
 * Converts wiki page content (TipTap JSON) to Markdown format
 */

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

/**
 * Convert TipTap JSON to Markdown
 */
export function convertToMarkdown(json: TipTapNode): string {
  if (!json || !json.content) {
    return "";
  }

  return json.content.map(node => processNode(node)).join("\n\n");
}

function processNode(node: TipTapNode, depth: number = 0): string {
  switch (node.type) {
    case "paragraph":
      return processInlineContent(node.content || []);

    case "heading":
      const level = (node.attrs?.level as number) || 1;
      const headingPrefix = "#".repeat(level);
      return `${headingPrefix} ${processInlineContent(node.content || [])}`;

    case "bulletList":
      return (node.content || [])
        .map(item => processListItem(item, "-", depth))
        .join("\n");

    case "orderedList":
      return (node.content || [])
        .map((item, index) => processListItem(item, `${index + 1}.`, depth))
        .join("\n");

    case "taskList":
      return (node.content || [])
        .map(item => {
          const checked = item.attrs?.checked ? "[x]" : "[ ]";
          const indent = "  ".repeat(depth);
          const content = processInlineContent(item.content?.[0]?.content || []);
          return `${indent}- ${checked} ${content}`;
        })
        .join("\n");

    case "listItem":
      return processInlineContent(node.content?.[0]?.content || []);

    case "taskItem":
      const taskChecked = node.attrs?.checked ? "[x]" : "[ ]";
      return `- ${taskChecked} ${processInlineContent(node.content?.[0]?.content || [])}`;

    case "blockquote":
      return (node.content || [])
        .map(child => `> ${processNode(child, depth)}`)
        .join("\n");

    case "codeBlock":
      const language = (node.attrs?.language as string) || "";
      const code = processInlineContent(node.content || []);
      return `\`\`\`${language}\n${code}\n\`\`\``;

    case "horizontalRule":
      return "---";

    case "image":
      const src = node.attrs?.src as string || "";
      const alt = node.attrs?.alt as string || "image";
      const title = node.attrs?.title as string || "";
      return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;

    case "table":
      return processTable(node);

    case "hardBreak":
      return "  \n";

    default:
      if (node.content) {
        return node.content.map(child => processNode(child, depth)).join("\n");
      }
      return "";
  }
}

function processListItem(item: TipTapNode, prefix: string, depth: number): string {
  const indent = "  ".repeat(depth);
  const content = item.content || [];
  
  if (content.length === 0) {
    return `${indent}${prefix} `;
  }

  const firstParagraph = content[0];
  const text = processInlineContent(firstParagraph?.content || []);
  
  // Handle nested lists
  const nestedLists = content.slice(1)
    .filter(c => c.type === "bulletList" || c.type === "orderedList" || c.type === "taskList")
    .map(c => processNode(c, depth + 1))
    .join("\n");

  return nestedLists 
    ? `${indent}${prefix} ${text}\n${nestedLists}`
    : `${indent}${prefix} ${text}`;
}

function processInlineContent(content: TipTapNode[]): string {
  return content.map(node => {
    if (node.type === "text") {
      let text = node.text || "";
      
      // Apply marks
      if (node.marks) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case "bold":
            case "strong":
              text = `**${text}**`;
              break;
            case "italic":
            case "em":
              text = `*${text}*`;
              break;
            case "strike":
              text = `~~${text}~~`;
              break;
            case "code":
              text = `\`${text}\``;
              break;
            case "link":
              const href = mark.attrs?.href as string || "";
              text = `[${text}](${href})`;
              break;
            case "underline":
              text = `<u>${text}</u>`;
              break;
            case "highlight":
              text = `==${text}==`;
              break;
          }
        }
      }
      
      return text;
    }
    
    if (node.type === "hardBreak") {
      return "  \n";
    }
    
    return processNode(node);
  }).join("");
}

function processTable(node: TipTapNode): string {
  const rows = node.content || [];
  if (rows.length === 0) return "";

  const processedRows: string[][] = [];
  let hasHeader = false;

  for (const row of rows) {
    const cells = row.content || [];
    const processedCells: string[] = [];
    
    for (const cell of cells) {
      const isHeader = cell.type === "tableHeader";
      if (isHeader) hasHeader = true;
      
      const content = processInlineContent(cell.content?.[0]?.content || []);
      processedCells.push(content);
    }
    
    processedRows.push(processedCells);
  }

  if (processedRows.length === 0) return "";

  // Calculate column widths
  const colCount = Math.max(...processedRows.map(r => r.length));
  
  // Build markdown table
  const lines: string[] = [];
  
  for (let i = 0; i < processedRows.length; i++) {
    const row = processedRows[i];
    const paddedRow = [...row];
    while (paddedRow.length < colCount) {
      paddedRow.push("");
    }
    
    lines.push(`| ${paddedRow.join(" | ")} |`);
    
    // Add separator after first row if it's a header
    if (i === 0 && hasHeader) {
      lines.push(`| ${paddedRow.map(() => "---").join(" | ")} |`);
    }
  }

  // If no header was detected, add separator after first row anyway
  if (!hasHeader && processedRows.length > 0) {
    const separator = `| ${processedRows[0].map(() => "---").join(" | ")} |`;
    lines.splice(1, 0, separator);
  }

  return lines.join("\n");
}

/**
 * Generate Markdown file content with frontmatter
 */
export function generateMarkdownFile(page: {
  title: string;
  slug: string;
  icon?: string | null;
  contentJson?: object | null;
  createdAt?: Date;
  updatedAt?: Date;
  authorName?: string | null;
}): string {
  const frontmatter = [
    "---",
    `title: "${escapeYaml(page.title)}"`,
    `slug: "${page.slug}"`,
  ];

  if (page.icon) {
    frontmatter.push(`icon: "${page.icon}"`);
  }
  if (page.authorName) {
    frontmatter.push(`author: "${escapeYaml(page.authorName)}"`);
  }
  if (page.createdAt) {
    frontmatter.push(`created: "${page.createdAt.toISOString()}"`);
  }
  if (page.updatedAt) {
    frontmatter.push(`updated: "${page.updatedAt.toISOString()}"`);
  }

  frontmatter.push("---", "");

  const content = page.contentJson 
    ? convertToMarkdown(page.contentJson as TipTapNode)
    : "";

  return frontmatter.join("\n") + "\n" + content;
}

function escapeYaml(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Generate a ZIP-compatible structure for multiple pages
 */
export function generateMarkdownBundle(pages: Array<{
  title: string;
  slug: string;
  icon?: string | null;
  contentJson?: object | null;
  createdAt?: Date;
  updatedAt?: Date;
  authorName?: string | null;
  parentSlug?: string | null;
}>): Map<string, string> {
  const files = new Map<string, string>();

  for (const page of pages) {
    const path = page.parentSlug 
      ? `${page.parentSlug}/${page.slug}.md`
      : `${page.slug}.md`;
    
    files.set(path, generateMarkdownFile(page));
  }

  return files;
}
