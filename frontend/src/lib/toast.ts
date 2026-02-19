import { toast } from 'sonner';

interface ShowNotificationOptions {
  title: string;
  message: string;
  color?: string;
}

/**
 * Drop-in replacement for Mantine's notifications.show().
 * Maps Mantine color props to sonner toast variants.
 */
export function showNotification({ title, message, color }: ShowNotificationOptions) {
  if (color === 'red') {
    toast.error(title, { description: message });
  } else if (color === 'green') {
    toast.success(title, { description: message });
  } else if (color === 'orange' || color === 'yellow') {
    toast.warning(title, { description: message });
  } else {
    toast(title, { description: message });
  }
}
