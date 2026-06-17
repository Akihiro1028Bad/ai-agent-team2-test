import React from 'react';
import { Notification } from '../types/notification';
import { formatDateTime } from '../utils/formatDate';

interface NotificationListProps {
  notifications: Notification[];
}

export const NotificationList: React.FC<NotificationListProps> = ({ notifications }) => {
  if (notifications.length === 0) {
    return <p>通知はありません</p>;
  }

  return (
    <ul>
      {notifications.map((notification) => (
        <li key={notification.id}>
          <strong>{notification.title}</strong>
          <p>{notification.body}</p>
          <span>{formatDateTime(notification.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
};
