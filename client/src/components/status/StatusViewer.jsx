import { useState, useEffect, useRef } from 'react';
import { X, Eye, Trash2, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import toast from 'react-hot-toast';

export function SegmentedCircle({ count, viewedCount, size = 56, strokeWidth = 2 }) {
  if (count <= 1) {
    const isViewed = viewedCount === count;
    return (
      <div className={`rounded-full p-[2px] ${isViewed ? 'bg-gray-300 dark:bg-gray-600' : 'bg-green-500'}`} style={{ width: size, height: size }}>
        <div className="w-full h-full rounded-full bg-white dark:bg-gray-900" />
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = 4; // pixels
  const segmentLength = (circumference - (count * gap)) / count;
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      {Array.from({ length: count }).map((_, i) => {
        const isViewed = i < viewedCount;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={isViewed ? 'currentColor' : '#22c55e'} // gray-300/600 or green-500
            className={isViewed ? 'text-gray-300 dark:text-gray-600' : ''}
            strokeWidth={strokeWidth}
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            strokeDashoffset={-i * (segmentLength + gap)}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export function StatusCircle({ statuses, onOpen }) {
  if (!statuses || statuses.length === 0) return null;
  const firstStatus = statuses[0];
  const count = statuses.length;
  const viewedCount = statuses.filter(s => s.isViewed).length;

  return (
    <button onClick={() => onOpen(statuses, 0)}
      className="flex flex-col items-center gap-1 min-w-[64px] focus:outline-none group">
      <div className="relative">
        <SegmentedCircle count={count} viewedCount={viewedCount} size={58} />
        <div className="absolute inset-0 m-auto w-[48px] h-[48px] rounded-full overflow-hidden bg-white dark:bg-gray-800 p-[1px]">
          {firstStatus.userProfilePicture
            ? <img src={firstStatus.userProfilePicture} className="w-full h-full rounded-full object-cover" alt="" />
            : <div className="w-full h-full rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                {firstStatus.userName?.[0]?.toUpperCase()}
              </div>
          }
        </div>
      </div>
      <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium truncate max-w-[64px] group-hover:text-green-500 transition-colors">
        {count > 1 ? 'My Status' : firstStatus.userName?.split(' ')[0]}
      </span>
    </button>
  );
}

export function StatusViewer({ statuses, startIndex = 0, onClose }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState([]);
  const [showViewers, setShowViewers] = useState(false);
  const timerRef = useRef();
  const progressRef = useRef();
  const DURATION = 5000;

  const status = statuses[current];

  const fetchViewers = async (statusId) => {
    try {
      const { data } = await api.get(`/statuses/${statusId}/views`);
      setViewers(data.views);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!status) return;
    api.post(`/statuses/${status.id}/view`).catch(() => {});

    if (user.role === 'admin') {
      fetchViewers(status.id);
    }

    if (!showViewers) {
      setProgress(0);
      let start = Date.now();
      progressRef.current = setInterval(() => {
        const elapsed = Date.now() - start;
        setProgress(Math.min((elapsed / DURATION) * 100, 100));
      }, 50);

      timerRef.current = setTimeout(() => {
        if (current < statuses.length - 1) setCurrent(c => c + 1);
        else onClose();
      }, DURATION);
    }

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(progressRef.current);
    };
  }, [current, status?.id, showViewers]);

  if (!status) return null;

  const handleDelete = async () => {
    if (!confirm('Delete this status?')) return;
    try {
      await api.delete(`/statuses/${status.id}`);
      toast.success('Status deleted');
      onClose(); // In a real app we might just remove it from the list and go to next
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const goNext = () => {
    if (current < statuses.length - 1) setCurrent(c => c + 1);
    else onClose();
  };
  const goPrev = () => {
    if (current > 0) setCurrent(c => c - 1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: 'none' }}>
      {/* Progress bars */}
      <div className="flex gap-1 px-4 pt-4 pb-2">
        {statuses.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-none"
              style={{ width: i < current ? '100%' : i === current ? `${progress}%` : '0%' }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/50">
          {status.userProfilePicture
            ? <img src={status.userProfilePicture} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full flex items-center justify-center font-bold text-white" style={{ backgroundColor: 'var(--primary)' }}>
                {status.userName?.[0]?.toUpperCase()}
              </div>
          }
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{status.userName}</p>
          <p className="text-white/60 text-xs">{new Date(status.createdAt).toLocaleTimeString()}</p>
        </div>
        {user.role === 'admin' && (
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => setShowViewers(true)} className="flex items-center gap-1 text-white/90 hover:text-white text-sm font-bold bg-white/20 px-2 py-1 rounded-lg backdrop-blur-md transition">
              <Eye size={16} /> {status.viewCount}
            </button>
            <button onClick={handleDelete} className="text-white/80 hover:text-red-400 transition">
              <Trash2 size={20} />
            </button>
          </div>
        )}
        <button onClick={onClose} className={`${user.role !== 'admin' ? 'ml-auto' : ''} text-white/80 hover:text-white transition`}>
          <X size={24} />
        </button>
      </div>

      {showViewers && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-[#111B21] flex flex-col animate-in slide-in-from-bottom-8 duration-300">
          <div className="flex items-center gap-4 p-4 border-b border-[var(--border)] bg-gray-50 dark:bg-[#202C33]">
            <button onClick={() => setShowViewers(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white"><ChevronLeft size={24} /></button>
            <h2 className="text-lg font-bold dark:text-white">Viewed by {status.viewCount}</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {viewers.length === 0 ? (
              <p className="text-center text-gray-500 py-10">No views yet</p>
            ) : viewers.map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-4 border-b border-[#2A3942]/10">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">{v.viewerName?.[0]}</div>
                <div>
                  <p className="font-bold dark:text-white">{v.viewerName}</p>
                  <p className="text-xs text-gray-500">{new Date(v.viewedAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Tap zones */}
        <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3 z-10 focus:outline-none" />
        <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-2/3 z-10 focus:outline-none" />

        {status.contentType === 'image' && (
          <img src={status.mediaUrl} alt="status" className="max-h-full max-w-full object-contain" />
        )}
        {status.contentType === 'video' && (
          <video src={status.mediaUrl} autoPlay loop playsInline className="max-h-full max-w-full object-contain" />
        )}
        {status.contentType === 'text' && (
          <div className="flex items-center justify-center w-full h-full px-8"
            style={{ backgroundColor: status.backgroundColor || '#128C7E' }}>
            <p className="text-white text-2xl font-bold text-center leading-relaxed break-words">
              {status.textContent}
            </p>
          </div>
        )}
      </div>

      {/* Caption */}
      {status.caption && (
        <div className="px-4 py-3 bg-gradient-to-t from-black/60">
          <p className="text-white text-sm">{status.caption}</p>
        </div>
      )}
    </div>
  );
}
