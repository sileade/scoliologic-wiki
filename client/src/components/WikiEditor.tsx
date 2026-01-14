import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { common, createLowlight } from "lowlight";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Code, Quote, Image as ImageIcon, Link as LinkIcon, Table as TableIcon,
  AlignLeft, AlignCenter, AlignRight, Highlighter, Undo, Redo,
  Type, Sparkles, Loader2, Video as VideoIcon, Upload
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Video, insertVideo, detectVideoType, isValidVideoUrl } from "./VideoExtension";

const lowlight = createLowlight(common);

interface WikiEditorProps {
  content?: string;
  contentJson?: object;
  onChange?: (content: string, json: object) => void;
  editable?: boolean;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<string>;
  onVideoUpload?: (file: File) => Promise<string>;
}

export function WikiEditor({
  content,
  contentJson,
  onChange,
  editable = true,
  placeholder = "Start writing... Use the toolbar above for formatting",
  onImageUpload,
  onVideoUpload,
}: WikiEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUploading, setVideoUploading] = useState(false);
  
  const aiAssist = trpc.ai.assist.useMutation();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      TextStyle,
      Color,
      Video,
    ],
    content: contentJson || content || "",
    editable,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML(), editor.getJSON());
      }
    },
  });

  useEffect(() => {
    if (editor && contentJson) {
      editor.commands.setContent(contentJson);
    } else if (editor && content) {
      editor.commands.setContent(content);
    }
  }, [editor, content, contentJson]);

  const handleImageUpload = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && onImageUpload) {
        const url = await onImageUpload(file);
        editor?.chain().focus().setImage({ src: url }).run();
      }
    };
    input.click();
  }, [editor, onImageUpload]);

  const handleVideoUpload = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && onVideoUpload && editor) {
        setVideoUploading(true);
        try {
          const url = await onVideoUpload(file);
          insertVideo(editor, { src: url, type: "s3", title: file.name });
        } catch (error) {
          console.error("Video upload error:", error);
        } finally {
          setVideoUploading(false);
        }
      }
    };
    input.click();
  }, [editor, onVideoUpload]);

  const handleInsertVideoUrl = useCallback(() => {
    if (!editor || !videoUrl) return;
    
    if (!isValidVideoUrl(videoUrl)) {
      alert("Please enter a valid video URL (RuTube or direct video link)");
      return;
    }
    
    const type = detectVideoType(videoUrl);
    insertVideo(editor, { src: videoUrl, type, title: videoTitle || undefined });
    
    setShowVideoDialog(false);
    setVideoUrl("");
    setVideoTitle("");
  }, [editor, videoUrl, videoTitle]);

  const setLink = useCallback(() => {
    if (linkUrl) {
      editor?.chain().focus().setLink({ href: linkUrl }).run();
    } else {
      editor?.chain().focus().unsetLink().run();
    }
    setShowLinkPopover(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const handleAiAction = async (action: "improve" | "expand" | "summarize" | "grammar") => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    
    if (!selectedText) return;
    
    setAiLoading(true);
    try {
      const result = await aiAssist.mutateAsync({
        action,
        text: selectedText,
      });
      
      if (result.result) {
        editor.chain().focus().deleteSelection().insertContent(result.result).run();
      }
    } catch (error) {
      console.error("AI assist error:", error);
    } finally {
      setAiLoading(false);
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="wiki-editor border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      {editable && (
        <div className="border-b bg-muted/30 p-2 flex items-center gap-1 flex-wrap sticky top-0 z-10">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Type className="h-4 w-4 mr-1" />
                Text
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
                <Type className="h-4 w-4 mr-2" />
                Paragraph
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                <Heading1 className="h-4 w-4 mr-2" />
                Heading 1
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                <Heading2 className="h-4 w-4 mr-2" />
                Heading 2
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                <Heading3 className="h-4 w-4 mr-2" />
                Heading 3
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-muted")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-muted")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("underline") && "bg-muted")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("strike") && "bg-muted")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("highlight") && "bg-muted")}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            title="Highlight"
          >
            <Highlighter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("code") && "bg-muted")}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline Code"
          >
            <Code className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "bg-muted")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("orderedList") && "bg-muted")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("taskList") && "bg-muted")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            title="Task List"
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "left" }) && "bg-muted")}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "center" }) && "bg-muted")}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "right" }) && "bg-muted")}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("codeBlock") && "bg-muted")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code Block"
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("blockquote") && "bg-muted")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </Button>
          
          <Popover open={showLinkPopover} onOpenChange={setShowLinkPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 w-8 p-0", editor.isActive("link") && "bg-muted")}
                title="Link"
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter URL..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setLink()}
                />
                <Button size="sm" onClick={setLink}>
                  Add
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleImageUpload}
            title="Insert Image"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          
          {/* Video Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Insert Video"
                disabled={videoUploading}
              >
                {videoUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <VideoIcon className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowVideoDialog(true)}>
                <LinkIcon className="h-4 w-4 mr-2" />
                Insert from URL (YouTube / RuTube / VK / S3)
              </DropdownMenuItem>
              {onVideoUpload && (
                <DropdownMenuItem onClick={handleVideoUpload}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Video to S3
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="Insert Table"
          >
            <TableIcon className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          {/* AI Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2" disabled={aiLoading}>
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    AI
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleAiAction("improve")}>
                <Sparkles className="h-4 w-4 mr-2" />
                Improve Writing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAiAction("expand")}>
                <Sparkles className="h-4 w-4 mr-2" />
                Expand Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAiAction("summarize")}>
                <Sparkles className="h-4 w-4 mr-2" />
                Summarize
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAiAction("grammar")}>
                <Sparkles className="h-4 w-4 mr-2" />
                Fix Grammar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Video Insert Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Insert Video</DialogTitle>
            <DialogDescription>
              Add a video from RuTube or a direct URL (S3, CDN, etc.)
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="url" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="url">Video URL</TabsTrigger>
              <TabsTrigger value="youtube">YouTube</TabsTrigger>
              <TabsTrigger value="rutube">RuTube</TabsTrigger>
              <TabsTrigger value="vk">VK Video</TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-url">Video URL</Label>
                <Input
                  id="video-url"
                  placeholder="https://storage.example.com/video.mp4"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Supports MP4, WebM, OGG formats from S3 or any direct URL
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-title">Title (optional)</Label>
                <Input
                  id="video-title"
                  placeholder="Video description"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                />
              </div>
            </TabsContent>
            <TabsContent value="youtube" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="youtube-url">YouTube Video URL</Label>
                <Input
                  id="youtube-url"
                  placeholder="https://youtube.com/watch?v=dQw4w9WgXcQ"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste the YouTube video URL. Supported formats:
                  <br />• youtube.com/watch?v=VIDEO_ID
                  <br />• youtu.be/VIDEO_ID
                  <br />• youtube.com/shorts/VIDEO_ID
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="youtube-title">Title (optional)</Label>
                <Input
                  id="youtube-title"
                  placeholder="Video description"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                />
              </div>
            </TabsContent>
            <TabsContent value="rutube" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rutube-url">RuTube Video URL</Label>
                <Input
                  id="rutube-url"
                  placeholder="https://rutube.ru/video/abc123..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste the RuTube video page URL. Supported formats:
                  <br />• rutube.ru/video/VIDEO_ID
                  <br />• rutube.ru/shorts/VIDEO_ID
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rutube-title">Title (optional)</Label>
                <Input
                  id="rutube-title"
                  placeholder="Video description"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                />
              </div>
            </TabsContent>
            <TabsContent value="vk" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vk-url">VK Video URL</Label>
                <Input
                  id="vk-url"
                  placeholder="https://vk.com/video-123456_789012"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste the VK video URL. Supported formats:
                  <br />• vk.com/video-OWNER_ID_VIDEO_ID
                  <br />• vk.com/clip-OWNER_ID_VIDEO_ID
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vk-title">Title (optional)</Label>
                <Input
                  id="vk-title"
                  placeholder="Video description"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVideoDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsertVideoUrl} disabled={!videoUrl}>
              Insert Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className={cn(
          "prose prose-sm sm:prose lg:prose-lg max-w-none p-6",
          "prose-headings:font-semibold prose-headings:text-foreground",
          "prose-p:text-foreground prose-p:leading-relaxed",
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
          "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono",
          "prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg",
          "prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:rounded-r-lg",
          "prose-img:rounded-lg prose-img:shadow-md",
          "prose-table:border prose-table:rounded-lg prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-td:border",
          "prose-ul:list-disc prose-ol:list-decimal",
          "[&_.is-editor-empty:first-child::before]:text-muted-foreground",
          "[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_.is-editor-empty:first-child::before]:float-left",
          "[&_.is-editor-empty:first-child::before]:h-0",
          "[&_.is-editor-empty:first-child::before]:pointer-events-none",
          "[&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:pl-0",
          "[&_ul[data-type='taskList']_li]:flex [&_ul[data-type='taskList']_li]:items-start [&_ul[data-type='taskList']_li]:gap-2",
          "[&_ul[data-type='taskList']_li_label]:mt-0.5",
          "[&_.video-wrapper]:my-4",
          "min-h-[400px]",
          !editable && "cursor-default"
        )}
      />
    </div>
  );
}

export default WikiEditor;
