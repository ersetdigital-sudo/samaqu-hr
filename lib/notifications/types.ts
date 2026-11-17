export type NotificationItem = {
  category: string;
  title: string;
  detail: string;
  href: string;
  itemCount: number;
  enabled: boolean;
  sortOrder: number;
};

export type NotificationSettingsItem = NotificationItem & {
  label: string;
  description: string;
};
