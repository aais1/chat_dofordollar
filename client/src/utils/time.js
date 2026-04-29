import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

export const formatMessageTime = (date) => {
  if (!date) return '';
  return format(new Date(date), 'HH:mm');
};

export const formatChatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd/MM/yyyy');
};

export const formatDateSeparator = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMMM d, yyyy');
};

export const formatLastSeen = (date) => {
  if (!date) return 'Last seen recently';
  return `Last seen ${formatDistanceToNow(new Date(date), { addSuffix: true })}`;
};

export const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.toDateString() === d2.toDateString();
};
