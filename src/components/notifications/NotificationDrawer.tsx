// src/components/notifications/NotificationDrawer.tsx
// Slide-over notification drawer with unread counter and mark-read action

import React, { useEffect, useState } from 'react';
import { X, Bell, CheckCircle2 } from 'lucide-react';
import { NotificationItem } from '../../types/contracts';
import { notificationService } from '../../api/notificationService';
import { LoadingSpinner, EmptyState } from '../layout/LoadingEmptyError';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await notificationService.getNotifications();
      setNotifications(res.content || []);
      const unreadCount = res.content ? res.content.filter((n) => n.status === 'UNREAD').length : 0;
      if (onUnreadCountChange) onUnreadCountChange(unreadCount);
    } catch (e) {
      console.warn('[NotificationDrawer] Failed to fetch notifications:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    setMarkingId(id);
    try {
      await notificationService.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'READ' as const } : n))
      );
      const remainingUnread = notifications.filter((n) => n.id !== id && n.status === 'UNREAD').length;
      if (onUnreadCountChange) onUnreadCountChange(remainingUnread);
    } catch (e) {
      console.error('[NotificationDrawer] Mark as read failed:', e);
    } finally {
      setMarkingId(null);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => n.status === 'UNREAD').length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="notification-drawer-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-gray-900 bg-opacity-40 transition-opacity" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-sm bg-white shadow-xl flex flex-col">
          {/* Header */}
          <div className="px-4 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-600" />
              <h2 id="notification-drawer-title" className="text-sm font-bold text-gray-900">
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              data-testid="close-notifications-btn"
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <LoadingSpinner label="Fetching notifications..." size="sm" />
            ) : notifications.length === 0 ? (
              <EmptyState title="No notifications" description="You have no notifications in your inbox right now." />
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  data-testid={`notification-item-${item.id}`}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    item.status === 'UNREAD'
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-gray-900">{item.title}</h4>
                    {item.status === 'UNREAD' ? (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(item.id)}
                        disabled={markingId === item.id}
                        data-testid={`mark-read-btn-${item.id}`}
                        className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Mark read</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-medium">Read</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.body}</p>
                  <span className="block text-[10px] text-gray-400 mt-2">
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDrawer;
