import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { useState } from "react";
import { X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Video node view component
function VideoNodeView({ node, deleteNode, selected }: NodeViewProps) {
  const { src, type, title } = node.attrs as { src: string; type: string; title?: string };
  const [_isFullscreen, setIsFullscreen] = useState(false);

  // Extract RuTube video ID from URL
  const getRutubeEmbedUrl = (url: string) => {
    // Handle various RuTube URL formats
    // https://rutube.ru/video/VIDEOID/
    // https://rutube.ru/play/embed/VIDEOID
    const patterns = [
      /rutube\.ru\/video\/([a-zA-Z0-9]+)/,
      /rutube\.ru\/play\/embed\/([a-zA-Z0-9]+)/,
      /rutube\.ru\/shorts\/([a-zA-Z0-9]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return `https://rutube.ru/play/embed/${match[1]}`;
      }
    }
    return url;
  };

  const handleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  if (type === "rutube") {
    const embedUrl = getRutubeEmbedUrl(src);
    return (
      <NodeViewWrapper className={`video-wrapper my-4 ${selected ? 'ring-2 ring-primary rounded-lg' : ''}`}>
        <div className="relative group">
          <div className="aspect-video w-full max-w-3xl mx-auto bg-black rounded-lg overflow-hidden shadow-lg">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              frameBorder="0"
              allow="clipboard-write; autoplay"
              allowFullScreen
              title={title || "RuTube Video"}
            />
          </div>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white"
              onClick={handleFullscreen}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={deleteNode}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {title && (
            <p className="text-sm text-muted-foreground text-center mt-2">{title}</p>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  // S3/Direct video
  return (
    <NodeViewWrapper className={`video-wrapper my-4 ${selected ? 'ring-2 ring-primary rounded-lg' : ''}`}>
      <div className="relative group">
        <div className="aspect-video w-full max-w-3xl mx-auto bg-black rounded-lg overflow-hidden shadow-lg">
          <video
            src={src}
            controls
            className="w-full h-full"
            preload="metadata"
            title={title || "Video"}
          >
            <source src={src} type="video/mp4" />
            <source src={src} type="video/webm" />
            <source src={src} type="video/ogg" />
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            variant="destructive"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={deleteNode}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {title && (
          <p className="text-sm text-muted-foreground text-center mt-2">{title}</p>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// TipTap Video Extension
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      type: {
        default: "s3", // "s3" | "rutube"
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-video]',
      },
      {
        tag: 'video',
        getAttrs: (node: HTMLElement) => {
          const element = node as HTMLVideoElement;
          return {
            src: element.getAttribute('src'),
            type: 's3',
            title: element.getAttribute('title'),
          };
        },
      },
      {
        tag: 'iframe[src*="rutube"]',
        getAttrs: (node: HTMLElement) => {
          const element = node as HTMLIFrameElement;
          return {
            src: element.getAttribute('src'),
            type: 'rutube',
            title: element.getAttribute('title'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string> }) {
    const { src, type, title } = HTMLAttributes;
    
    if (type === "rutube") {
      return [
        "div",
        { "data-video": "", class: "video-embed rutube-embed" },
        [
          "iframe",
          mergeAttributes({
            src: src,
            frameborder: "0",
            allow: "clipboard-write; autoplay",
            allowfullscreen: "true",
            title: title || "RuTube Video",
            class: "w-full aspect-video rounded-lg",
          }),
        ],
      ];
    }

    return [
      "div",
      { "data-video": "", class: "video-embed s3-embed" },
      [
        "video",
        mergeAttributes({
          src: src,
          controls: "true",
          preload: "metadata",
          title: title || "Video",
          class: "w-full aspect-video rounded-lg",
        }),
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },
});

// Helper function to insert video into editor
export function insertVideo(
  editor: { chain: () => { focus: () => { insertContent: (content: object) => { run: () => void } } } },
  options: { src: string; type?: string; title?: string }
) {
  editor.chain().focus().insertContent({
    type: "video",
    attrs: {
      src: options.src,
      type: options.type || "s3",
      title: options.title,
    },
  }).run();
}

// Helper function to detect video type from URL
export function detectVideoType(url: string): "rutube" | "s3" {
  if (url.includes("rutube.ru")) {
    return "rutube";
  }
  return "s3";
}

// Helper to validate video URL
export function isValidVideoUrl(url: string): boolean {
  // Check for RuTube
  if (url.includes("rutube.ru")) {
    return /rutube\.ru\/(video|play\/embed|shorts)\/[a-zA-Z0-9]+/.test(url);
  }
  
  // Check for S3/direct video URLs
  const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi"];
  const hasVideoExtension = videoExtensions.some(ext => url.toLowerCase().includes(ext));
  
  // Also accept S3-like URLs without extension
  const isS3Url = url.includes("s3.") || url.includes("amazonaws.com") || url.includes("storage.");
  
  return hasVideoExtension || isS3Url || url.startsWith("http");
}

export default Video;
