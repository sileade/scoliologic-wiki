import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  pageId: number;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "ghost" | "outline" | "default";
  showLabel?: boolean;
}

export function FavoriteButton({
  pageId,
  className,
  size = "icon",
  variant = "ghost",
  showLabel = false,
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if page is favorited
  const { data: favoriteStatus, refetch } = trpc.favorites.isFavorited.useQuery(
    { pageId },
    { enabled: !!pageId }
  );

  useEffect(() => {
    if (favoriteStatus) {
      setIsFavorited(favoriteStatus.isFavorited);
    }
  }, [favoriteStatus]);

  // Mutations
  const addMutation = trpc.favorites.add.useMutation({
    onSuccess: () => {
      setIsFavorited(true);
      setIsLoading(false);
      refetch();
    },
    onError: () => {
      setIsLoading(false);
    },
  });

  const removeMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => {
      setIsFavorited(false);
      setIsLoading(false);
      refetch();
    },
    onError: () => {
      setIsLoading(false);
    },
  });

  const handleToggle = () => {
    if (isLoading) return;
    setIsLoading(true);

    if (isFavorited) {
      removeMutation.mutate({ pageId });
    } else {
      addMutation.mutate({ pageId });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        "transition-colors",
        isFavorited && "text-yellow-500 hover:text-yellow-600",
        className
      )}
      title={isFavorited ? "Удалить из избранного" : "Добавить в избранное"}
    >
      <Star
        className={cn(
          "h-4 w-4",
          isFavorited && "fill-current"
        )}
      />
      {showLabel && (
        <span className="ml-2">
          {isFavorited ? "В избранном" : "В избранное"}
        </span>
      )}
    </Button>
  );
}

export default FavoriteButton;
