import { Star, FileText, X } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface FavoritesSidebarProps {
  className?: string;
  collapsed?: boolean;
}

export function FavoritesSidebar({ className, collapsed = false }: FavoritesSidebarProps) {
  const { data: favorites, isLoading, refetch } = trpc.favorites.list.useQuery();
  
  const removeMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleRemove = (e: React.MouseEvent, pageId: number) => {
    e.preventDefault();
    e.stopPropagation();
    removeMutation.mutate({ pageId });
  };

  if (collapsed) {
    return (
      <div className={cn("py-2", className)}>
        <div className="flex items-center justify-center p-2 text-muted-foreground">
          <Star className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("py-2", className)}>
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground">
        <Star className="h-4 w-4" />
        <span>Избранное</span>
        {favorites && favorites.length > 0 && (
          <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
            {favorites.length}
          </span>
        )}
      </div>

      <ScrollArea className="max-h-[200px]">
        {isLoading ? (
          <div className="space-y-1 px-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : favorites && favorites.length > 0 ? (
          <div className="space-y-0.5 px-2">
            {favorites.map((fav) => (
              <Link key={fav.id} href={`/wiki/${fav.pageSlug}`}>
                <div className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm">
                  <span className="flex-shrink-0">
                    {fav.pageIcon || <FileText className="h-4 w-4 text-muted-foreground" />}
                  </span>
                  <span className="truncate flex-1">{fav.pageTitle}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleRemove(e, fav.pageId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Нет избранных страниц</p>
            <p className="text-xs mt-1">
              Нажмите ⭐ на странице, чтобы добавить
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default FavoritesSidebar;
