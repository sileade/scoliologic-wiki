import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, Settings, FileText, MessageSquare, AtSign, Share2, Shield, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

type NotificationType = 
  | "page_updated"
  | "page_commented"
  | "page_shared"
  | "mention"
  | "access_granted"
  | "access_requested"
  | "system";

interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string | null;
  pageId: number | null;
  actorId: number | null;
  isRead: boolean;
  readAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  actorName: string | null;
  actorAvatar: string | null;
}

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  page_updated: <FileText className="h-4 w-4 text-blue-500" />,
  page_commented: <MessageSquare className="h-4 w-4 text-green-500" />,
  page_shared: <Share2 className="h-4 w-4 text-purple-500" />,
  mention: <AtSign className="h-4 w-4 text-orange-500" />,
  access_granted: <Shield className="h-4 w-4 text-emerald-500" />,
  access_requested: <Shield className="h-4 w-4 text-yellow-500" />,
  system: <Info className="h-4 w-4 text-gray-500" />,
};

export function NotificationBell() {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const { data, refetch } = trpc.notifications.list.useQuery(
    { limit: 20, unreadOnly: false },
    { refetchInterval: 30000 } // Refetch every 30 seconds
  );
  
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => refetch(),
  });
  
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => refetch(),
  });
  
  const deleteMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate({ id: notification.id });
    }
    
    if (notification.pageId) {
      setLocation(`/wiki/${notification.pageId}`);
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    deleteMutation.mutate({ id });
  };

  const formatTime = (date: Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ru });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Уведомления</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Прочитать все
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Нет уведомлений</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${
                  !notification.isRead ? "bg-accent/50" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {notificationIcons[notification.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notification.isRead ? "font-medium" : ""}`}>
                    {notification.title}
                  </p>
                  {notification.message && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(notification.createdAt)}
                  </p>
                </div>
                <div className="flex-shrink-0 flex gap-1">
                  {!notification.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsReadMutation.mutate({ id: notification.id });
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => handleDelete(e, notification.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-sm text-muted-foreground"
          onClick={() => {
            setLocation("/settings/notifications");
            setIsOpen(false);
          }}
        >
          <Settings className="h-4 w-4 mr-2" />
          Настройки уведомлений
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
