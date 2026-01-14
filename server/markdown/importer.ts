/**
 * Markdown to TipTap JSON Importer
 * Converts Markdown content to TipTap editor JSON format
 */

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

interface ImportResult {
  title: string;
  content: TipTapNode;
  metadata: {
    slug?: string;
    icon?: string;
    author?: string;
    created?: string;
    updated?: string;
  };
}

/**
 * Parse YAML frontmatter from Markdown content
 */
function parseFrontmatter(markdown: string): { frontmatter: Record<string, string>; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = markdown.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, content: markdown };
  }
  
  const frontmatterStr = match[1];
  const content = markdown.slice(match[0].length);
  const frontmatter: Record<string, string> = {};
  
  frontmatterStr.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, content };
}

/**
 * Parse inline formatting (bold, italic, code, links)
 */
function parseInlineContent(text: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    // Bold **text** or __text__
    let match = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (match) {
      nodes.push({
        type: 'text',
        text: match[2],
        marks: [{ type: 'bold' }]
      });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    
    // Italic *text* or _text_
    match = remaining.match(/^(\*|_)(.+?)\1/);
    if (match) {
      nodes.push({
        type: 'text',
        text: match[2],
        marks: [{ type: 'italic' }]
      });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    
    // Strikethrough ~~text~~
    match = remaining.match(/^~~(.+?)~~/);
    if (match) {
      nodes.push({
        type: 'text',
        text: match[1],
        marks: [{ type: 'strike' }]
      });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    
    // Inline code `code`
    match = remaining.match(/^`([^`]+)`/);
    if (match) {
      nodes.push({
        type: 'text',
        text: match[1],
        marks: [{ type: 'code' }]
      });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    
    // Links [text](url)
    match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      nodes.push({
        type: 'text',
        text: match[1],
        marks: [{ type: 'link', attrs: { href: match[2] } }]
      });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    
    // Images ![alt](url)
    match = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (match) {
      // Images are block-level, but handle inline for now
      nodes.push({
        type: 'text',
        text: `[Image: ${match[1] || match[2]}]`
      });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    
    // Plain text until next special character
    match = remaining.match(/^[^*_`~\[!]+/);
    if (match) {
      nodes.push({
        type: 'text',
        text: match[0]
      });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    
    // Single special character
    nodes.push({
      type: 'text',
      text: remaining[0]
    });
    remaining = remaining.slice(1);
  }
  
  return nodes;
}

/**
 * Parse a single line and return appropriate node
 */
function parseLine(line: string): TipTapNode | null {
  // Empty line
  if (line.trim() === '') {
    return null;
  }
  
  // Headings
  const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    return {
      type: 'heading',
      attrs: { level },
      content: parseInlineContent(headingMatch[2])
    };
  }
  
  // Horizontal rule
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
    return { type: 'horizontalRule' };
  }
  
  // Blockquote
  if (line.startsWith('> ')) {
    return {
      type: 'blockquote',
      content: [{
        type: 'paragraph',
        content: parseInlineContent(line.slice(2))
      }]
    };
  }
  
  // Unordered list item
  const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
  if (ulMatch) {
    return {
      type: 'listItem',
      attrs: { listType: 'bullet' },
      content: [{
        type: 'paragraph',
        content: parseInlineContent(ulMatch[2])
      }]
    };
  }
  
  // Ordered list item
  const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
  if (olMatch) {
    return {
      type: 'listItem',
      attrs: { listType: 'ordered' },
      content: [{
        type: 'paragraph',
        content: parseInlineContent(olMatch[2])
      }]
    };
  }
  
  // Task list item
  const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/);
  if (taskMatch) {
    return {
      type: 'taskItem',
      attrs: { checked: taskMatch[2].toLowerCase() === 'x' },
      content: [{
        type: 'paragraph',
        content: parseInlineContent(taskMatch[3])
      }]
    };
  }
  
  // Regular paragraph
  return {
    type: 'paragraph',
    content: parseInlineContent(line)
  };
}

/**
 * Parse code block
 */
function parseCodeBlock(lines: string[], startIndex: number): { node: TipTapNode; endIndex: number } {
  const firstLine = lines[startIndex];
  const langMatch = firstLine.match(/^```(\w*)$/);
  const language = langMatch ? langMatch[1] || 'text' : 'text';
  
  const codeLines: string[] = [];
  let endIndex = startIndex + 1;
  
  while (endIndex < lines.length && !lines[endIndex].startsWith('```')) {
    codeLines.push(lines[endIndex]);
    endIndex++;
  }
  
  return {
    node: {
      type: 'codeBlock',
      attrs: { language },
      content: [{
        type: 'text',
        text: codeLines.join('\n')
      }]
    },
    endIndex: endIndex + 1
  };
}

/**
 * Parse table
 */
function parseTable(lines: string[], startIndex: number): { node: TipTapNode; endIndex: number } {
  const rows: TipTapNode[] = [];
  let endIndex = startIndex;
  
  while (endIndex < lines.length && lines[endIndex].includes('|')) {
    const line = lines[endIndex].trim();
    
    // Skip separator row
    if (/^\|?[\s-:|]+\|?$/.test(line)) {
      endIndex++;
      continue;
    }
    
    const cells = line
      .split('|')
      .filter(cell => cell.trim() !== '')
      .map(cell => cell.trim());
    
    const isHeader = endIndex === startIndex;
    
    rows.push({
      type: 'tableRow',
      content: cells.map(cell => ({
        type: isHeader ? 'tableHeader' : 'tableCell',
        content: [{
          type: 'paragraph',
          content: parseInlineContent(cell)
        }]
      }))
    });
    
    endIndex++;
  }
  
  return {
    node: {
      type: 'table',
      content: rows
    },
    endIndex
  };
}

/**
 * Group list items into proper list structures
 */
function groupListItems(nodes: TipTapNode[]): TipTapNode[] {
  const result: TipTapNode[] = [];
  let currentList: TipTapNode | null = null;
  let currentListType: string | null = null;
  
  for (const node of nodes) {
    if (node.type === 'listItem') {
      const listType = (node.attrs?.listType as string) || 'bullet';
      const wrapperType = listType === 'ordered' ? 'orderedList' : 'bulletList';
      
      if (currentListType !== listType) {
        if (currentList) {
          result.push(currentList);
        }
        currentList = { type: wrapperType, content: [] };
        currentListType = listType;
      }
      
      currentList!.content!.push(node);
    } else if (node.type === 'taskItem') {
      if (currentListType !== 'task') {
        if (currentList) {
          result.push(currentList);
        }
        currentList = { type: 'taskList', content: [] };
        currentListType = 'task';
      }
      
      currentList!.content!.push(node);
    } else {
      if (currentList) {
        result.push(currentList);
        currentList = null;
        currentListType = null;
      }
      result.push(node);
    }
  }
  
  if (currentList) {
    result.push(currentList);
  }
  
  return result;
}

/**
 * Main function to convert Markdown to TipTap JSON
 */
export function markdownToTipTap(markdown: string): ImportResult {
  const { frontmatter, content } = parseFrontmatter(markdown);
  const lines = content.split('\n');
  const nodes: TipTapNode[] = [];
  
  let i = 0;
  let title = frontmatter.title || '';
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Code block
    if (line.startsWith('```')) {
      const { node, endIndex } = parseCodeBlock(lines, i);
      nodes.push(node);
      i = endIndex;
      continue;
    }
    
    // Table
    if (line.includes('|') && i + 1 < lines.length && /^\|?[\s-:|]+\|?$/.test(lines[i + 1])) {
      const { node, endIndex } = parseTable(lines, i);
      nodes.push(node);
      i = endIndex;
      continue;
    }
    
    // Image on its own line
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      nodes.push({
        type: 'image',
        attrs: {
          src: imageMatch[2],
          alt: imageMatch[1] || '',
          title: imageMatch[1] || ''
        }
      });
      i++;
      continue;
    }
    
    // Regular line
    const node = parseLine(line);
    if (node) {
      // Extract title from first H1 if not in frontmatter
      if (!title && node.type === 'heading' && node.attrs?.level === 1) {
        title = node.content?.map(n => n.text || '').join('') || '';
      }
      nodes.push(node);
    }
    i++;
  }
  
  // Group list items
  const groupedNodes = groupListItems(nodes);
  
  return {
    title: title || 'Imported Page',
    content: {
      type: 'doc',
      content: groupedNodes
    },
    metadata: {
      slug: frontmatter.slug,
      icon: frontmatter.icon,
      author: frontmatter.author,
      created: frontmatter.created,
      updated: frontmatter.updated
    }
  };
}

/**
 * Import multiple Markdown files
 */
export function importMultipleMarkdown(files: Array<{ filename: string; content: string }>): ImportResult[] {
  return files.map(file => {
    const result = markdownToTipTap(file.content);
    // Use filename as title if no title found
    if (result.title === 'Imported Page') {
      result.title = file.filename.replace(/\.md$/, '').replace(/[-_]/g, ' ');
    }
    return result;
  });
}
