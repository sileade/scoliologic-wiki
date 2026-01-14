import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { X, Plus, Tag, Check, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface TagInputProps {
  pageId: number;
  editable?: boolean;
}

export function TagInput({ pageId, editable = true }: TagInputProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Get tags for this page
  const { data: pageTags = [], isLoading: loadingPageTags } = trpc.tags.getForPage.useQuery(
    { pageId },
    { enabled: !!pageId }
  );

  // Search/list all tags
  const { data: allTags = [] } = trpc.tags.list.useQuery();

  // Filter tags based on search
  const filteredTags = allTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !pageTags.some((pt) => pt.id === tag.id)
  );

  // Mutations
  const addTagMutation = trpc.tags.addToPage.useMutation({
    onSuccess: () => {
      utils.tags.getForPage.invalidate({ pageId });
    },
  });

  const removeTagMutation = trpc.tags.removeFromPage.useMutation({
    onSuccess: () => {
      utils.tags.getForPage.invalidate({ pageId });
    },
  });

  const createTagMutation = trpc.tags.create.useMutation({
    onSuccess: async (data) => {
      await addTagMutation.mutateAsync({ pageId, tagId: data.id });
      setNewTagName("");
      utils.tags.list.invalidate();
    },
  });

  const handleAddTag = (tagId: number) => {
    addTagMutation.mutate({ pageId, tagId });
    setSearchQuery("");
  };

  const handleRemoveTag = (tagId: number) => {
    removeTagMutation.mutate({ pageId, tagId });
  };

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      createTagMutation.mutate({ name: newTagName.trim() });
    }
  };

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  if (loadingPageTags) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">Loading tags...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Display existing tags */}
      {pageTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="flex items-center gap-1 text-xs"
          style={{ backgroundColor: (tag.color || '#6B7280') + "20", borderColor: tag.color || '#6B7280' }}
        >
          <span style={{ color: tag.color || '#6B7280' }}>{tag.name}</span>
          {editable && (
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-0.5 hover:text-destructive"
              disabled={removeTagMutation.isPending}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}

      {/* Add tag button */}
      {editable && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-2">
              <Input
                ref={inputRef}
                placeholder="Search or create tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm"
              />

              {/* Existing tags list */}
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                    disabled={addTagMutation.isPending}
                  >
                    <Tag className="h-3 w-3" style={{ color: tag.color || '#6B7280' }} />
                    <span>{tag.name}</span>
                    {addTagMutation.isPending && (
                      <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                    )}
                  </button>
                ))}

                {filteredTags.length === 0 && searchQuery && (
                  <div className="text-sm text-muted-foreground px-2 py-1">
                    No tags found
                  </div>
                )}
              </div>

              {/* Create new tag */}
              {searchQuery && !allTags.some(
                (t) => t.name.toLowerCase() === searchQuery.toLowerCase()
              ) && (
                <div className="border-t pt-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="New tag name"
                      value={newTagName || searchQuery}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={handleCreateTag}
                      disabled={createTagMutation.isPending}
                    >
                      {createTagMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Empty state */}
      {pageTags.length === 0 && !editable && (
        <span className="text-xs text-muted-foreground">No tags</span>
      )}
    </div>
  );
}

export default TagInput;
