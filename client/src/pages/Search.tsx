import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search as SearchIcon,
  FileText,
  Loader2,
  ArrowLeft,
  Sparkles,
  Clock,
  Tag,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SearchResult {
  pageId: number;
  pageTitle: string;
  pageSlug: string;
  snippet: string;
  score: number;
}

export default function Search() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<"text" | "ai">("text");
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  
  // Fetch all tags for filter
  const { data: allTags = [] } = trpc.tags.listWithCount.useQuery();
  
  // Fetch pages by tag
  const { data: tagPages = [], isLoading: loadingTagPages } = trpc.tags.getPages.useQuery(
    { tagId: selectedTagId! },
    { enabled: !!selectedTagId }
  );
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem("wiki-recent-searches");
    return saved ? JSON.parse(saved) : [];
  });
  
  const textSearch = trpc.pages.search.useQuery(
    { query, limit: 20 },
    { enabled: false }
  );
  
  const aiSearch = trpc.ai.search.useMutation();
  
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    
    // Save to recent searches
    const newRecent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem("wiki-recent-searches", JSON.stringify(newRecent));
    
    try {
      if (searchMode === "ai") {
        const result = await aiSearch.mutateAsync({ query });
        setResults(result);
      } else {
        const result = await textSearch.refetch();
        if (result.data) {
          setResults(result.data.map(page => ({
            pageId: page.id,
            pageTitle: page.title,
            pageSlug: page.slug,
            snippet: page.content?.substring(0, 200) || "",
            score: 1,
          })));
        }
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, [query, searchMode, recentSearches, aiSearch, textSearch]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };
  
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container max-w-4xl py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setLocation("/wiki")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search wiki pages..."
                  className="pl-10 pr-4"
                  autoFocus
                />
              </div>
              
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Button
                  variant={searchMode === "text" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setSearchMode("text")}
                >
                  <SearchIcon className="h-4 w-4 mr-1" />
                  Text
                </Button>
                <Button
                  variant={searchMode === "ai" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setSearchMode("ai")}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  AI
                </Button>
              </div>
              
              <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>
          </div>
          
          {searchMode === "ai" && (
            <p className="text-sm text-muted-foreground mt-2 ml-12">
              AI search uses semantic understanding to find relevant content
            </p>
          )}
        </div>
      </header>
      
      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="border-b bg-muted/30">
          <div className="container max-w-4xl py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground mr-2">Filter by tag:</span>
              {allTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTagId === tag.id ? "default" : "outline"}
                  className="cursor-pointer"
                  style={{
                    backgroundColor: selectedTagId === tag.id ? (tag.color || '#6B7280') : 'transparent',
                    borderColor: tag.color || '#6B7280',
                    color: selectedTagId === tag.id ? 'white' : (tag.color || '#6B7280'),
                  }}
                  onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)}
                >
                  {tag.name} ({tag.pageCount})
                </Badge>
              ))}
              {selectedTagId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => setSelectedTagId(null)}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Content */}
      <main className="container max-w-4xl py-6">
        {/* Tag filter results */}
        {selectedTagId && (
          <div className="space-y-4 mb-6">
            <div className="text-sm text-muted-foreground">
              {loadingTagPages ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading pages...
                </span>
              ) : (
                `Found ${tagPages.length} page${tagPages.length !== 1 ? 's' : ''} with this tag`
              )}
            </div>
            
            {!loadingTagPages && tagPages.length > 0 && (
              <div className="space-y-3">
                {tagPages.map((page) => (
                  <div
                    key={page.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/wiki/${page.slug}`)}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-lg">{page.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {page.content?.substring(0, 200) || 'No content'}...
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {!loadingTagPages && tagPages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No pages found with this tag
              </div>
            )}
          </div>
        )}
        
        {/* Search results */}
        {!selectedTagId && results.length > 0 ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Found {results.length} result{results.length !== 1 ? "s" : ""}
            </div>
            
            <div className="space-y-3">
              {results.map((result) => (
                <div
                  key={result.pageId}
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/wiki/${result.pageSlug}`)}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-lg">
                        {highlightMatch(result.pageTitle, query)}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {highlightMatch(result.snippet, query)}...
                      </p>
                      {searchMode === "ai" && result.score < 1 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Sparkles className="h-3 w-3" />
                          Relevance: {Math.round(result.score * 100)}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !selectedTagId && isSearching ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchMode === "ai" ? "Searching with AI..." : "Searching..."}
            </p>
          </div>
        ) : !selectedTagId && query && !isSearching ? (
          <div className="flex flex-col items-center justify-center py-16">
            <SearchIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No results found for "{query}"</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try different keywords or use AI search for semantic matching
            </p>
          </div>
        ) : !selectedTagId ? (
          <div className="space-y-8">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Searches
                </h2>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setQuery(search);
                        handleSearch();
                      }}
                    >
                      {search}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Search Tips */}
            <div className="bg-muted/50 rounded-lg p-6">
              <h2 className="font-medium mb-4">Search Tips</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <SearchIcon className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    <strong>Text Search:</strong> Finds exact matches in page titles and content
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    <strong>AI Search:</strong> Understands the meaning of your query and finds semantically related content
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Use specific keywords for better results
                  </span>
                </li>
              </ul>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
