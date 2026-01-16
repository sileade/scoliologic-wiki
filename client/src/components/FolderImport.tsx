import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  FolderUp,
  FileText,
  Folder,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "folder";
  content?: string;
  mimeType?: string;
  size?: number;
  children?: FileEntry[];
  selected?: boolean;
  processing?: boolean;
  processed?: boolean;
  error?: string;
  suggestedTitle?: string;
  suggestedTags?: string[];
}

interface FolderImportProps {
  parentPageId?: number;
  onImportComplete?: (pageIds: number[]) => void;
  className?: string;
}

export function FolderImport({
  parentPageId,
  onImportComplete,
  className,
}: FolderImportProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createPage = trpc.pages.create.useMutation();
  const analyzeFile = trpc.ai.analyzeFileContent.useMutation();
  const utils = trpc.useUtils();

  // Read file content as text
  const readFileContent = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      
      // Check if it's a text-based file
      const textTypes = [
        "text/", "application/json", "application/xml",
        "application/javascript", "application/typescript",
      ];
      const isText = textTypes.some(t => file.type.startsWith(t)) ||
        /\.(md|txt|json|xml|html|css|js|ts|tsx|jsx|py|rb|go|rs|java|c|cpp|h|hpp|yaml|yml|toml|ini|cfg|conf|sh|bash|zsh|ps1|bat|cmd)$/i.test(file.name);
      
      if (isText || file.type === "" && file.size < 1024 * 1024) {
        reader.readAsText(file);
      } else {
        resolve(`[Binary file: ${file.name}, size: ${file.size} bytes]`);
      }
    });
  }, []);

  // Process dropped items recursively
  const processEntry = useCallback(async (
    entry: FileSystemEntry,
    path: string = ""
  ): Promise<FileEntry | null> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      return new Promise((resolve) => {
        fileEntry.file(async (file) => {
          const content = await readFileContent(file);
          resolve({
            name: file.name,
            path: path + file.name,
            type: "file",
            content,
            mimeType: file.type || "text/plain",
            size: file.size,
            selected: true,
          });
        }, () => resolve(null));
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      
      return new Promise((resolve) => {
        const readEntries = (entries: FileEntry[]) => {
          reader.readEntries(async (results) => {
            if (results.length === 0) {
              resolve({
                name: entry.name,
                path: path + entry.name + "/",
                type: "folder",
                children: entries,
                selected: true,
              });
            } else {
              const newEntries: FileEntry[] = [];
              for (const result of results) {
                const processed = await processEntry(result, path + entry.name + "/");
                if (processed) {
                  newEntries.push(processed);
                }
              }
              readEntries([...entries, ...newEntries]);
            }
          }, () => resolve(null));
        };
        readEntries([]);
      });
    }
    return null;
  }, [readFileContent]);

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    setIsAnalyzing(true);
    const entries: FileEntry[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry();
      if (entry) {
        const processed = await processEntry(entry);
        if (processed) {
          entries.push(processed);
        }
      }
    }

    setFiles(entries);
    setShowDialog(true);
    setIsAnalyzing(false);
  }, [processEntry]);

  // Handle file input change
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsAnalyzing(true);
    const entries: FileEntry[] = [];

    // Group files by directory
    const filesByPath: Record<string, File[]> = {};
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const pathParts = file.webkitRelativePath.split("/");
      const dirPath = pathParts.slice(0, -1).join("/");
      if (!filesByPath[dirPath]) {
        filesByPath[dirPath] = [];
      }
      filesByPath[dirPath].push(file);
    }

    // Build tree structure
    for (const [path, files] of Object.entries(filesByPath)) {
      for (const file of files) {
        const content = await readFileContent(file);
        entries.push({
          name: file.name,
          path: file.webkitRelativePath,
          type: "file",
          content,
          mimeType: file.type || "text/plain",
          size: file.size,
          selected: true,
        });
      }
    }

    setFiles(entries);
    setShowDialog(true);
    setIsAnalyzing(false);
  }, [readFileContent]);

  // Toggle file selection
  const toggleSelection = useCallback((path: string) => {
    setFiles(prev => {
      const updateEntry = (entries: FileEntry[]): FileEntry[] => {
        return entries.map(entry => {
          if (entry.path === path) {
            return { ...entry, selected: !entry.selected };
          }
          if (entry.children) {
            return { ...entry, children: updateEntry(entry.children) };
          }
          return entry;
        });
      };
      return updateEntry(prev);
    });
  }, []);

  // Toggle folder expansion
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Analyze files with AI (parallel processing with concurrency limit)
  const analyzeWithAI = useCallback(async () => {
    setIsAnalyzing(true);
    setProgress(0);
    
    // Collect all files to analyze
    const filesToAnalyze: { entry: FileEntry; path: string[] }[] = [];
    
    const collectFiles = (entries: FileEntry[], path: string[] = []) => {
      for (const entry of entries) {
        if (entry.type === "file" && entry.content && entry.selected) {
          filesToAnalyze.push({ entry, path });
        }
        if (entry.children) {
          collectFiles(entry.children, [...path, entry.path]);
        }
      }
    };
    collectFiles(files);
    
    const totalFiles = filesToAnalyze.length;
    let processedCount = 0;
    
    // Process files in parallel with concurrency limit of 5
    const CONCURRENCY_LIMIT = 5;
    const analyzedMap = new Map<string, FileEntry>();
    
    const analyzeOne = async (item: { entry: FileEntry; path: string[] }): Promise<void> => {
      try {
        const result = await analyzeFile.mutateAsync({
          content: item.entry.content!,
          filename: item.entry.name,
          mimeType: item.entry.mimeType || "text/plain",
        });
        analyzedMap.set(item.entry.path, {
          ...item.entry,
          suggestedTitle: result.title,
          suggestedTags: result.suggestedTags,
          content: result.markdownContent,
        });
      } catch {
        analyzedMap.set(item.entry.path, item.entry);
      }
      processedCount++;
      setProgress((processedCount / totalFiles) * 100);
    };
    
    // Process in batches with concurrency limit
    for (let i = 0; i < filesToAnalyze.length; i += CONCURRENCY_LIMIT) {
      const batch = filesToAnalyze.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map(analyzeOne));
    }
    
    // Rebuild file tree with analyzed results
    const updateEntries = (entries: FileEntry[]): FileEntry[] => {
      return entries.map(entry => {
        if (entry.type === "file" && analyzedMap.has(entry.path)) {
          return analyzedMap.get(entry.path)!;
        }
        if (entry.children) {
          return { ...entry, children: updateEntries(entry.children) };
        }
        return entry;
      });
    };
    
    setFiles(updateEntries(files));
    setIsAnalyzing(false);
    setProgress(0);
    toast.success(t("folderImport.analysisComplete", "AI analysis complete"));
  }, [files, analyzeFile, t]);

  // Import files as pages
  const importFiles = useCallback(async () => {
    setIsImporting(true);
    setProgress(0);

    const createdPageIds: number[] = [];
    let processedCount = 0;

    // Count total selected files
    const countSelected = (entries: FileEntry[]): number => {
      return entries.reduce((count, entry) => {
        if (entry.type === "file" && entry.selected) {
          return count + 1;
        }
        if (entry.children) {
          return count + countSelected(entry.children);
        }
        return count;
      }, 0);
    };

    const totalFiles = countSelected(files);

    // Import entries recursively
    const importEntry = async (
      entry: FileEntry,
      parentId?: number
    ): Promise<void> => {
      if (entry.type === "folder" && entry.children) {
        // Create folder as a page
        if (entry.selected) {
          try {
            const page = await createPage.mutateAsync({
              title: entry.name,
              content: "",
              contentJson: { type: "doc", content: [] },
              parentId,
              isPublic: false,
            });
            
            // Import children under this folder
            for (const child of entry.children) {
              await importEntry(child, page.id);
            }
          } catch (error) {
            console.error("Failed to create folder page:", error);
          }
        }
      } else if (entry.type === "file" && entry.selected) {
        try {
          const title = entry.suggestedTitle || entry.name.replace(/\.[^/.]+$/, "");
          const content = entry.content || "";
          
          // Convert markdown to TipTap JSON
          const contentJson = {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: content }],
              },
            ],
          };

          const page = await createPage.mutateAsync({
            title,
            content,
            contentJson,
            parentId: parentId || parentPageId,
            isPublic: false,
          });

          createdPageIds.push(page.id);
          processedCount++;
          setProgress((processedCount / totalFiles) * 100);
        } catch (error) {
          console.error("Failed to create page:", error);
        }
      }
    };

    for (const entry of files) {
      await importEntry(entry, parentPageId);
    }

    setIsImporting(false);
    setShowDialog(false);
    setFiles([]);
    utils.pages.getRootPages.invalidate();
    
    toast.success(
      t("folderImport.importComplete", "Imported {{count}} pages", { count: createdPageIds.length })
    );
    
    onImportComplete?.(createdPageIds);
  }, [files, parentPageId, createPage, utils, t, onImportComplete]);

  // Render file tree
  const renderFileTree = (entries: FileEntry[], level: number = 0) => {
    return entries.map((entry) => {
      const isExpanded = expandedFolders.has(entry.path);
      
      return (
        <div key={entry.path}>
          <div
            className={cn(
              "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer",
              entry.processing && "opacity-50"
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
          >
            <Checkbox
              checked={entry.selected}
              onCheckedChange={() => toggleSelection(entry.path)}
              disabled={entry.processing}
            />
            
            {entry.type === "folder" ? (
              <button
                onClick={() => toggleFolder(entry.path)}
                className="flex items-center gap-1"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Folder className="h-4 w-4 text-yellow-500" />
              </button>
            ) : (
              <FileText className="h-4 w-4 text-blue-500 ml-5" />
            )}
            
            <span className="flex-1 truncate text-sm">
              {entry.suggestedTitle || entry.name}
            </span>
            
            {entry.suggestedTags && entry.suggestedTags.length > 0 && (
              <div className="flex gap-1">
                {entry.suggestedTags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            
            {entry.processed && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            {entry.error && (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          
          {entry.type === "folder" && entry.children && isExpanded && (
            <div>{renderFileTree(entry.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      {/* Drop zone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          className
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          // @ts-expect-error webkitdirectory is not in types
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileInputChange}
        />
        
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <FolderUp className={cn(
            "h-10 w-10",
            isDragging ? "text-primary" : "text-muted-foreground"
          )} />
          <div className="text-sm">
            <span className="font-medium">
              {t("folderImport.dropHere", "Drop folder here")}
            </span>
            <span className="text-muted-foreground">
              {" "}{t("folderImport.or", "or")}{" "}
            </span>
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("folderImport.browse", "browse")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("folderImport.description", "AI will analyze files and create wiki pages")}
          </p>
        </div>
        
        {isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>

      {/* Import dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderUp className="h-5 w-5" />
              {t("folderImport.title", "Import Folder")}
            </DialogTitle>
            <DialogDescription>
              {t("folderImport.dialogDescription", "Select files to import as wiki pages. AI can analyze and format content.")}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] border rounded-md">
            <div className="p-2">
              {renderFileTree(files)}
            </div>
          </ScrollArea>
          
          {isImporting && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                {t("folderImport.importing", "Importing...")} {Math.round(progress)}%
              </p>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={analyzeWithAI}
              disabled={isAnalyzing || isImporting}
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {t("folderImport.analyzeAI", "Analyze with AI")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isImporting}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={importFiles}
              disabled={isImporting || files.length === 0}
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {t("folderImport.import", "Import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default FolderImport;
