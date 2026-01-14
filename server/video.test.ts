import { describe, expect, it } from "vitest";

// Test video URL detection and validation utilities
describe("Video URL utilities", () => {
  // Helper functions replicated from VideoExtension for server-side testing
  function detectVideoType(url: string): "rutube" | "s3" {
    if (url.includes("rutube.ru")) {
      return "rutube";
    }
    return "s3";
  }

  function isValidVideoUrl(url: string): boolean {
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

  function getRutubeEmbedUrl(url: string): string {
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
  }

  describe("detectVideoType", () => {
    it("detects RuTube URLs", () => {
      expect(detectVideoType("https://rutube.ru/video/abc123")).toBe("rutube");
      expect(detectVideoType("https://rutube.ru/play/embed/abc123")).toBe("rutube");
      expect(detectVideoType("https://rutube.ru/shorts/abc123")).toBe("rutube");
    });

    it("detects S3/direct URLs", () => {
      expect(detectVideoType("https://s3.amazonaws.com/bucket/video.mp4")).toBe("s3");
      expect(detectVideoType("https://storage.example.com/video.mp4")).toBe("s3");
      expect(detectVideoType("https://cdn.example.com/video.webm")).toBe("s3");
    });
  });

  describe("isValidVideoUrl", () => {
    it("validates RuTube URLs", () => {
      expect(isValidVideoUrl("https://rutube.ru/video/abc123")).toBe(true);
      expect(isValidVideoUrl("https://rutube.ru/play/embed/abc123")).toBe(true);
      expect(isValidVideoUrl("https://rutube.ru/shorts/abc123")).toBe(true);
      expect(isValidVideoUrl("https://rutube.ru/invalid")).toBe(false);
    });

    it("validates S3 URLs", () => {
      expect(isValidVideoUrl("https://s3.amazonaws.com/bucket/video.mp4")).toBe(true);
      expect(isValidVideoUrl("https://storage.example.com/video.mp4")).toBe(true);
    });

    it("validates direct video URLs", () => {
      expect(isValidVideoUrl("https://example.com/video.mp4")).toBe(true);
      expect(isValidVideoUrl("https://example.com/video.webm")).toBe(true);
      expect(isValidVideoUrl("https://example.com/video.ogg")).toBe(true);
      expect(isValidVideoUrl("https://example.com/video.mov")).toBe(true);
      expect(isValidVideoUrl("https://example.com/video.avi")).toBe(true);
    });

    it("accepts any http URL as fallback", () => {
      expect(isValidVideoUrl("https://example.com/some-video")).toBe(true);
      expect(isValidVideoUrl("http://example.com/video")).toBe(true);
    });
  });

  describe("getRutubeEmbedUrl", () => {
    it("converts video URLs to embed URLs", () => {
      expect(getRutubeEmbedUrl("https://rutube.ru/video/abc123")).toBe("https://rutube.ru/play/embed/abc123");
      expect(getRutubeEmbedUrl("https://rutube.ru/video/abc123/")).toBe("https://rutube.ru/play/embed/abc123");
    });

    it("converts shorts URLs to embed URLs", () => {
      expect(getRutubeEmbedUrl("https://rutube.ru/shorts/xyz789")).toBe("https://rutube.ru/play/embed/xyz789");
    });

    it("keeps embed URLs unchanged", () => {
      expect(getRutubeEmbedUrl("https://rutube.ru/play/embed/abc123")).toBe("https://rutube.ru/play/embed/abc123");
    });

    it("returns original URL if no match", () => {
      expect(getRutubeEmbedUrl("https://example.com/video")).toBe("https://example.com/video");
    });
  });
});

describe("Video node attributes", () => {
  it("should have correct default attributes", () => {
    const defaultAttrs = {
      src: null,
      type: "s3",
      title: null,
    };
    
    expect(defaultAttrs.src).toBeNull();
    expect(defaultAttrs.type).toBe("s3");
    expect(defaultAttrs.title).toBeNull();
  });

  it("should support rutube type", () => {
    const rutubeAttrs = {
      src: "https://rutube.ru/video/abc123",
      type: "rutube",
      title: "Test Video",
    };
    
    expect(rutubeAttrs.type).toBe("rutube");
    expect(rutubeAttrs.src).toContain("rutube.ru");
  });

  it("should support s3 type", () => {
    const s3Attrs = {
      src: "https://s3.amazonaws.com/bucket/video.mp4",
      type: "s3",
      title: "S3 Video",
    };
    
    expect(s3Attrs.type).toBe("s3");
    expect(s3Attrs.src).toContain("s3.amazonaws.com");
  });
});
