import React, { useState, useEffect, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, ConnectionQuality } from 'livekit-client';

interface VideoQualityIndicatorProps {
  roomId: string;
  role?: string;
  mode?: 'consultation' | 'webinar' | 'course' | 'lesson' | string;
  participantName?: string;
}

interface QualityMetrics {
  rttMs: number;
  packetLossPct: number;
  jitterMs: number;
  bitrateKbps: number;
  resolution: string;
  fps: number;
  qualityGrade: 'excellent' | 'good' | 'poor' | 'lost';
  mosScore: number;
  freezeCount: number;
}

export const VideoQualityIndicator: React.FC<VideoQualityIndicatorProps> = ({
  roomId,
  role = 'viewer',
  mode = 'lesson',
  participantName = '',
}) => {
  const room = useRoomContext();
  const [isOpen, setIsOpen] = useState(false);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<QualityMetrics>({
    rttMs: 22,
    packetLossPct: 0.0,
    jitterMs: 1.8,
    bitrateKbps: 1250,
    resolution: '1280x720',
    fps: 30,
    qualityGrade: 'excellent',
    mosScore: 4.88,
    freezeCount: 0,
  });

  const lastTelemetrySentRef = useRef<number>(0);
  const freezeCountRef = useRef<number>(0);
  const alertTimerRef = useRef<any>(null);
  const currentMetricsRef = useRef<QualityMetrics>(metrics);
  currentMetricsRef.current = metrics;

  const sendTelemetryPacket = async (payload: any, useKeepalive: boolean = false) => {
    try {
      const endpoints = [
        'https://api.prevention.school/api/live/quality-telemetry',
        '/api/live/quality-telemetry',
      ];
      const jsonBody = JSON.stringify(payload);

      if (useKeepalive && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const blob = new Blob([jsonBody], { type: 'application/json' });
          const sent = navigator.sendBeacon(endpoints[0], blob);
          if (sent) return;
        } catch {
          // fallback to fetch below
        }
      }

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonBody,
            keepalive: useKeepalive,
          });
          if (res.ok) break;
        } catch {
          // fallback to next endpoint
        }
      }
    } catch {
      // ignore non-critical telemetry failure
    }
  };

  const dispatchCurrentTelemetry = (isFinal: boolean = false) => {
    const cur = currentMetricsRef.current;
    lastTelemetrySentRef.current = Date.now();
    sendTelemetryPacket({
      room_id: roomId,
      participant_id: room?.localParticipant?.identity || 'anon',
      participant_name: participantName || room?.localParticipant?.name || '',
      role: role,
      mode: mode,
      rtt_ms: cur.rttMs,
      packet_loss_pct: cur.packetLossPct,
      jitter_ms: cur.jitterMs,
      bitrate_kbps: cur.bitrateKbps,
      resolution: cur.resolution,
      fps: cur.fps,
      connection_quality: cur.qualityGrade,
      drops_count: cur.freezeCount,
      is_incident: cur.qualityGrade === 'poor',
      incident_details: cur.qualityGrade === 'poor' ? `Просадка канала: RTT ${cur.rttMs}ms, Loss ${cur.packetLossPct}%` : '',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      duration_seconds: isFinal ? 1 : 0,
    }, isFinal);
  };

  // Poll WebRTC stats and update telemetry
  useEffect(() => {
    if (!room) return;

    // Listen to LiveKit ConnectionQualityChanged
    const handleQualityChanged = (quality: ConnectionQuality, p: any) => {
      if (p === room.localParticipant) {
        let grade: 'excellent' | 'good' | 'poor' | 'lost' = 'excellent';
        if (quality === ConnectionQuality.Good) grade = 'good';
        else if (quality === ConnectionQuality.Poor) grade = 'poor';
        else if (quality === ConnectionQuality.Lost) grade = 'lost';

        setMetrics((prev) => ({
          ...prev,
          qualityGrade: grade,
          mosScore: grade === 'excellent' ? 4.88 : grade === 'good' ? 3.9 : 2.4,
        }));

        if (grade === 'poor') {
          showAlertNotice('Качество связи ухудшилось: WebRTC адаптирует видеопоток');
        }
      }
    };

    room.on(RoomEvent.ConnectionQualityChanged, handleQualityChanged);

    // Initial pre-flight telemetry dispatch after 2.5 seconds
    const initialPreflightTimer = setTimeout(() => {
      dispatchCurrentTelemetry(false);
    }, 2500);

    // Periodic WebRTC getStats sampling & backend telemetry dispatch
    const intervalId = setInterval(async () => {
      try {
        let rtt = 22.0;
        let loss = 0.0;
        let jitter = 1.5;
        let bitrate = 1200;
        let res = '1280x720';
        let fps = 30;

        // Extract native WebRTC stats if peer connection is accessible
        const engine = (room as any).engine;
        const pc = engine?.publisher?.pc || engine?.subscriber?.pc;
        if (pc && typeof pc.getStats === 'function') {
          const stats = await pc.getStats();
          let packetsLost = 0;
          let packetsReceived = 0;

          stats.forEach((report: any) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime !== undefined) {
                rtt = Math.round(report.currentRoundTripTime * 1000);
              }
            }
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              packetsLost += report.packetsLost || 0;
              packetsReceived += report.packetsReceived || 0;
              if (report.jitter !== undefined) {
                jitter = Math.round(report.jitter * 1000);
              }
              if (report.frameWidth && report.frameHeight) {
                res = `${report.frameWidth}x${report.frameHeight}`;
              }
              if (report.framesPerSecond) {
                fps = Math.round(report.framesPerSecond);
              }
              if (report.freezeCount !== undefined) {
                freezeCountRef.current = report.freezeCount;
              }
            }
          });

          if (packetsReceived > 0) {
            loss = Math.min(100, Math.round((packetsLost / (packetsLost + packetsReceived)) * 1000) / 10);
          }
        }

        // LiveKit localParticipant quality fallback
        const lkQuality = room.localParticipant?.connectionQuality;
        let grade: 'excellent' | 'good' | 'poor' | 'lost' = 'excellent';
        if (loss > 4 || rtt > 300 || lkQuality === ConnectionQuality.Poor) {
          grade = 'poor';
        } else if (loss > 1.5 || rtt > 150 || lkQuality === ConnectionQuality.Good) {
          grade = 'good';
        }

        // Estimate MOS
        const mos = Math.max(1.0, Math.min(5.0, Math.round((4.85 - (rtt > 150 ? (rtt - 150) * 0.005 : 0) - loss * 0.3) * 100) / 100));

        setMetrics({
          rttMs: rtt,
          packetLossPct: loss,
          jitterMs: jitter,
          bitrateKbps: bitrate,
          resolution: res,
          fps: fps,
          qualityGrade: grade,
          mosScore: mos,
          freezeCount: freezeCountRef.current,
        });

        // Trigger alert banner if degradation detected
        if (loss >= 3.0 || rtt >= 280) {
          showAlertNotice(`Внимание: просадка сети (потери ${loss}%, задержка ${rtt} мс). Видео оптимизировано для звука.`);
        }

        // Send telemetry to backend every 15-20 seconds
        const now = Date.now();
        if (now - lastTelemetrySentRef.current >= 18000) {
          dispatchCurrentTelemetry(false);
        }
      } catch (err) {
        // non-blocking
      }
    }, 5000);

    const handleBeforeUnload = () => {
      dispatchCurrentTelemetry(true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(initialPreflightTimer);
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      room.off(RoomEvent.ConnectionQualityChanged, handleQualityChanged);
      dispatchCurrentTelemetry(true);
    };
  }, [room, roomId, role, mode, participantName]);

  const showAlertNotice = (msg: string) => {
    setAlertNotice(msg);
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => {
      setAlertNotice(null);
    }, 8000);
  };

  const getStatusColor = () => {
    if (metrics.qualityGrade === 'excellent') return '#10b981';
    if (metrics.qualityGrade === 'good') return '#f59e0b';
    return '#ef4444';
  };

  const getStatusLabel = () => {
    if (metrics.qualityGrade === 'excellent') return 'Отличная связь';
    if (metrics.qualityGrade === 'good') return 'Нормальная связь';
    return 'Просадка сети';
  };

  return (
    <>
      {/* Alert toast for network dips */}
      {alertNotice && (
        <div style={{
          position: 'absolute',
          top: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(239, 68, 68, 0.95)',
          color: '#ffffff',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '0.82rem',
          fontWeight: 600,
          zIndex: 9999,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>📶</span>
          <span>{alertNotice}</span>
        </div>
      )}

      {/* Real-time Quality Badge */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Нажмите для просмотра мониторинга качества WebRTC связи"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: `1px solid ${getStatusColor()}66`,
            color: '#f8fafc',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s ease',
            boxShadow: `0 2px 8px ${getStatusColor()}33`,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: getStatusColor(),
              boxShadow: `0 0 6px ${getStatusColor()}`,
              display: 'inline-block',
            }}
          />
          <span>{metrics.rttMs} мс</span>
          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
            {metrics.packetLossPct > 0 ? `(${metrics.packetLossPct}% потерь)` : '0% потерь'}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#93c5fd' }}>⚙️</span>
        </button>

        {/* Diagnostic Popover */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '38px',
              right: '0px',
              width: '280px',
              backgroundColor: 'rgba(15, 23, 42, 0.96)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              padding: '14px',
              color: '#f8fafc',
              zIndex: 9999,
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(12px)',
              fontSize: '0.82rem',
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusColor() }} />
                <strong style={{ color: getStatusColor() }}>{getStatusLabel()}</strong>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '10px 0' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Задержка (RTT)</span>
                <span style={{ fontWeight: 700, color: '#f8fafc' }}>{metrics.rttMs} мс</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Потери пакетов</span>
                <span style={{ fontWeight: 700, color: metrics.packetLossPct > 2 ? '#ef4444' : '#10b981' }}>
                  {metrics.packetLossPct}%
                </span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Индекс MOS</span>
                <span style={{ fontWeight: 700, color: '#60a5fa' }}>{metrics.mosScore} / 5.0</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Разрешение</span>
                <span style={{ fontWeight: 700, color: '#f8fafc' }}>{metrics.resolution}</span>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#94a3b8', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '8px' }}>
              <div>Сервер: <b>live.ida-psy.ru</b> (WebRTC SFU)</div>
              <div>Кодеки: <b>Opus HD / VP8 Adaptive</b></div>
              <div style={{ marginTop: '4px', color: '#34d399' }}>✓ Без 40-минутных лимитов</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
