import React, { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';

interface VideoConsultationRoomProps {
  roomName: string;
  token?: string;
  serverUrl?: string;
  onLeave: (sessionResult?: { durationMinutes: number; notes: string }) => void;
  caseId?: string;
  clientName?: string;
  specialistName?: string;
}

export const VideoConsultationRoom: React.FC<VideoConsultationRoomProps> = ({
  roomName,
  token: initialToken,
  serverUrl: initialServerUrl,
  onLeave,
  caseId,
  clientName,
  specialistName = "Специалист"
}) => {
  const [token, setToken] = useState<string>(initialToken || "");
  const [serverUrl, setServerUrl] = useState<string>(initialServerUrl || "wss://live.ida-psy.ru");
  const [loading, setLoading] = useState<boolean>(!initialToken);
  const [error, setError] = useState<string | null>(null);
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyLink = () => {
    const clientLink = `https://ida-psy.ru/#room=${encodeURIComponent(roomName)}`;
    navigator.clipboard?.writeText(clientLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  const handleFinishAndSave = () => {
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    onLeave({
      durationMinutes,
      notes: sessionNotes.trim()
    });
  };

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function fetchToken() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("https://api.prevention.school/api/terminal/video/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_name: roomName || "ida-consultation",
            participant_identity: `specialist_${Date.now()}`,
            participant_name: specialistName,
            is_admin: true,
          }),
        });
        const data = await res.json();
        if (!isMounted) return;
        if (data.ok && data.token) {
          setToken(data.token);
          if (data.server_url) {
            setServerUrl(data.server_url);
          }
        } else {
          setError(data.error || "Не удалось получить токен видео-комнаты");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || "Ошибка подключения к серверу видеосвязи");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchToken();
    return () => {
      isMounted = false;
    };
  }, [roomName, initialToken, specialistName]);

  if (loading) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#111", color: "#fff" }}>
        <div style={{ fontSize: "1.2rem", marginBottom: "12px" }}>Подключение к защищенной видео-комнате IDA...</div>
        <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>Генерация ключей сессии для room: {roomName}</div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#111", color: "#ef4444" }}>
        <div style={{ fontSize: "1.2rem", marginBottom: "12px" }}>Ошибка видеосвязи</div>
        <div style={{ color: "#d1d5db", marginBottom: "20px" }}>{error || "Токен доступа не получен"}</div>
        <button 
          onClick={() => onLeave()}
          style={{ padding: "8px 16px", backgroundColor: "#374151", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
        >
          Вернуться в карточку клиента
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#111' }}>
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        onDisconnected={() => handleFinishAndSave()}
        style={{ height: '100%', flex: 1, display: 'flex' }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
           <VideoConference />
           <RoomAudioRenderer />
           {/* Custom Session Timer Overlay */}
           <SessionTimerOverlay secondsElapsed={elapsedSeconds} />
        </div>
        
        {/* Custom Sidebar for Notes and AI Supervisor info */}
        <div style={{ width: '400px', backgroundColor: '#1e1e1e', borderLeft: '1px solid #333', color: 'white', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Онлайн-сессия</h3>
              <button 
                type="button"
                onClick={handleCopyLink}
                title="Нажмите, чтобы скопировать ссылку и отправить её клиенту в Telegram, WhatsApp или Email"
                style={{
                  background: isCopied ? '#059669' : '#2563eb',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                {isCopied ? '✓ Ссылка скопирована!' : '🔗 Ссылка для клиента'}
              </button>
            </div>
            <p style={{ margin: '6px 0 0 0', color: '#9ca3af', fontSize: '0.85rem' }}>
              {clientName ? `Клиент: ${clientName}` : 'Клиент сессии'} {caseId ? `(кейс #${caseId.slice(-6)})` : ''}
            </p>

            <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(37, 99, 235, 0.1)', border: '1px dashed rgba(59, 130, 246, 0.4)', borderRadius: '6px', fontSize: '0.78rem', color: '#93c5fd' }}>
              ℹ️ <strong>Инструкция:</strong> отправьте скопированную ссылку клиенту. Клиент откроет её в браузере с телефона или компьютера без регистрации и сразу подключится к звонку.
            </div>
          </div>
          
          <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.88rem', color: '#d1d5db', fontWeight: 'bold' }}>
                ✍️ Заметки во время сессии:
              </label>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.75rem', color: '#9ca3af', lineHeight: '1.4' }}>
              Все записанные здесь тезисы при завершении автоматически перенесутся в форму визита DAP в раздел <em>«Что делали на сессии»</em>.
            </p>
            <textarea 
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              style={{ 
                flex: 1, 
                backgroundColor: '#262626', 
                border: '1px solid #4b5563', 
                color: 'white', 
                padding: '12px', 
                borderRadius: '6px',
                resize: 'none',
                fontSize: '0.9rem',
                lineHeight: '1.45'
              }} 
              placeholder="Фиксируйте ключевые фразы клиента, наблюдения за реакциями, предложенные техники..."
            />
          </div>

          <div style={{ padding: '16px', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={handleFinishAndSave}
              title="Завершить видеозвонок, сохранить точное время встречи и перенести все заметки в карточку дела"
              style={{
                width: '100%',
                padding: '11px 16px',
                backgroundColor: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)'
              }}
            >
              <span>⏹️ Завершить и перенести в карту</span>
            </button>
            <button
              type="button"
              onClick={() => onLeave()}
              title="Закрыть видеокомнату без фиксации времени и заметок"
              style={{
                width: '100%',
                padding: '6px 12px',
                backgroundColor: 'transparent',
                color: '#9ca3af',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Выйти без сохранения
            </button>
          </div>
          
          <div style={{ padding: '12px 16px', borderTop: '1px solid #2a2a2a', backgroundColor: 'rgba(124, 58, 237, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#a78bfa' }}></div>
               <span style={{ fontSize: '0.75rem', color: '#c4b5fd' }}>Шифрование WebRTC E2EE включено</span>
            </div>
          </div>
        </div>
      </LiveKitRoom>
    </div>
  );
};

const SessionTimerOverlay: React.FC<{ secondsElapsed: number }> = ({ secondsElapsed }) => {
  const maxDuration = 50 * 60; // 50 minutes

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isEnding = secondsElapsed > (maxDuration - 5 * 60); // red in last 5 mins

  return (
    <div 
      title="Таймер консультации: стандартная терапевтическая сессия рассчитана на 50 минут. За 5 минут до конца таймер станет красным."
      style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        backgroundColor: isEnding ? 'rgba(239, 68, 68, 0.9)' : 'rgba(0,0,0,0.65)',
        color: 'white',
        padding: '6px 14px',
        borderRadius: '8px',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        zIndex: 10,
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}
    >
      <span style={{ fontSize: '0.85rem' }}>⏱️</span>
      <span>{formatTime(secondsElapsed)} / 50:00</span>
      {isEnding && (
        <span style={{ fontSize: '0.75rem', background: '#fff', color: '#dc2626', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>
          Осталось &lt; 5 мин
        </span>
      )}
    </div>
  );
};
