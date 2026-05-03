import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Listen for messages from service worker (e.g. open chat from notification tap)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'OPEN_CHAT') {
      console.log('[SW Message] Opening chat:', event.data.chatId);
      // Dispatch a custom event so Chat/Admin pages can react
      window.dispatchEvent(new CustomEvent('sw-open-chat', { detail: { chatId: event.data.chatId } }));
    }
  });
}

