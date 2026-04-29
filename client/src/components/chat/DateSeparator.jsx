import { formatDateSeparator } from '../../utils/time.js';

export default function DateSeparator({ date }) {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur text-xs text-gray-500 dark:text-gray-400 px-3 py-1 rounded-full shadow-sm">
        {formatDateSeparator(date)}
      </div>
    </div>
  );
}
