import { useRef, useState } from 'react';
import { Paperclip, Send, Mic, X, Image, Film, FileAudio } from 'lucide-react';
import api from '../../utils/api.js';
import { uploadUnsigned } from '../../utils/cloudinary.js';

export default function MessageInput({ onSend, disabled, chatId }) {
  const [text, setText]           = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState(null); // { file, url, type }
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileRef  = useRef();
  const textRef  = useRef();
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const file = new File([audioBlob], "voice_note.mp3", { type: "audio/mp3" });
        const url = URL.createObjectURL(file);
        setPreview({ file, url, type: 'audio', uploadType: 'audio' });
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone: " + err.message);
    }
  };

  const stopRecording = (cancel = false) => {
    if (mediaRecorderRef.current && isRecording) {
      if (cancel) {
        mediaRecorderRef.current.onstop = null; // Prevent setting preview
      }
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const handleSend = async () => {
    if (disabled) return;
    if (preview) {
      try {
        setUploading(true);
        // Direct unsigned upload
        const { url } = await uploadUnsigned(preview.file, preview.type);
        await onSend({ messageType: preview.type, mediaUrl: url, content: text || null });
        setPreview(null);
        setText('');
      } catch (e) {
        alert('Upload failed: ' + e.message + '\n(Make sure unsigned uploads are enabled in Cloudinary)');
      } finally {
        setUploading(false);
      }
      return;
    }
    if (!text.trim()) return;
    await onSend({ content: text.trim(), messageType: 'text' });
    setText('');
    textRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const pickFile = (accept, type, uploadType) => {
    fileRef.current.accept = accept;
    fileRef.current._type = type;
    fileRef.current._uploadType = uploadType;
    fileRef.current.click();
    setShowAttach(false);
  };

  const onFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview({ file, url, type: fileRef.current._type, uploadType: fileRef.current._uploadType });
    e.target.value = '';
  };

  return (
    <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--input-bg)]">
      {/* File preview */}
      {preview && (
        <div className="mb-2 flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
          {preview.type === 'image' && (
            <img src={preview.url} alt="" className="w-14 h-14 object-cover rounded-lg" />
          )}
          {preview.type === 'video' && (
            <video src={preview.url} className="w-14 h-14 object-cover rounded-lg" />
          )}
          {preview.type === 'audio' && (
            <div className="flex items-center gap-2">
              <FileAudio size={24} className="text-green-500" />
              <span className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[150px]">{preview.file.name}</span>
            </div>
          )}
          <button onClick={() => setPreview(null)} className="ml-auto text-gray-400 hover:text-red-500 transition">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attachment */}
        {!isRecording && (
          <div className="relative">
            <button id="attach-btn" onClick={() => setShowAttach(!showAttach)}
              className="p-2 text-gray-500 hover:text-green-500 transition rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <Paperclip size={22} />
            </button>
            {showAttach && (
              <div className="absolute bottom-12 left-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-2 flex flex-col gap-1 z-10 border border-[var(--border)]">
                <button onClick={() => pickFile('image/*', 'image', 'image')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 transition">
                  <Image size={18} className="text-green-500" /> Photo
                </button>
                <button onClick={() => pickFile('video/*', 'video', 'video')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 transition">
                  <Film size={18} className="text-blue-500" /> Video
                </button>
                <button onClick={() => pickFile('audio/*', 'audio', 'audio')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 transition">
                  <FileAudio size={18} className="text-purple-500" /> Audio
                </button>
              </div>
            )}
          </div>
        )}

        {/* Text input or Recording UI */}
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl px-4 py-3 h-[46px]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
            </div>
            <button onClick={() => stopRecording(true)} className="text-sm font-semibold hover:text-red-700 transition">Cancel</button>
          </div>
        ) : (
          <textarea
            ref={textRef}
            id="message-input"
            value={text}
            onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            onKeyDown={handleKey}
            placeholder={disabled ? 'You are blocked from sending messages' : 'Type a message...'}
            disabled={disabled || uploading}
            rows={1}
            className="flex-1 resize-none bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition disabled:opacity-50"
            style={{ maxHeight: 120 }}
          />
        )}

        {/* Send or Mic button */}
        {isRecording ? (
          <button
            onClick={() => stopRecording(false)}
            className="p-3 rounded-full text-white bg-green-500 hover:bg-green-600 transition-all hover:scale-110 active:scale-95 flex-shrink-0"
          >
            <Send size={20} />
          </button>
        ) : (!text.trim() && !preview) ? (
          <button
            id="mic-btn"
            onClick={startRecording}
            disabled={disabled || uploading}
            className="p-3 rounded-full text-white transition-all hover:scale-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 flex-shrink-0"
            style={{ backgroundColor: 'var(--primary)' }}>
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Mic size={20} />
            )}
          </button>
        ) : (
          <button
            id="send-btn"
            onClick={handleSend}
            disabled={disabled || uploading}
            className="p-3 rounded-full text-white transition-all hover:scale-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 flex-shrink-0"
            style={{ backgroundColor: 'var(--primary)' }}>
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" className="hidden" onChange={onFileSelected} />
    </div>
  );
}
