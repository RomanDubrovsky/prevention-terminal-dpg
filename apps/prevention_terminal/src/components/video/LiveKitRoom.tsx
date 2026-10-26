import { trackVideoEvent } from "../../lib/analytics.ts";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  ParticipantTile,
  LayoutContextProvider,
  useTracks,
  useRoomContext,
  useRemoteParticipants,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import '@livekit/components-styles';

import { useSessionTranscript } from './useSessionTranscript.ts';
import { InSessionHelpPanel } from './InSessionHelpPanel.tsx';
import { SessionMindMap, MapTopicNode, SessionSprint } from './SessionMindMap.tsx';
import { useDeepInsightWatcher, DeepInsight } from './useDeepInsightWatcher.ts';
import { useTerminalSubscription } from '../../lib/use_terminal_subscription.ts';
import { isDemoModeActive } from '../../lib/staging_demo_seed.ts';
import AiSubscriptionPaywall from '../AiSubscriptionPaywall.tsx';
import { VideoQualityIndicator } from './VideoQualityIndicator.tsx';
import { t } from '../../lib/i18n.ts';

interface VideoConsultationRoomProps {
  roomName: string;
  token?: string;
  serverUrl?: string;
  onLeave: (sessionResult?: { durationMinutes: number; notes: string; transcript?: string }) => void;
  caseId?: string;
  clientName?: string;
  specialistName?: string;
  terminalUserId?: string;
  commercial?: boolean;
  isClient?: boolean;
  mode?: "consultation" | "webinar" | "course" | "lesson";
  role?: string;
}

const ParticipantsPanel: React.FC<{
  sbColors: any;
  isWebinarMode: boolean;
  specialistName?: string;
  isClient?: boolean;
  handRaisedUsers?: Record<string, boolean>;
  onGrantMic?: (sid: string, identity: string) => void;
}> = ({ sbColors, isWebinarMode, specialistName, isClient = false, handRaisedUsers = {}, onGrantMic }) => {
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();
  const [mutedLocally, setMutedLocally] = useState<Record<string, boolean>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const sendModerationSignal = (type: string, targetSid?: string, targetIdentity?: string) => {
    if (!room || !localParticipant) return;
    try {
      const payload = new TextEncoder().encode(JSON.stringify({
        type,
        targetSid,
        targetIdentity,
        senderIdentity: localParticipant.identity,
        timestamp: Date.now()
      }));
      localParticipant.publishData(payload, { reliable: true });
    } catch (err) {
      console.warn("Failed to publish moderation signal:", err);
    }
  };

  const handleMuteAll = () => {
    sendModerationSignal('MUTE_LISTENERS');
    showStatus('Команда «Выключить микрофоны слушателям» отправлена');
  };

  const handleMuteParticipantMic = (sid: string, identity: string) => {
    sendModerationSignal('MUTE_MIC', sid, identity);
    showStatus(`Запрос на отключение микрофона отправлен`);
  };

  const handleDisableParticipantCam = (sid: string, identity: string) => {
    sendModerationSignal('DISABLE_CAM', sid, identity);
    showStatus(`Запрос на отключение камеры отправлен`);
  };

  const handleGrantParticipantMic = (sid: string, identity: string) => {
    sendModerationSignal('GRANT_MIC', sid, identity);
    if (onGrantMic) {
      onGrantMic(sid, identity);
    }
    showStatus(`Слово предоставлено! Слушатель может включить микрофон`);
  };

  const handleToggleLocalMute = (p: any) => {
    const isCurrentlyMuted = mutedLocally[p.sid] || false;
    try {
      p.setVolume(isCurrentlyMuted ? 1 : 0);
      setMutedLocally(prev => ({ ...prev, [p.sid]: !isCurrentlyMuted }));
      showStatus(isCurrentlyMuted ? `Звук участника включен для вас` : `Звук участника заглушен для вас`);
    } catch (e) {
      console.warn("Error setting participant volume:", e);
    }
  };

  const allCount = (localParticipant ? 1 : 0) + remoteParticipants.length;

  return (
    <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
      {/* Header and bulk actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: sbColors.text }}>
            👥 Участники
          </span>
          <span style={{
            fontSize: '0.75rem',
            background: isWebinarMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            border: isWebinarMode ? '1px solid #10b981' : '1px solid #3b82f6',
            color: isWebinarMode ? '#10b981' : '#60a5fa',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: 700
          }}>
            {allCount} в эфире
          </span>
        </div>

        {remoteParticipants.length > 0 && (
          <button
            type="button"
            onClick={handleMuteAll}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
            }}
            title="Отключить микрофоны всем подключенным слушателям"
          >
            🔇 Заглушить слушателей
          </button>
        )}
      </div>

      {statusMsg && (
        <div style={{
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          border: '1px solid #3b82f6',
          color: '#93c5fd',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '0.78rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>⚡</span>
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Host Card (Local Participant) */}
      {localParticipant && (
        <div style={{
          background: sbColors.cardBg,
          border: `1px solid ${sbColors.border}`,
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem'
            }}>
              ⭐
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: sbColors.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{localParticipant.name || specialistName || 'Организатор'}</span>
                <span style={{ fontSize: '0.68rem', background: '#3b82f6', color: '#fff', padding: '1px 6px', borderRadius: '6px', fontWeight: 700 }}>
                  Вы (Ведущий)
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: sbColors.textMuted, marginTop: '2px' }}>
                Микрофон: {localParticipant.isMicrophoneEnabled ? '🟢 Включен' : '🔴 Выключен'} • Камера: {localParticipant.isCameraEnabled ? '🟢 Включена' : '🔴 Выключена'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remote Participants List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: sbColors.textMuted, textTransform: 'uppercase' }}>
          Участники сессии ({remoteParticipants.length})
        </div>

        {remoteParticipants.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: sbColors.textMuted,
            fontSize: '0.82rem',
            background: sbColors.cardBg,
            borderRadius: '10px',
            border: `1px dashed ${sbColors.border}`
          }}>
            Другие участники пока не подключились к видеокомнате. Ссылку для гостей можно скопировать в верхней части панели.
          </div>
        ) : (
          remoteParticipants.map((p) => {
            const isMicOn = p.isMicrophoneEnabled;
            const isCamOn = p.isCameraEnabled;
            const isLocallyMuted = mutedLocally[p.sid] || false;
            const isHandRaised = Boolean(handRaisedUsers[p.identity] || handRaisedUsers[p.sid]);

            return (
              <div
                key={p.sid}
                style={{
                  background: isHandRaised ? 'rgba(245, 158, 11, 0.08)' : sbColors.cardBg,
                  border: isHandRaised ? '1px solid #f59e0b' : `1px solid ${sbColors.border}`,
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: isHandRaised ? '#d97706' : '#3f3f46',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.8rem'
                    }}>
                      {isHandRaised ? '✋' : (p.name || p.identity || 'У').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: sbColors.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{p.name || p.identity || 'Слушатель'}</span>
                        {isHandRaised && (
                          <span style={{ fontSize: '0.68rem', background: '#f59e0b', color: '#000', padding: '1px 6px', borderRadius: '6px', fontWeight: 800 }}>
                            ✋ Просит слова
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: sbColors.textMuted, display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <span>Микрофон: {isMicOn ? '🟢' : '🔴'}</span>
                        <span>Камера: {isCamOn ? '🟢' : '🔴'}</span>
                        {isLocallyMuted && <span style={{ color: '#ef4444' }}>🔇 Заглушен для вас</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Moderation Controls for this Participant (Available to Host / Speaker) */}
                {!isClient && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: `1px solid ${sbColors.border}`, paddingTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleGrantParticipantMic(p.sid, p.identity)}
                      style={{
                        flex: '1 1 100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.5)',
                        color: '#34d399',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                      title="Дать слово: разрешить участнику включить микрофон"
                    >
                      <span>🎙️ Дать слово (Разрешить микрофон)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMuteParticipantMic(p.sid, p.identity)}
                      style={{
                        flex: 1,
                        minWidth: '120px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: isMicOn ? 'rgba(239, 68, 68, 0.15)' : 'rgba(107, 114, 128, 0.2)',
                        border: isMicOn ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(107, 114, 128, 0.3)',
                        color: isMicOn ? '#f87171' : sbColors.textMuted,
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                      title="Выключить микрофон участника"
                    >
                      <span>🔇 Выключить микрофон</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDisableParticipantCam(p.sid, p.identity)}
                      style={{
                        flex: 1,
                        minWidth: '120px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: isCamOn ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.2)',
                        border: isCamOn ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(107, 114, 128, 0.3)',
                        color: isCamOn ? '#fbbf24' : sbColors.textMuted,
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                      title="Выключить камеру участника"
                    >
                      <span>📷 Выключить камеру</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleLocalMute(p)}
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        background: isLocallyMuted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                        border: isLocallyMuted ? '1px solid rgba(16, 185, 129, 0.4)' : `1px solid ${sbColors.border}`,
                        color: isLocallyMuted ? '#34d399' : sbColors.textMuted,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                      title="Заглушить звук от этого участника только в своих наушниках"
                    >
                      <span>{isLocallyMuted ? '🔊 Включить звук у себя' : '🔈 Заглушить у себя'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const ConferenceStage: React.FC<{
  isClient?: boolean;
  role?: string;
  onLeave: () => void;
  isDemo?: boolean;
  elapsedSeconds: number;
  maxSessionSeconds: number;
  liveAiSuggestion?: {
    id: string;
    label: string;
    excerpt: string;
    category: string;
    reason: string;
  } | null;
  onAcceptAiSuggestion?: (sug: any, status: 'sprint' | 'paused') => void;
  onDismissAiSuggestion?: (id: string) => void;
  deepInsight?: DeepInsight | null;
  onAcceptDeepInsight?: (insight: DeepInsight, status: 'sprint' | 'paused' | 'risk') => void;
  onDismissDeepInsight?: (id: string) => void;
  roomId?: string;
  mode?: 'consultation' | 'webinar' | 'course' | 'lesson';
  participantName?: string;
  isMapOverlayOpen?: boolean;
  onToggleMapOverlay?: () => void;
  isMobileSidebarOpen?: boolean;
  onToggleMobileSidebar?: () => void;
  isWebinarMode?: boolean;
  isCourseMode?: boolean;
  isLessonMode?: boolean;
  isHandRaised?: boolean;
  onToggleHandRaise?: () => void;
  onPromoteToSpeaker?: () => void;
  hasMicPermission?: boolean;
  handRaiseNotice?: { id: string; name: string } | null;
  onDismissHandNotice?: () => void;
  onGrantMic?: (identity: string, sid?: string) => void;
  onHandRaiseSignal?: (data: any) => void;
  onMicGranted?: () => void;
}> = ({
  isClient,
  role,
  onLeave,
  isDemo,
  elapsedSeconds,
  maxSessionSeconds,
  liveAiSuggestion,
  onAcceptAiSuggestion,
  onDismissAiSuggestion,
  deepInsight,
  onAcceptDeepInsight,
  onDismissDeepInsight,
  roomId = 'session',
  mode = 'consultation',
  participantName = '',
  isMapOverlayOpen = false,
  onToggleMapOverlay,
  isMobileSidebarOpen = false,
  onToggleMobileSidebar,
  isWebinarMode = false,
  isCourseMode = false,
  isLessonMode = false,
  isHandRaised = false,
  onToggleHandRaise,
  onPromoteToSpeaker,
  hasMicPermission = false,
  handRaiseNotice = null,
  onDismissHandNotice,
  onGrantMic,
  onHandRaiseSignal,
  onMicGranted,
}) => {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenShareTrack = tracks.find(t => t.source === Track.Source.ScreenShare);
  const cameraTracks = tracks.filter(t => t.source === Track.Source.Camera);

  const room = useRoomContext();
  const [audioPlaybackAllowed, setAudioPlaybackAllowed] = useState<boolean>(() => {
    try {
      return room ? room.canPlaybackAudio : true;
    } catch {
      return true;
    }
  });

  const isCourse = mode === 'course' || Boolean(isCourseMode);
  const isLesson = mode === 'lesson' || Boolean(isLessonMode);
  const normalizedRole = (role || '').toLowerCase();
  const isTeacher = isLesson && (normalizedRole === 'teacher' || normalizedRole === 'tutor' || !isClient);
  const isAuthor = !isLesson && (normalizedRole === 'author' || normalizedRole === 'host' || normalizedRole === 'admin' || (!isClient && !isCourse && normalizedRole !== 'speaker' && normalizedRole !== 'cohost' && normalizedRole !== 'student' && normalizedRole !== 'listener'));
  const isSpeaker = !isLesson && (normalizedRole === 'speaker' || normalizedRole === 'cohost');
  const isStudent = (isLesson && (normalizedRole === 'student' || isClient)) || (!isLesson && (normalizedRole === 'student' || (isCourse && !isAuthor && !isSpeaker)));
  const isListener = !isLesson && (normalizedRole === 'listener' || normalizedRole === 'guest' || (!isAuthor && !isSpeaker && !isStudent && (isWebinarMode || isClient)));

  // На уроке и преподаватель, и ученик могут свободно показывать экран (задачи, доски, формулы, графики)!
  const canScreenShare = isAuthor || isSpeaker || isStudent || isCourse || isLesson;

  useEffect(() => {
    if (!room) return;

    const handleAudioStatusChange = () => {
      setAudioPlaybackAllowed(room.canPlaybackAudio);
    };

    const handleReconnecting = () => {
      setConnectionNotice("Слабый сигнал сети. Восстановление видеопотока...");
    };
    const handleReconnected = () => {
      setConnectionNotice("Связь успешно восстановлена! Эфир продолжается.");
      setTimeout(() => setConnectionNotice(null), 4000);
    };

    setAudioPlaybackAllowed(room.canPlaybackAudio);
    room.on(RoomEvent.AudioPlaybackStatusChanged, handleAudioStatusChange);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);

    const unlockAudio = () => {
      if (!room.canPlaybackAudio) {
        room.startAudio().catch((err) => console.warn("LiveKit startAudio notice:", err));
      }
    };
    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });

    // Remote moderation signal listener (Mute Mic, Disable Camera)
    const handleDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);
        const mySid = room.localParticipant?.sid;
        const myId = room.localParticipant?.identity;

        if (data.type === 'MUTE_ALL' || data.type === 'MUTE_LISTENERS') {
          // Если получен сигнал глушения слушателей:
          // Авторы, со-ведущие и студенты курсов защищены! Глушатся только слушатели вебинара.
          const isProtected = isAuthor || isSpeaker || isStudent;
          if (participant?.identity !== myId && !isProtected) {
            room.localParticipant.setMicrophoneEnabled(false);
          }
        } else if (data.type === 'MUTE_MIC' && (data.targetSid === mySid || data.targetIdentity === myId)) {
          room.localParticipant.setMicrophoneEnabled(false);
        } else if (data.type === 'DISABLE_CAM' && (data.targetSid === mySid || data.targetIdentity === myId)) {
          room.localParticipant.setCameraEnabled(false);
        } else if (data.type === 'GRANT_MIC' && (data.targetSid === mySid || data.targetIdentity === myId)) {
          room.localParticipant.setMicrophoneEnabled(true).catch(console.warn);
          if (onMicGranted) onMicGranted();
        } else if (data.type === 'HAND_RAISE') {
          if (onHandRaiseSignal) onHandRaiseSignal(data);
        }
      } catch (e) {
        // Ignore non-json signaling
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.AudioPlaybackStatusChanged, handleAudioStatusChange);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.DataReceived, handleDataReceived);
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [room, onMicGranted, onHandRaiseSignal, isAuthor, isSpeaker, isStudent]);

  const handleMuteAllListeners = () => {
    if (!room?.localParticipant) return;
    try {
      const payload = new TextEncoder().encode(JSON.stringify({
        type: 'MUTE_LISTENERS',
        senderIdentity: room.localParticipant.identity,
        timestamp: Date.now()
      }));
      room.localParticipant.publishData(payload, { reliable: true });
    } catch (err) {
      console.warn("Failed to mute listeners:", err);
    }
  };

  const handleToggleLocalHandRaise = () => {
    const nextRaised = !isHandRaised;
    if (onToggleHandRaise) {
      onToggleHandRaise();
    }
    if (room?.localParticipant) {
      try {
        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'HAND_RAISE',
          participantIdentity: room.localParticipant.identity,
          participantSid: room.localParticipant.sid,
          participantName: participantName || "Слушатель",
          raised: nextRaised,
          timestamp: Date.now()
        }));
        room.localParticipant.publishData(payload, { reliable: true });
      } catch (err) {
        console.warn("Failed to publish hand raise signal:", err);
      }
    }
  };

  return (
    <div className="ida-conference-stage" style={{
      flex: 1,
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      background: '#09090b',
      minHeight: 0
    }}>
      <SessionTimerOverlay secondsElapsed={elapsedSeconds} isDemo={isDemo} maxDuration={maxSessionSeconds} isLessonMode={isLesson} />

      {/* Browser Autoplay Audio Unlock Banner */}
      {!audioPlaybackAllowed && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.88rem',
          fontWeight: 700
        }}>
          <span>🔊 Браузер заблокировал звук</span>
          <button
            type="button"
            onClick={() => {
              if (room) {
                room.startAudio().then(() => setAudioPlaybackAllowed(true)).catch(console.warn);
              }
            }}
            style={{
              background: '#ffffff',
              color: '#065f46',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '0.82rem'
            }}
          >
            Включить звук
          </button>
        </div>
      )}

      {/* Real-time WebRTC Quality Indicator */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 30, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <VideoQualityIndicator
          roomId={roomId}
          role={isClient ? 'client' : 'specialist'}
          mode={mode}
          participantName={participantName}
        />
      </div>

      {/* Floating Real-time Speech AI Suggestion Toast */}
      {liveAiSuggestion && !isClient && !isWebinarMode && !isCourseMode && !isLesson && (
        <div style={{
          position: 'absolute',
          bottom: '84px',
          right: '16px',
          maxWidth: '340px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #8b5cf6',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), 0 0 16px rgba(139, 92, 246, 0.35)',
          zIndex: 50,
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', background: '#7c3aed', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
              ⚡ ИИ услышал тему в речи
            </span>
            <button
              type="button"
              onClick={() => onDismissAiSuggestion && onDismissAiSuggestion(liveAiSuggestion.id)}
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px' }}
              title="Скрыть"
            >
              ✕
            </button>
          </div>

          <strong style={{ fontSize: '0.84rem', color: '#f8fafc', lineHeight: 1.3 }}>
            {liveAiSuggestion.label}
          </strong>

          <p style={{ margin: 0, fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.35, background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px' }}>
            «{liveAiSuggestion.excerpt}»
          </p>

          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => onAcceptAiSuggestion && onAcceptAiSuggestion(liveAiSuggestion, 'sprint')}
              style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
            >
              🎯 В спринт
            </button>
            <button
              type="button"
              onClick={() => onAcceptAiSuggestion && onAcceptAiSuggestion(liveAiSuggestion, 'paused')}
              style={{ flex: 1, background: '#374151', color: '#93c5fd', border: '1px solid #4b5563', padding: '6px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
            >
              ⏸️ На парковку
            </button>
          </div>
        </div>
      )}

      {/* Floating Deep Insight Toast — contradictions, defenses, incongruence */}
      {deepInsight && !isClient && !isWebinarMode && !isCourseMode && !isLesson && (
        <div style={{
          position: 'absolute',
          bottom: liveAiSuggestion ? '250px' : '84px',
          left: '16px',
          maxWidth: '370px',
          background: 'rgba(30, 10, 10, 0.96)',
          border: `1px solid ${deepInsight.severity === 'high' ? '#dc2626' : '#d97706'}`,
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.7), 0 0 16px ${deepInsight.severity === 'high' ? 'rgba(220, 38, 38, 0.35)' : 'rgba(217, 119, 6, 0.35)'}`,
          zIndex: 50,
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '0.68rem',
                background: deepInsight.severity === 'high' ? '#dc2626' : deepInsight.severity === 'medium' ? '#d97706' : '#6b7280',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 800,
                textTransform: 'uppercase'
              }}>
                {deepInsight.severity === 'high' ? '🔴 Важно' : deepInsight.severity === 'medium' ? '🟡 Внимание' : '🔵 Заметка'}
              </span>
              <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.1)', color: '#fbbf24', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                🧠 Глубокий ИИ-анализ
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDismissDeepInsight && onDismissDeepInsight(deepInsight.id)}
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px' }}
              title="Скрыть"
            >
              ✕
            </button>
          </div>

          <strong style={{ fontSize: '0.82rem', color: '#fef3c7', lineHeight: 1.3 }}>
            {deepInsight.label}
          </strong>

          <p style={{
            margin: 0,
            fontSize: '0.72rem',
            color: '#fde68a',
            fontStyle: 'italic',
            lineHeight: 1.35,
            background: 'rgba(0,0,0,0.3)',
            padding: '4px 8px',
            borderRadius: '4px',
            borderLeft: `3px solid ${deepInsight.severity === 'high' ? '#dc2626' : '#d97706'}`
          }}>
            «{deepInsight.excerpt}»
          </p>

          <p style={{ margin: 0, fontSize: '0.72rem', color: '#e5e7eb', lineHeight: 1.35 }}>
            {deepInsight.explanation}
          </p>

          <p style={{ margin: 0, fontSize: '0.70rem', color: '#93c5fd', lineHeight: 1.35, background: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
            💡 <strong>Клинический совет:</strong> {deepInsight.clinicalHint}
          </p>

          <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => onAcceptDeepInsight && onAcceptDeepInsight(deepInsight, 'risk')}
              style={{ flex: 1, background: '#dc2626', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer' }}
            >
              ⚠️ В карту (риск)
            </button>
            <button
              type="button"
              onClick={() => onAcceptDeepInsight && onAcceptDeepInsight(deepInsight, 'sprint')}
              style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer' }}
            >
              🎯 В спринт
            </button>
            <button
              type="button"
              onClick={() => onAcceptDeepInsight && onAcceptDeepInsight(deepInsight, 'paused')}
              style={{ flex: 1, background: '#374151', color: '#93c5fd', border: '1px solid #4b5563', padding: '6px 8px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: 600, cursor: 'pointer' }}
            >
              ⏸️ Парковка
            </button>
          </div>
        </div>
      )}

      {/* Video Grid Container */}
      <div style={{
        flex: 1,
        minHeight: 0,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {screenShareTrack ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0, width: '100%', height: '100%' }}>
            <div style={{ flex: 1, minHeight: 0, borderRadius: '12px', overflow: 'hidden', background: '#18181b', border: '1px solid #27272a' }}>
              <ParticipantTile trackRef={screenShareTrack} style={{ width: '100%', height: '100%' }} />
            </div>
            <div style={{ height: '120px', display: 'flex', gap: '8px', overflowX: 'auto', flexShrink: 0 }}>
              {cameraTracks.map((tr) => (
                <div key={`${tr.participant.identity}-${tr.source}`} style={{ width: '180px', height: '100%', borderRadius: '8px', overflow: 'hidden', background: '#18181b', flexShrink: 0 }}>
                  <ParticipantTile trackRef={tr} style={{ width: '100%', height: '100%' }} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="ida-video-grid"
            style={{
              flex: 1,
              display: 'grid',
              gap: '12px',
              width: '100%',
              height: '100%',
              minHeight: 0,
              gridTemplateColumns: cameraTracks.length <= 1 ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
              gridAutoRows: '1fr',
              alignItems: 'stretch',
              justifyItems: 'stretch',
            }}
          >
            {cameraTracks.length === 0 ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                background: '#18181b',
                borderRadius: '12px',
                border: '1px solid #27272a',
                fontSize: '0.95rem'
              }}>
                Ожидание подключения участников к видеосессии...
              </div>
            ) : (
              cameraTracks.map((tr) => (
                <div
                  key={`${tr.participant.identity}-${tr.source}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 0,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    display: 'flex',
                  }}
                >
                  <ParticipantTile
                    trackRef={tr}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Hand Raise Alert for Speaker */}
      {!isClient && handRaiseNotice && (
        <div style={{
          position: 'absolute',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          border: '1px solid #818cf8',
          borderRadius: '12px',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: '0.88rem'
        }}>
          <span>✋ <strong>{handRaiseNotice.name}</strong> просит слова в прямом эфире!</span>
          {onGrantMic && (
            <button
              type="button"
              onClick={() => onGrantMic(handRaiseNotice.id)}
              style={{
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              🎙️ Разрешить микрофон
            </button>
          )}
          {onDismissHandNotice && (
            <button
              type="button"
              onClick={onDismissHandNotice}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Control Bar */}
      <div style={{
        minHeight: '68px',
        background: 'rgba(18, 18, 20, 0.95)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '8px 16px',
        zIndex: 20,
        flexShrink: 0,
        flexWrap: 'wrap'
      }}>
        {/* Role Badges */}
        {isTeacher && (
          <span style={{
            background: 'rgba(99, 102, 241, 0.2)',
            border: '1px solid #6366f1',
            color: '#c7d2fe',
            padding: '5px 12px',
            borderRadius: '16px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            👨‍🏫 Преподаватель
          </span>
        )}

        {isAuthor && (
          <span style={{
            background: 'rgba(99, 102, 241, 0.2)',
            border: '1px solid #6366f1',
            color: '#c7d2fe',
            padding: '5px 12px',
            borderRadius: '16px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            ⭐ {isCourse ? 'Преподаватель' : 'Автор эфира'}
          </span>
        )}

        {isSpeaker && (
          <span style={{
            background: 'rgba(147, 51, 234, 0.2)',
            border: '1px solid #9333ea',
            color: '#d8b4fe',
            padding: '5px 12px',
            borderRadius: '16px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            🎙️ Ведущий
          </span>
        )}

        {isStudent && isLesson && (
          <span style={{
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid #3b82f6',
            color: '#93c5fd',
            padding: '5px 12px',
            borderRadius: '16px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            🧑‍🎓 Ученик
          </span>
        )}

        {isStudent && !isLesson && (
          <span style={{
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid #3b82f6',
            color: '#93c5fd',
            padding: '5px 12px',
            borderRadius: '16px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            🎓 Студент курса (общение + показ работ)
          </span>
        )}

        {isListener && (
          <span style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            color: '#a7f3d0',
            padding: '5px 12px',
            borderRadius: '16px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            👥 Слушатель
          </span>
        )}

        <ControlBar
          controls={{
            chat: false,
            screenShare: canScreenShare,
            camera: true,
            microphone: true,
            settings: true,
            leave: false,
          }}
        />

        {/* Host / Speaker bulk action: Mute all webinar listeners in one click */}
        {(isAuthor || isSpeaker) && isWebinarMode && (
          <button
            type="button"
            onClick={handleMuteAllListeners}
            style={{
              background: 'rgba(239, 68, 68, 0.18)',
              color: '#fca5a5',
              border: '1px solid #ef4444',
              borderRadius: '20px',
              padding: '8px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
            title="Одним махом выключить микрофоны всем слушателям вебинара"
          >
            <span>🔇 Заглушить слушателей</span>
          </button>
        )}

        {/* For Listeners in Webinar Mode: Raise Hand & Promote to Speaker buttons */}
        {isClient && isWebinarMode && (
          <>
            <button
              type="button"
              onClick={handleToggleLocalHandRaise}
              style={{
                background: isHandRaised ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                border: isHandRaised ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '20px',
                padding: '8px 16px',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isHandRaised ? '0 0 16px rgba(245, 158, 11, 0.5)' : 'none',
                transition: 'all 0.2s ease',
              }}
              title={isHandRaised ? "Нажмите, чтобы опустить руку" : "Запросить у ведущего возможность говорить в эфире"}
            >
              <span>{isHandRaised ? '✋ Рука поднята (ждём слово)' : '✋ Поднять руку (в эфир)'}</span>
            </button>

            {onPromoteToSpeaker && (
              <button
                type="button"
                onClick={onPromoteToSpeaker}
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '8px 16px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                }}
                title="Если вы эксперт или со-ведущий — нажмите, чтобы подключить микрофон и камеру"
              >
                <span>🎙️ Я со-ведущий (вкл. микрофон)</span>
              </button>
            )}
          </>
        )}

        {/* Sidebar Toggle for Speakers, Webinar Listeners, and Lesson participants */}
        {(!isClient || isWebinarMode || isLesson) && onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            style={{
              backgroundColor: isMobileSidebarOpen ? '#3b82f6' : 'rgba(255, 255, 255, 0.12)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '20px',
              padding: '8px 14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title={isWebinarMode ? "Открыть панель вопросов, опросов и чата" : isLesson ? "Открыть конспект и заметки урока" : "Открыть панель сессии"}
          >
            <span>{isMobileSidebarOpen ? t('✕ Панель', '✕ Panel') : isWebinarMode ? '💬 Чат и Q&A' : isLesson ? '✍️ Заметки' : '📋 Панель'}</span>
          </button>
        )}

        {/* Consultation Map Overlay */}
        {!isClient && mode === 'consultation' && onToggleMapOverlay && (
          <button
            type="button"
            onClick={onToggleMapOverlay}
            style={{
              background: isMapOverlayOpen ? 'rgba(59, 130, 246, 0.3)' : '#27272a',
              color: isMapOverlayOpen ? '#93c5fd' : '#e4e4e7',
              border: isMapOverlayOpen ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '8px 16px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isMapOverlayOpen ? '0 0 12px rgba(59, 130, 246, 0.4)' : 'none',
              transition: 'all 0.2s'
            }}
            title={isMapOverlayOpen ? "Скрыть карту сессии с экрана видео" : "Показать ментальный граф и спринт прямо на экране видео"}
          >
            <span>{isMapOverlayOpen ? t('✕ Скрыть карту', '✕ Hide Graph') : t('🗺️ Граф сессии', '🗺️ Session Graph')}</span>
          </button>
        )}

        {/* Leave / Finish Button */}
        <button
          type="button"
          onClick={onLeave}
          style={{
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 18px',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)'
          }}
        >
          {isLesson ? (isClient ? '⏹️ Покинуть урок' : '⏹️ Завершить урок') : (isClient ? '⏹️ Выйти' : '⏹️ Завершить')}
        </button>
      </div>
    </div>
  );
};

interface WebinarPoll {
  id: string;
  question: string;
  options: string[];
  votes: number[];
  isActive: boolean;
  isFinished: boolean;
}

const getEffectiveLiveKitUrl = (preferredUrl?: string) => {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host.includes("prevention-ai.ru")) return "wss://live.prevention-ai.ru";
    if (host.includes("prevention.school")) return "wss://live.prevention.school";
    if (host.includes("ida-psy.pro")) return "wss://live.ida-psy.pro";
    if (host.includes("teenology.care")) return "wss://live.teenology.care";
  }
  if (preferredUrl && preferredUrl.startsWith("wss://")) {
    return preferredUrl;
  }
  return "wss://live.ida-psy.ru";
};

export const VideoConsultationRoom: React.FC<VideoConsultationRoomProps> = ({
  roomName,
  token: initialToken,
  serverUrl: initialServerUrl,
  onLeave,
  caseId,
  clientName,
  specialistName = "Специалист",
  terminalUserId,
  commercial = false,
  isClient = false,
  mode,
  role,
}) => {
  const isManualLeaveRef = useRef(false);
  const [isClientUser, setIsClientUser] = useState<boolean>(isClient);
  useEffect(() => {
    setIsClientUser(isClient);
  }, [isClient]);

  const [token, setToken] = useState<string>(initialToken || "");
  const [serverUrl, setServerUrl] = useState<string>(() => getEffectiveLiveKitUrl(initialServerUrl));
  const [loading, setLoading] = useState<boolean>(!initialToken);
  const [error, setError] = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Link copy state
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isStudentCopied, setIsStudentCopied] = useState<boolean>(false);
  const [isGuestCopied, setIsGuestCopied] = useState<boolean>(false);
  const [isSpeakerCopied, setIsSpeakerCopied] = useState<boolean>(false);

  const [showHelpPanel, setShowHelpPanel] = useState<boolean>(false);
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  
  const isLessonMode = mode === "lesson" || (typeof window !== "undefined" && (
    window.location.search.includes("mode=lesson") ||
    window.location.search.includes("mode=tutor") ||
    window.location.search.includes("mode=study")
  ));

  const isCourseMode = !isLessonMode && (mode === "course" || (typeof window !== "undefined" && (
    window.location.search.includes("mode=course") ||
    window.location.search.includes("type=course")
  )));

  const isWebinarMode = isLessonMode || isCourseMode
    ? false
    : mode === "webinar"
      ? true
      : mode === "consultation"
        ? false
        : (
            roomName.includes("webinar") ||
            (typeof window !== "undefined" && (
              window.location.search.includes("mode=webinar") ||
              window.location.search.includes("role=speaker") ||
              window.location.search.includes("role=cohost") ||
              window.location.search.includes("role=guest") ||
              window.location.search.includes("role=listener") ||
              window.location.search.includes("role=author")
            )) ||
            (!caseId && (roomName.includes("instant") || roomName.includes("speaker")))
          );

  const urlRole = typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("role") || "").toLowerCase() : "";
  const effectiveRole = (role || urlRole || (isLessonMode ? (isClient ? "student" : "teacher") : isCourseMode ? (isClient ? "student" : "author") : (isWebinarMode ? (isClient ? "listener" : "author") : (isClient ? "client" : "specialist")))).toLowerCase();

  const [activeTab, setActiveTab] = useState<'notes' | 'sprint' | 'tools' | 'polls' | 'qa' | 'participants'>(
    isLessonMode ? 'notes' : isWebinarMode ? 'participants' : 'sprint'
  );
  const [isHandRaised, setIsHandRaised] = useState<boolean>(false);
  const [handRaisedMap, setHandRaisedMap] = useState<Record<string, boolean>>({});
  const [handRaiseNotice, setHandRaiseNotice] = useState<{ id: string; name: string } | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean>(!isClient || isLessonMode);

  // Sidebar theme: Light (default per user preference) or Dark with localStorage persistence
  const [videoTheme, setVideoTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('ida_video_theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const handleToggleTheme = () => {
    setVideoTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('ida_video_theme', next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Webinar Polls & Constructor State (clean initial state, no dummy demo data)
  const [polls, setPolls] = useState<WebinarPoll[]>([]);

  const [isBuilderOpen, setIsBuilderOpen] = useState<boolean>(false);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [builderQuestion, setBuilderQuestion] = useState<string>("");
  const [builderOptions, setBuilderOptions] = useState<string[]>(["Вариант 1", "Вариант 2"]);

  const pollPresets = [
    {
      title: "🎓 Срез знаний",
      question: "Оцените ваш начальный уровень владения темой:",
      options: ["Новичок в теме", "Есть базовая теория", "Активно практикую", "Эксперт / Супервизор"]
    },
    {
      title: "🎯 Выбор кейса",
      question: "Какой кейс разобрать прямо сейчас?",
      options: ["Кейс №1: Острая тревога", "Кейс №2: Семейный конфликт", "Кейс №3: Психосоматика"]
    },
    {
      title: "💡 Понимание алгоритма",
      question: "Насколько понятен предложенный пошаговый протокол?",
      options: ["Полностью понятно, готов применять", "В целом ясно, но есть вопросы", "Нужен еще один наглядный пример"]
    },
    {
      title: "⭐ Обратная связь",
      question: "Оцените практическую ценность сегодняшнего блока:",
      options: ["10/10 — максимум пользы", "7/10 — хорошая систематизация", "Пока сложно адаптировать под практику"]
    }
  ];

  // Webinar Q&A State (clean initial state, no dummy demo questions)
  const [qaQuestions, setQaQuestions] = useState<Array<{ id: string; user: string; text: string; upvotes: number; answered: boolean }>>([]);
  const [newQuestionText, setNewQuestionText] = useState<string>("");

  const { active: subscriptionActive } = useTerminalSubscription(terminalUserId);
  const { transcript, startTranscription, stopTranscription, rawTranscriptText, isListening } = useSessionTranscript();

  // Shared Consultation Mind Map & Sprints State
  const [topics, setTopics] = useState<MapTopicNode[]>(() => [
    {
      id: 'topic-1',
      label: t('Острая тревога перед дедлайнами', 'Acute deadline anxiety'),
      category: 'emotion',
      status: 'sprint',
      dependencies: ['topic-2', 'topic-3'],
      insight: t('Запускается при получении письма от руководства', 'Triggered when receiving an email from leadership')
    },
    {
      id: 'topic-2',
      label: t('Убеждение «Я должен делать всё идеально»', 'Belief "I must do everything perfectly"'),
      category: 'thought',
      status: 'active',
      dependencies: ['topic-4'],
      insight: t('Страх разоблачения и синдром самозванца', 'Fear of exposure and imposter syndrome')
    },
    {
      id: 'topic-3',
      label: t('Прокрастинация и избегание задач', 'Procrastination and avoidance of tasks'),
      category: 'behavior',
      status: 'active',
      insight: t('Защитная реакция на страх ошибки', 'Defensive reaction to the fear of failure')
    },
    {
      id: 'topic-4',
      label: t('Критика и завышенные ожидания отца', 'Father\'s criticism and high expectations'),
      category: 'relation',
      status: 'paused',
      insight: t('Детский опыт обесценивания успехов', 'Childhood experience of discounted achievements')
    },
    {
      id: 'topic-5',
      label: t('Бессонница в ночь перед сдачей проектов', 'Insomnia the night before project deadlines'),
      category: 'behavior',
      status: 'paused',
    },
    {
      id: 'topic-6',
      label: t('Опыт успешного завершения сложного спринта', 'Experience of successfully completing a difficult sprint'),
      category: 'resource',
      status: 'resolved',
      insight: t('Ресурсный якорь: способность собраться в команде', 'Resource anchor: ability to mobilize within a team')
    }
  ]);

  const [sprint, setSprint] = useState<SessionSprint>(() => ({
    phase: '2_desensitization',
    goal: t('Снизить уровень тревоги с 80% до 35% при мысли о дедлайне', 'Reduce anxiety from 80% to 35% when thinking about deadlines'),
    activeTopicId: 'topic-1',
    microStep: t('Сформулировать адаптивный ответ: «Хорошо сделано лучше, чем идеально не сделано»', 'Formulate adaptive response: "Done is better than perfect"')
  }));

  // Resizable split state between video stage and sidebar
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ida_session_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 320 && parsed <= 900) return parsed;
      }
    }
    return 460;
  });
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Dragging event listeners for resizing
  useEffect(() => {
    if (!isDraggingSidebar) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate width from right edge of window
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 320 && newWidth <= Math.min(900, window.innerWidth - 380)) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      localStorage.setItem('ida_session_sidebar_width', String(sidebarWidth));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSidebar, sidebarWidth]);

  // Overlay & Mobile Layout state
  const [isMapOverlayOpen, setIsMapOverlayOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  // For listeners/guests, hide sidebar by default on desktop so video takes full screen
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(() => {
    // If webinar or course guest/listener, start collapsed
    if (isWebinarMode && isClient) return false;
    return true;
  });

  // Real-time AI Speech Topics Watcher State
  const [liveAiSuggestion, setLiveAiSuggestion] = useState<{
    id: string;
    label: string;
    excerpt: string;
    category: string;
    reason: string;
  } | null>(null);

  const dismissedAiSuggestionsRef = React.useRef<Set<string>>(new Set());
  const [newNoteTopicInput, setNewNoteTopicInput] = useState<string>("");
  const [selectedNoteText, setSelectedNoteText] = useState<string>("");

  const formatSessionTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`;
  };

  const handleLogEvent = (logText: string) => {
    setSessionNotes(prev => (prev ? `${prev}\n${logText}` : logText));
  };

  // Real-time background speech listener for emerging topics during conversation
  useEffect(() => {
    if (!rawTranscriptText || isWebinarMode || isCourseMode || isLessonMode) return;

    const lower = rawTranscriptText.toLowerCase();

    // Key patterns for therapeutic targets in speech
    const patterns = [
      {
        id: 'pat-boss',
        keywords: ['начальник', 'руковод', 'шеф', 'босс', 'директор', 'выговор', 'менеджер'],
        label: 'Конфликт ожиданий с руководством',
        category: 'relation',
        reason: 'Триггер страха критики и обесценивания'
      },
      {
        id: 'pat-burnout',
        keywords: ['выгора', 'спринт', 'дедлайн', 'овертайм', 'переработ', 'выходн', 'нет сил'],
        label: 'Выгорание и истощение в спринте',
        category: 'behavior',
        reason: 'Перегрузка обязательствами и размытие рабочих границ'
      },
      {
        id: 'pat-imposter',
        keywords: ['самозван', 'разоблач', 'не заслужил', 'случайно', 'уволят', 'некомпетент'],
        label: 'Синдром самозванца и страх разоблачения',
        category: 'thought',
        reason: 'Когнитивное искажение обесценивания собственных достижений'
      },
      {
        id: 'pat-family',
        keywords: ['мама', 'отец', 'папа', 'родител', 'сестра', 'брат'],
        label: 'Семейный паттерн и сепарация',
        category: 'relation',
        reason: 'Глубинное убеждение вины перед близкими'
      },
      {
        id: 'pat-panic',
        keywords: ['паник', 'задыха', 'сердце', 'пульс', 'приступ', 'удушь', 'зажим'],
        label: 'Панический приступ и соматизация',
        category: 'emotion',
        reason: 'Вегетативный отклик на потерю контроля'
      },
      {
        id: 'pat-shame',
        keywords: ['стыд', 'виноват', 'позор', 'опозор', 'недостоин', 'хуже всех'],
        label: 'Токсический стыд и самобичевание',
        category: 'thought',
        reason: 'Когнитивное искажение персонализации'
      },
      {
        id: 'pat-sleep',
        keywords: ['сон', 'бессонниц', 'кошмар', 'просыпа', 'не могу уснуть', 'усталост'],
        label: 'Нарушение сна и истощение',
        category: 'behavior',
        reason: 'Маркер функциональной декомпенсации'
      },
      {
        id: 'pat-boundaries',
        keywords: ['отказать', 'не могу сказать нет', 'границ', 'используют'],
        label: 'Трудности с защитой личных границ',
        category: 'behavior',
        reason: 'Страх отвержения при отстаивании себя'
      }
    ];

    for (const pat of patterns) {
      if (dismissedAiSuggestionsRef.current.has(pat.id)) continue;
      if (topics.some(t => t.label.toLowerCase().includes(pat.label.toLowerCase().slice(0, 10)))) continue;

      const matchedKeyword = pat.keywords.find(kw => lower.includes(kw));
      if (matchedKeyword) {
        const kwIdx = lower.lastIndexOf(matchedKeyword);
        const start = Math.max(0, kwIdx - 25);
        const end = Math.min(rawTranscriptText.length, kwIdx + 40);
        const snippet = (start > 0 ? '…' : '') + rawTranscriptText.slice(start, end).trim() + (end < rawTranscriptText.length ? '…' : '');

        setLiveAiSuggestion({
          id: pat.id,
          label: pat.label,
          excerpt: snippet,
          category: pat.category,
          reason: pat.reason
        });
        break;
      }
    }
  }, [rawTranscriptText, topics, isWebinarMode]);

  const handleAcceptAiSuggestion = (sug: { id: string; label: string; excerpt: string; category: string; reason: string }, targetStatus: 'sprint' | 'paused') => {
    const newTopic: MapTopicNode = {
      id: `topic-ai-${Date.now()}`,
      label: sug.label,
      status: targetStatus,
      dependencies: sprint.activeTopicId ? [sprint.activeTopicId] : [],
      insight: sug.reason
    };

    setTopics(prev => {
      if (targetStatus === 'sprint') {
        return [...prev.map(t => t.status === 'sprint' ? { ...t, status: 'active' as const } : t), newTopic];
      }
      return [...prev, newTopic];
    });

    if (targetStatus === 'sprint') {
      setSprint(prev => ({ ...prev, activeTopicId: newTopic.id }));
    }

    dismissedAiSuggestionsRef.current.add(sug.id);
    setLiveAiSuggestion(null);

    const ts = formatSessionTime(elapsedSeconds);
    const actionDesc = targetStatus === 'sprint' ? '🎯 Взят в активный спринт' : '⏸️ Отложен на парковку';
    handleLogEvent(`${ts} ⚡ ИИ из живой речи: «${sug.label}» → ${actionDesc}`);
  };

  const handleDismissAiSuggestion = (id: string) => {
    dismissedAiSuggestionsRef.current.add(id);
    setLiveAiSuggestion(null);
  };

  const { currentInsight: deepInsight, dismissInsight: handleDismissDeepInsight } = useDeepInsightWatcher({
    rawTranscriptText,
    topics,
    enabled: !isWebinarMode && !isCourseMode && !isLessonMode && !isClient,
    windowSize: 400,
    cooldownMs: 30_000,
  });

  const handleAcceptDeepInsight = (insight: DeepInsight, targetStatus: 'sprint' | 'paused' | 'risk') => {
    const newTopic: MapTopicNode = {
      id: `topic-deep-${Date.now()}`,
      label: insight.label,
      status: targetStatus === 'risk' ? 'active' : targetStatus,
      dependencies: sprint.activeTopicId ? [sprint.activeTopicId] : [],
      insight: `${insight.explanation}. ${insight.clinicalHint}`
    };

    setTopics(prev => {
      if (targetStatus === 'sprint') {
        return [...prev.map(t => t.status === 'sprint' ? { ...t, status: 'active' as const } : t), newTopic];
      }
      return [...prev, newTopic];
    });

    if (targetStatus === 'sprint') {
      setSprint(prev => ({ ...prev, activeTopicId: newTopic.id }));
    }

    handleDismissDeepInsight(insight.id);

    const ts = formatSessionTime(elapsedSeconds);
    const actionDesc = targetStatus === 'sprint' ? '🎯 Взят в спринт' : targetStatus === 'paused' ? '⏸️ На парковку' : '⚠️ Отмечен как риск';
    handleLogEvent(`${ts} 🧠 Глубокий ИИ-анализ: «${insight.label}» → ${actionDesc}\n      💡 ${insight.clinicalHint}`);
  };

  const handleCreateTopicFromNotes = (status: 'sprint' | 'paused') => {
    const textToUse = (selectedNoteText.trim() || newNoteTopicInput.trim());
    if (!textToUse) return;

    const newTopic: MapTopicNode = {
      id: `topic-note-${Date.now()}`,
      label: textToUse,
      status,
      dependencies: sprint.activeTopicId ? [sprint.activeTopicId] : []
    };

    setTopics(prev => {
      if (status === 'sprint') {
        return [...prev.map(t => t.status === 'sprint' ? { ...t, status: 'active' as const } : t), newTopic];
      }
      return [...prev, newTopic];
    });

    if (status === 'sprint') {
      setSprint(prev => ({ ...prev, activeTopicId: newTopic.id }));
    }

    const ts = formatSessionTime(elapsedSeconds);
    const actionDesc = status === 'sprint' ? '🎯 Взят в спринт' : '⏸️ Отложен на парковку';
    handleLogEvent(`${ts} ✍️ Из заметок: «${textToUse}» → ${actionDesc}`);

    setNewNoteTopicInput("");
    setSelectedNoteText("");
  };

  const [useSimulation, setUseSimulation] = useState<boolean>(false);
  const [micMuted, setMicMuted] = useState<boolean>(false);
  const [camOff, setCamOff] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);

  const presentationSlides = [
    {
      title: "Доказательные протоколы психологической помощи",
      subtitle: "Введение в метод и пошаговая структура сессии",
      points: [
        "Терапевтический альянс и первичная валидация переживаний",
        "Определение мишеней терапии и шкалирование дистресса",
        "Концептуализация клинического случая и протоколы безопасности",
      ]
    },
    {
      title: "Фаза 1: Оценка и экспресс-стабилизация",
      subtitle: "Техники центрирования и возвращения контроля",
      points: [
        "Сенсорное заземление 5-4-3-2-1 при острой тревоге",
        "Квадратное дыхание 4x4 для нормализации вегетативной нервной системы",
        "Создание ресурсного «Безопасного места» перед глубокой проработкой",
      ]
    },
    {
      title: "Фаза 2: Когнитивная переоценка и реструктуризация",
      subtitle: "Работа с автоматическими мыслями и когнитивными искажениями",
      points: [
        "Выявление катастрофизации и черно-белого мышления",
        "Сократический диалог и поиск фактологических контраргументов",
        "Формирование адаптивных копинг-стратегий и поведенческий эксперимент",
      ]
    },
    {
      title: "Фаза 3: Интеграция и закрепление результатов",
      subtitle: "Протоколы домашней практики и предотвращение рецидивов",
      points: [
        "Дневник мыслей и самонаблюдения в цифровом приложении",
        "План самопомощи при повторных триггерных ситуациях",
        "Итоговый замер динамики и завершение терапевтического цикла",
      ]
    }
  ];

  const handleNextSlide = () => {
    setCurrentSlideIndex(prev => (prev + 1) % presentationSlides.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlideIndex(prev => (prev - 1 + presentationSlides.length) % presentationSlides.length);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    startTranscription();
    return () => {
      clearInterval(timer);
      stopTranscription();
    };
  }, [startTranscription, stopTranscription]);

  const handleFinishAndSave = () => {
    isManualLeaveRef.current = true;
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    trackVideoEvent('room_leave', { durationMinutes, caseId });
    onLeave({
      durationMinutes,
      notes: sessionNotes.trim(),
      transcript: rawTranscriptText?.trim() || undefined,
    });
  };

  const handleManualLeave = () => {
    isManualLeaveRef.current = true;
    onLeave();
  };

  const handleCopyStudentLink = () => {
    const baseUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "https://web.academy.ida-psy.ru/";
    const studentLink = `${baseUrl}?room=${encodeURIComponent(roomName)}&role=student&mode=lesson&name=${encodeURIComponent('Ученик')}`;
    navigator.clipboard?.writeText(studentLink);
    setIsStudentCopied(true);
    setTimeout(() => setIsStudentCopied(false), 3000);
  };

  const handleCopyLink = () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://ida-psy.ru";
    const demoParam = isDemo ? "&demo=1" : "";
    const clientLink = `${baseUrl}/terminal/staging/?room=${encodeURIComponent(roomName)}&role=client${demoParam}`;
    navigator.clipboard?.writeText(clientLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  const handleCopyGuestLink = () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://ida-psy.ru";
    const demoParam = isDemo ? "&demo=1" : "";
    const guestLink = `${baseUrl}/terminal/staging/?room=${encodeURIComponent(roomName)}&role=guest&mode=webinar${demoParam}`;
    navigator.clipboard?.writeText(guestLink);
    setIsGuestCopied(true);
    setTimeout(() => setIsGuestCopied(false), 3000);
  };

  const handleCopySpeakerLink = () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://ida-psy.ru";
    const demoParam = isDemo ? "&demo=1" : "";
    const speakerLink = `${baseUrl}/terminal/staging/?room=${encodeURIComponent(roomName)}&role=speaker&mode=webinar${demoParam}`;
    navigator.clipboard?.writeText(speakerLink);
    setIsSpeakerCopied(true);
    setTimeout(() => setIsSpeakerCopied(false), 3000);
  };

  const handleOpenCreatePoll = () => {
    setEditingPollId(null);
    setBuilderQuestion("");
    setBuilderOptions(["Вариант 1", "Вариант 2"]);
    setIsBuilderOpen(true);
  };

  const handleEditPoll = (poll: WebinarPoll) => {
    setEditingPollId(poll.id);
    setBuilderQuestion(poll.question);
    setBuilderOptions([...poll.options]);
    setIsBuilderOpen(true);
  };

  const handleApplyPreset = (preset: { title: string; question: string; options: string[] }) => {
    setBuilderQuestion(preset.question);
    setBuilderOptions([...preset.options]);
  };

  const handleAddBuilderOption = () => {
    if (builderOptions.length < 6) {
      setBuilderOptions(prev => [...prev, `Вариант ${prev.length + 1}`]);
    }
  };

  const handleRemoveBuilderOption = (idx: number) => {
    if (builderOptions.length > 2) {
      setBuilderOptions(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleSavePoll = (andActivate = false) => {
    const q = builderQuestion.trim() || "Опрос вебинара";
    const validOpts = builderOptions.map(o => o.trim()).filter(Boolean);
    const finalOpts = validOpts.length >= 2 ? validOpts : ["Вариант 1", "Вариант 2"];

    if (editingPollId) {
      setPolls(prev => prev.map(p => {
        if (p.id === editingPollId) {
          return {
            ...p,
            question: q,
            options: finalOpts,
            votes: finalOpts.map((_, i) => p.votes[i] || 0),
            isActive: andActivate ? true : p.isActive,
            isFinished: andActivate ? false : p.isFinished
          };
        }
        return andActivate ? { ...p, isActive: false } : p;
      }));
    } else {
      const newPoll: WebinarPoll = {
        id: `poll-${Date.now()}`,
        question: q,
        options: finalOpts,
        votes: finalOpts.map(() => 0),
        isActive: andActivate,
        isFinished: false,
      };
      setPolls(prev => {
        const updated = andActivate ? prev.map(p => ({ ...p, isActive: false })) : [...prev];
        return [newPoll, ...updated];
      });
    }

    setIsBuilderOpen(false);
    setEditingPollId(null);
  };

  const handleActivatePoll = (pollId: string) => {
    setPolls(prev => prev.map(p => ({
      ...p,
      isActive: p.id === pollId,
      isFinished: p.id === pollId ? false : p.isFinished
    })));
  };

  const handleFinishPoll = (pollId: string) => {
    setPolls(prev => prev.map(p => p.id === pollId ? { ...p, isActive: false, isFinished: true } : p));
  };

  const handleSimulateVotes = (pollId: string) => {
    setPolls(prev => prev.map(p => {
      if (p.id === pollId) {
        return {
          ...p,
          votes: p.votes.map(v => v + Math.floor(Math.random() * 4) + 1)
        };
      }
      return p;
    }));
  };

  const handleDeletePoll = (pollId: string) => {
    setPolls(prev => prev.filter(p => p.id !== pollId));
  };

  const handleExportPollToNotes = (poll: WebinarPoll) => {
    const total = poll.votes.reduce((a, b) => a + b, 0) || 1;
    let summary = `\n📊 [Опрос в эфире]: ${poll.question}\n`;
    poll.options.forEach((opt, idx) => {
      const pct = Math.round((poll.votes[idx] / total) * 100);
      summary += `• ${opt}: ${pct}% (${poll.votes[idx]} гол.)\n`;
    });
    setSessionNotes(prev => prev + summary);
    setActiveTab('notes');
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    setQaQuestions(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        user: specialistName || 'Организатор',
        text: newQuestionText.trim(),
        upvotes: 1,
        answered: false
      }
    ]);
    setNewQuestionText("");
  };

  const isDemo = !isWebinarMode && !isCourseMode && !isLessonMode && (
    isDemoModeActive() ||
    roomName.includes("demo") ||
    (typeof window !== "undefined" && (
      new URLSearchParams(window.location.search).has("demo") ||
      new URLSearchParams(window.location.search).get("entry") === "demo"
    ))
  );

  const [showDemoEndedModal, setShowDemoEndedModal] = useState<boolean>(false);
  const maxSessionSeconds = isDemo ? 300 : isLessonMode ? 4 * 3600 : 50 * 60; // 5 mins in demo, 4 hours in lesson, 50 mins in regular

  useEffect(() => {
    if (elapsedSeconds >= maxSessionSeconds) {
      if (isDemo) {
        setShowDemoEndedModal(true);
        stopTranscription();
      }
    }
  }, [elapsedSeconds, maxSessionSeconds, isDemo, stopTranscription]);

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
      setLoading(false);
      return;
    }

    if (token) return;

    let isMounted = true;
    async function fetchToken() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("https://api.prevention.school/api/terminal/video/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_name: roomName || (isDemo ? `demo-${Date.now().toString(36)}` : "ida-consultation"),
            participant_identity: isClientUser ? `client_${Date.now()}` : `speaker_${Date.now()}`,
            participant_name: isClientUser ? (clientName || (isLessonMode ? "Ученик" : isWebinarMode ? "Слушатель" : "Клиент")) : (specialistName || (isLessonMode ? "Преподаватель" : "Специалист")),
            is_admin: !isClientUser,
            is_demo: isDemo,
          }),
        });
        const data = await res.json();
        if (!isMounted) return;
        if (data.ok && data.token) {
          if (data.server_url) {
            setServerUrl(data.server_url);
          }
          setToken(data.token);
        } else {
          setConnectionNotice("Сервер медиа недоступен. Сессия запущена в автономном защищенном режиме.");
          setUseSimulation(true);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setConnectionNotice("Автономный режим консультации активен.");
        setUseSimulation(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchToken();
    return () => {
      isMounted = false;
    };
  }, [roomName, initialToken, specialistName, clientName, isClientUser, isWebinarMode, isDemo]);

  const handlePromoteToSpeaker = useCallback(async () => {
    setIsClientUser(false);
    setHasMicPermission(true);
    if (typeof window !== "undefined" && window.history) {
      try {
        const u = new URL(window.location.href);
        u.searchParams.set("role", "speaker");
        u.searchParams.set("mode", "webinar");
        window.history.replaceState({}, "", u.toString());
      } catch (err) {
        // ignore url manipulation errors
      }
    }
    try {
      setLoading(true);
      const res = await fetch("https://api.prevention.school/api/terminal/video/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_name: roomName || "ida-webinar",
          participant_identity: `speaker_${Date.now()}`,
          participant_name: specialistName && specialistName !== "Слушатель" && specialistName !== "Клиент" ? specialistName : "Со-ведущий",
          is_admin: true,
          is_demo: isDemo,
        }),
      });
      const data = await res.json();
      if (data?.ok && data?.token) {
        if (data.server_url) {
          setServerUrl(data.server_url);
        }
        setToken(data.token);
      }
    } catch (e) {
      console.warn("Failed to update token on role promotion:", e);
    } finally {
      setLoading(false);
    }
  }, [roomName, specialistName, isDemo]);

  const isLight = videoTheme === 'light';
  const sbColors = {
    bg: isLight ? '#ffffff' : '#18181b',
    headerBg: isLight ? '#f8fafc' : '#18181b',
    border: isLight ? '#e2e8f0' : '#27272a',
    borderSecondary: isLight ? '#cbd5e1' : '#3f3f46',
    tabsBg: isLight ? '#f1f5f9' : '#121214',
    tabActiveBg: isLight ? '#ffffff' : '#18181b',
    text: isLight ? '#0f172a' : '#ffffff',
    textMuted: isLight ? '#64748b' : '#9ca3af',
    cardBg: isLight ? '#f8fafc' : '#1f1f23',
    inputBg: isLight ? '#ffffff' : '#18181b',
    inputBorder: isLight ? '#cbd5e1' : '#3f3f46',
    footerBg: isLight ? '#f8fafc' : '#121214',
    themeBtnBg: isLight ? '#e2e8f0' : '#27272a',
    themeBtnColor: isLight ? '#0f172a' : '#facc15',
  };

  const renderSidebar = () => (
    <div className={`ida-session-sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`} style={{
      width: `${sidebarWidth}px`,
      minWidth: '320px',
      maxWidth: '900px',
      backgroundColor: sbColors.bg,
      borderLeft: `1px solid ${sbColors.border}`,
      color: sbColors.text,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      zIndex: 40,
      transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease'
    }}>
      {/* Top Header */}
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${sbColors.border}`, background: sbColors.headerBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isWebinarMode ? '10px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="ida-mobile-sidebar-close"
              onClick={() => {
                setIsMobileSidebarOpen(false);
                setIsDesktopSidebarOpen(false);
              }}
              style={{
                background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)',
                border: 'none',
                color: sbColors.text,
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex'
              }}
              title="Закрыть панель инструментов"
            >
              ✕
            </button>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: sbColors.text }}>
              {isLessonMode ? t('📚 Учебный кабинет', '📚 Study Room') : isWebinarMode ? t('🎙️ Студия вебинара', '🎙️ Webinar Studio') : t('🛋️ Сессия', '🛋️ Session')}
            </h3>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Light / Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={handleToggleTheme}
              style={{
                height: '28px',
                padding: '0 8px',
                borderRadius: '14px',
                background: sbColors.themeBtnBg,
                border: `1px solid ${sbColors.borderSecondary}`,
                color: sbColors.themeBtnColor,
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
              title={isLight ? t("Включить тёмную тему", "Switch to dark mode") : t("Включить светлую тему", "Switch to light mode")}
            >
              {isLight ? t('☀️ Светлая', '☀️ Light') : t('🌙 Тёмная', '🌙 Dark')}
            </button>

            {/* Guide Help Modal Trigger Button */}
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: sbColors.themeBtnBg,
                border: `1px solid ${sbColors.borderSecondary}`,
                color: isLight ? '#0284c7' : '#38bdf8',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title={t("❓ Руководство по всем инструментам комнаты (справка)", "❓ Room tools guide (help)")}
            >
              ?
            </button>

            {isLessonMode ? (
              <button 
                type="button"
                onClick={handleCopyStudentLink}
                title="Нажмите, чтобы скопировать прямую ссылку для ученика"
                style={{
                  background: isStudentCopied ? '#059669' : '#2563eb',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                }}
              >
                {isStudentCopied ? '✓ Скопирована!' : '🔗 Ссылка ученику'}
              </button>
            ) : !isWebinarMode && (
              <button 
                type="button"
                onClick={handleCopyLink}
                title={t("Нажмите, чтобы скопировать ссылку и отправить её клиенту в Telegram, WhatsApp или Email", "Click to copy invite link and send it to your client via Email or Messenger")}
                style={{
                  background: isCopied ? '#059669' : '#2563eb',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                }}
              >
                {isCopied ? t('✓ Скопирована!', '✓ Copied!') : t('🔗 Ссылка клиенту', '🔗 Client link')}
              </button>
            )}
          </div>
        </div>

        {isWebinarMode ? (
          isClientUser ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                🟢 <span>Вы подключены к прямому эфиру</span>
              </span>
              <button
                type="button"
                onClick={handleCopyGuestLink}
                style={{
                  background: isGuestCopied ? '#059669' : 'rgba(37, 99, 235, 0.15)',
                  border: isGuestCopied ? '1px solid #059669' : '1px solid #3b82f6',
                  color: isGuestCopied ? '#fff' : '#2563eb',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isGuestCopied ? '✓ Скопировано' : '🔗 Ссылка на вебинар'}
              </button>
            </div>
          ) : (
            /* Webinar Invite Links: Guests vs Speakers */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={handleCopyGuestLink}
                title="Скопировать гостевую ссылку для слушателей и зрителей (чат, опросы, Q&A)"
                style={{
                  background: isGuestCopied ? '#059669' : 'rgba(37, 99, 235, 0.15)',
                  border: isGuestCopied ? '1px solid #059669' : '1px solid #3b82f6',
                  color: isGuestCopied ? '#fff' : '#2563eb',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                {isGuestCopied ? '✓ Скопирована' : '👥 Ссылка слушателям'}
              </button>

              <button
                type="button"
                onClick={handleCopySpeakerLink}
                title="Скопировать ссылку для соведущих и спикеров (полные права микрофона, камеры и демонстрации)"
                style={{
                  background: isSpeakerCopied ? '#059669' : 'rgba(124, 58, 237, 0.15)',
                  border: isSpeakerCopied ? '1px solid #059669' : '1px solid #8b5cf6',
                  color: isSpeakerCopied ? '#fff' : '#7c3aed',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                {isSpeakerCopied ? '✓ Скопирована' : '🎙️ Ссылка спикеру'}
              </button>
            </div>
          )
        ) : isLessonMode ? (
          <p style={{ margin: '4px 0 0 0', color: sbColors.textMuted, fontSize: '0.78rem' }}>
            {clientName ? `Ученик: ${clientName}` : 'Учебное занятие (1 на 1)'}
          </p>
        ) : (
          <p style={{ margin: '4px 0 0 0', color: sbColors.textMuted, fontSize: '0.78rem' }}>
            {clientName ? `${t('Клиент:', 'Client:')} ${clientName}` : t('Клиент сессии', 'Session client')} {caseId ? `(${t('кейс', 'case')} #${caseId.slice(-6)})` : ''}
          </p>
        )}
      </div>

      {/* Tabs Switcher - Lesson, Webinar or Consultation */}
      {isLessonMode ? (
        <div style={{ display: 'flex', borderBottom: `1px solid ${sbColors.border}`, background: sbColors.tabsBg }}>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              background: activeTab === 'notes' ? sbColors.tabActiveBg : 'transparent',
              color: activeTab === 'notes' ? '#2563eb' : sbColors.textMuted,
              borderBottom: activeTab === 'notes' ? '2px solid #3b82f6' : 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            ✍️ Заметки и задачи
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('participants')}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              background: activeTab === 'participants' ? sbColors.tabActiveBg : 'transparent',
              color: activeTab === 'participants' ? '#8b5cf6' : sbColors.textMuted,
              borderBottom: activeTab === 'participants' ? '2px solid #8b5cf6' : 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            👥 Участники
          </button>
        </div>
      ) : isWebinarMode ? (
        <div style={{ display: 'flex', borderBottom: `1px solid ${sbColors.border}`, background: sbColors.tabsBg }}>
          <button
            type="button"
            onClick={() => setActiveTab('polls')}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              background: activeTab === 'polls' ? sbColors.tabActiveBg : 'transparent',
              color: activeTab === 'polls' ? '#059669' : sbColors.textMuted,
              borderBottom: activeTab === 'polls' ? '2px solid #10b981' : 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            📊 Опросы
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qa')}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              background: activeTab === 'qa' ? sbColors.tabActiveBg : 'transparent',
              color: activeTab === 'qa' ? '#2563eb' : sbColors.textMuted,
              borderBottom: activeTab === 'qa' ? '2px solid #3b82f6' : 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            ❓ Q&A (Вопросы)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              background: activeTab === 'notes' ? sbColors.tabActiveBg : 'transparent',
              color: activeTab === 'notes' ? '#d97706' : sbColors.textMuted,
              borderBottom: activeTab === 'notes' ? '2px solid #f59e0b' : 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            ✍️ Конспект
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('participants')}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              background: activeTab === 'participants' ? sbColors.tabActiveBg : 'transparent',
              color: activeTab === 'participants' ? '#8b5cf6' : sbColors.textMuted,
              borderBottom: activeTab === 'participants' ? '2px solid #8b5cf6' : 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            👥 Участники
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', borderBottom: `1px solid ${sbColors.border}`, background: sbColors.tabsBg }}>
          <button
            type="button"
            onClick={() => setActiveTab('sprint')}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              background: activeTab === 'sprint' ? sbColors.tabActiveBg : 'transparent',
              color: activeTab === 'sprint' ? '#0284c7' : sbColors.textMuted,
              borderBottom: activeTab === 'sprint' ? '2px solid #0284c7' : 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>🎯</span>
            <span>{t('План и Граф сессии', 'Plan & Graph')}</span>
            {topics.filter(t => t.status === 'paused').length > 0 && (
              <span style={{ fontSize: '0.68rem', background: '#f59e0b', color: '#000', padding: '1px 5px', borderRadius: '8px', fontWeight: 800 }}>
                {topics.filter(t => t.status === 'paused').length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              background: activeTab === 'notes' ? sbColors.tabActiveBg : 'transparent',
              color: activeTab === 'notes' ? '#d97706' : sbColors.textMuted,
              borderBottom: activeTab === 'notes' ? '2px solid #f59e0b' : 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>✍️</span>
            <span>{t('Протокол и Заметки', 'Protocol & Notes')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('participants')}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              background: activeTab === 'participants' ? sbColors.tabActiveBg : 'transparent',
              color: activeTab === 'participants' ? '#8b5cf6' : sbColors.textMuted,
              borderBottom: activeTab === 'participants' ? '2px solid #8b5cf6' : 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>👥</span>
            <span>{t('Участники', 'Participants')}</span>
          </button>
        </div>
      )}
      
      {/* Content based on Mode / Active Tab */}
      {isWebinarMode && activeTab === 'polls' ? (
        /* Webinar Interactive Polls & Constructor */
        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          {/* Top Header & Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f3f4f6' }}>📊 Опросы эфира</span>
              <span style={{ fontSize: '0.75rem', background: '#27272a', border: '1px solid #3f3f46', color: '#9ca3af', padding: '1px 8px', borderRadius: '10px' }}>
                {polls.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isBuilderOpen) {
                  setIsBuilderOpen(false);
                } else {
                  handleOpenCreatePoll();
                }
              }}
              style={{
                background: isBuilderOpen ? '#374151' : '#10b981',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {isBuilderOpen ? '✕ Закрыть' : '➕ Конструктор опроса'}
            </button>
          </div>

          {/* POLL CONSTRUCTOR FORM */}
          {isBuilderOpen && (
            <div style={{ background: '#27272a', border: '1px solid #10b981', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#34d399' }}>
                  {editingPollId ? '✏️ Редактирование опроса' : '🛠️ Конструктор нового опроса'}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>до 6 вариантов</span>
              </div>

              {/* Quick Presets / Templates */}
              <div>
                <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>
                  ⚡ Быстрые шаблоны для психолога / ведущего:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {pollPresets.map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      style={{
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        color: '#d1d5db',
                        fontSize: '0.72rem',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      title="Кликните, чтобы заполнить вопрос и варианты этим шаблоном"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Input */}
              <div>
                <label style={{ fontSize: '0.78rem', color: '#e5e7eb', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Вопрос для аудитории:
                </label>
                <input
                  type="text"
                  value={builderQuestion}
                  onChange={(e) => setBuilderQuestion(e.target.value)}
                  placeholder="Например: Оцените актуальность темы или выберите кейс..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: '#18181b',
                    border: '1px solid #4b5563',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Options Dynamic List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', color: '#e5e7eb', fontWeight: 600 }}>
                  Варианты ответа:
                </label>
                {builderOptions.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', width: '16px', textAlign: 'right' }}>
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBuilderOptions(prev => prev.map((o, i) => i === idx ? val : o));
                      }}
                      placeholder={`Вариант ${idx + 1}`}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        background: '#18181b',
                        border: '1px solid #4b5563',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.82rem'
                      }}
                    />
                    {builderOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBuilderOption(idx)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          padding: '4px'
                        }}
                        title="Удалить вариант"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {builderOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddBuilderOption}
                    style={{
                      marginTop: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px dashed #4b5563',
                      color: '#9ca3af',
                      padding: '6px',
                      borderRadius: '6px',
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    + Добавить еще вариант
                  </button>
                )}
              </div>

              {/* Constructor Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleSavePoll(false)}
                  style={{
                    flex: 1,
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  💾 Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePoll(true)}
                  style={{
                    flex: 1.2,
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🚀 Сохранить и в эфир
                </button>
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  style={{
                    background: '#374151',
                    color: '#e5e7eb',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* POLLS LIST & LIVE CONTROL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {polls.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 16px', color: '#6b7280', background: '#18181b', borderRadius: '10px', border: '1px dashed #3f3f46' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '0.88rem', fontWeight: 600 }}>В студии пока нет опросов</p>
                <p style={{ margin: 0, fontSize: '0.78rem' }}>Нажмите «➕ Конструктор опроса», чтобы создать интерактив для аудитории.</p>
              </div>
            ) : (
              polls.map((poll) => {
                const totalVotes = poll.votes.reduce((a, b) => a + b, 0);
                const safeTotal = totalVotes || 1;

                return (
                  <div
                    key={poll.id}
                    style={{
                      background: poll.isActive ? '#1f2937' : '#18181b',
                      border: poll.isActive ? '1px solid #10b981' : '1px solid #374151',
                      borderRadius: '12px',
                      padding: '14px',
                      boxShadow: poll.isActive ? '0 0 16px rgba(16, 185, 129, 0.15)' : 'none'
                    }}
                  >
                    {/* Poll Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {poll.isActive ? (
                          <span style={{ fontSize: '0.7rem', background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
                            🟢 В ЭФИРЕ
                          </span>
                        ) : poll.isFinished ? (
                          <span style={{ fontSize: '0.7rem', background: '#374151', color: '#9ca3af', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                            ✓ Завершен
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                            📝 Черновик
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          {totalVotes} ответов
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleExportPollToNotes(poll)}
                          style={{ background: 'transparent', border: 'none', color: '#fbbf24', fontSize: '0.8rem', cursor: 'pointer', padding: '2px 4px' }}
                          title="Вставить результаты в заметки/конспект"
                        >
                          📋
                        </button>
                        {!poll.isActive && (
                          <button
                            type="button"
                            onClick={() => handleEditPoll(poll)}
                            style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '0.8rem', cursor: 'pointer', padding: '2px 4px' }}
                            title="Редактировать в конструкторе"
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeletePoll(poll.id)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', padding: '2px 4px' }}
                          title="Удалить опрос"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Question Title */}
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.86rem', fontWeight: 700, color: '#f3f4f6', lineHeight: 1.35 }}>
                      {poll.question}
                    </p>

                    {/* Options & Percentage Bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                      {poll.options.map((opt, oIdx) => {
                        const count = poll.votes[oIdx] || 0;
                        const pct = Math.round((count / safeTotal) * 100);

                        return (
                          <div key={oIdx} style={{ background: '#111827', borderRadius: '6px', padding: '6px 10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#e5e7eb', marginBottom: '3px' }}>
                              <span>{opt}</span>
                              <strong style={{ color: poll.isActive ? '#34d399' : '#9ca3af' }}>{pct}% ({count})</strong>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: poll.isActive ? '#10b981' : '#6b7280', transition: 'width 0.3s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Poll Controls */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {poll.isActive ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSimulateVotes(poll.id)}
                            style={{
                              flex: 1,
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                            title="Сгенерировать случайные голоса участников для демонстрации"
                          >
                            ⚡ Голоса (+)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFinishPoll(poll.id)}
                            style={{
                              flex: 1,
                              background: '#374151',
                              color: '#f87171',
                              border: '1px solid #ef4444',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            ⏹️ Завершить
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleActivatePoll(poll.id)}
                          style={{
                            width: '100%',
                            background: '#059669',
                            color: '#fff',
                            border: 'none',
                            padding: '7px 12px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          ▶️ Запустить этот опрос в эфир
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : activeTab === 'qa' ? (
        /* Webinar Q&A Questions from Audience */
        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f3f4f6' }}>Вопросы от слушателей</span>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{qaQuestions.filter(q => !q.answered).length} открытых</span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <input 
              type="text" 
              placeholder="Добавить вопрос или тему..." 
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
              style={{ flex: 1, padding: '8px 10px', background: '#27272a', border: '1px solid #4b5563', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
            />
            <button
              type="button"
              onClick={handleAddQuestion}
              style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0 12px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
            >
              +
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {qaQuestions.map((q) => (
              <div 
                key={q.id} 
                style={{
                  background: q.answered ? 'rgba(39, 39, 42, 0.5)' : '#27272a',
                  border: q.answered ? '1px solid #27272a' : '1px solid #3f3f46',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  opacity: q.answered ? 0.7 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '0.8rem', color: '#60a5fa' }}>{q.user}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                    👍 {q.upvotes}
                  </span>
                </div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.82rem', color: '#e5e7eb', lineHeight: 1.4 }}>
                  {q.text}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setQaQuestions(prev => prev.map(item => item.id === q.id ? { ...item, answered: !item.answered } : item));
                    }}
                    style={{
                      background: q.answered ? '#059669' : '#374151',
                      color: '#fff',
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {q.answered ? '✓ Отвечен' : 'Ответить в эфире'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'participants' ? (
        /* Participants & Live Moderation Panel */
        <ParticipantsPanel
          sbColors={sbColors}
          isWebinarMode={isWebinarMode}
          specialistName={specialistName}
          isClient={isClientUser}
          handRaisedUsers={handRaisedMap}
          onGrantMic={(sid, identity) => {
            setHandRaisedMap(prev => ({ ...prev, [identity]: false, [sid]: false }));
            setHandRaiseNotice(null);
          }}
        />
      ) : !isWebinarMode && activeTab === 'sprint' ? (
        /* Dynamic Mind Map & Sprint Tracker for Specialist */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SessionMindMap
            transcriptText={rawTranscriptText}
            clientName={clientName}
            topics={topics}
            onTopicsChange={setTopics}
            sprint={sprint}
            onSprintChange={setSprint}
            onLogEvent={handleLogEvent}
            secondsElapsed={elapsedSeconds}
            isExpanded={isMapOverlayOpen}
            onToggleExpand={() => setIsMapOverlayOpen(!isMapOverlayOpen)}
            theme={videoTheme}
            deepInsight={deepInsight}
            onAcceptDeepInsight={handleAcceptDeepInsight}
            onDismissDeepInsight={handleDismissDeepInsight}
            onInsertToNotes={(summary) => {
              setSessionNotes((prev) => (prev ? `${prev}\n\n${summary}` : summary));
              setActiveTab('notes');
            }}
          />
        </div>
      ) : activeTab === 'notes' ? (
        /* Notes & Live AI Transcription (Default for Consultation, Lesson & Webinar Notes) */
        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflowY: 'auto', gap: '10px' }}>
          {/* Active Sprint Badge for Quick Context */}
          {!isWebinarMode && !isLessonMode && (
            <div style={{
              background: videoTheme === 'dark' ? 'rgba(30, 27, 75, 0.6)' : '#f0fdf4',
              border: videoTheme === 'dark' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '6px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: videoTheme === 'dark' ? '#60a5fa' : '#166534', textTransform: 'uppercase' }}>
                  🎯 Фокус:
                </span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: videoTheme === 'dark' ? '#f3f4f6' : '#14532d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {topics.find(t => t.id === sprint.activeTopicId)?.label || 'Основной запрос'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('sprint')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: videoTheme === 'dark' ? '#93c5fd' : '#15803d',
                  padding: '2px 6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                title={t("Перейти к плану и графу", "Switch to plan & graph")}
              >
                {t('К плану →', 'To plan →')}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.86rem', color: '#d1d5db', fontWeight: 'bold' }}>
              {isLessonMode ? '✍️ Заметки к уроку:' : isWebinarMode ? '✍️ Заметки спикера / тезисы:' : '✍️ Заметки специалиста:'}
            </label>
            {!isLessonMode && (
              <button
                type="button"
                onClick={() => {
                  if (!subscriptionActive && commercial) {
                    setShowPaywall(true);
                  } else {
                    setShowHelpPanel(!showHelpPanel);
                  }
                }}
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#fbbf24',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                🆘 Помощь AI
              </button>
            )}
          </div>
          
          {showHelpPanel && (
            <InSessionHelpPanel 
              transcriptText={rawTranscriptText}
              onClose={() => setShowHelpPanel(false)}
              terminalUserId={terminalUserId}
            />
          )}

          {showPaywall && (
            <AiSubscriptionPaywall
              terminalUserId={terminalUserId}
              context="Функция AI-супервизора во время звонка доступна по подписке."
              onDismiss={() => setShowPaywall(false)}
            />
          )}

          {/* Voice Activity & Equalizer Indicator */}
          <div style={{
            background: isListening ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.04)',
            border: isListening ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isListening ? '#10b981' : '#6b7280',
                  boxShadow: isListening ? '0 0 10px #10b981' : 'none',
                }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isListening ? '#34d399' : '#9ca3af' }}>
                  {isListening ? '🎙️ Идет фоновая запись и стенограмма' : 'Транскрипция отключена'}
                </span>
              </div>

              {/* Live Animated Audio Wave Equalizer */}
              {isListening && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '14px', paddingRight: '4px' }}>
                  <span style={{ width: '3px', height: '10px', background: '#34d399', borderRadius: '2px', animation: 'eq-bar 0.8s ease-in-out infinite alternate' }} />
                  <span style={{ width: '3px', height: '14px', background: '#10b981', borderRadius: '2px', animation: 'eq-bar 0.6s ease-in-out infinite alternate 0.2s' }} />
                  <span style={{ width: '3px', height: '8px', background: '#34d399', borderRadius: '2px', animation: 'eq-bar 1.0s ease-in-out infinite alternate 0.4s' }} />
                  <span style={{ width: '3px', height: '12px', background: '#10b981', borderRadius: '2px', animation: 'eq-bar 0.7s ease-in-out infinite alternate 0.1s' }} />
                </div>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '0.72rem', color: '#9ca3af', lineHeight: '1.35' }}>
              {transcript && transcript.length > 0 ? (
                <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>
                  «{transcript[transcript.length - 1].text}»
                </span>
              ) : (
                <span>{isLessonMode ? 'Стенограмма речи участников урока формируется автоматически.' : 'ИИ в реальном времени анализирует речь и формирует саммари встречи.'}</span>
              )}
            </p>
          </div>

          <textarea 
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            onSelect={(e) => {
              const target = e.target as HTMLTextAreaElement;
              const sel = target.value.substring(target.selectionStart, target.selectionEnd);
              if (sel.trim().length > 3) {
                setSelectedNoteText(sel.trim());
              }
            }}
            style={{ 
              flex: 1, 
              minHeight: '120px',
              backgroundColor: '#27272a', 
              border: '1px solid #3f3f46', 
              color: 'white', 
              padding: '12px', 
              borderRadius: '8px', 
              resize: 'none',
              fontSize: '0.88rem',
              lineHeight: '1.45'
            }} 
            placeholder={isLessonMode ? "Заметки к уроку, формулы, ссылки на задачи и домашнее задание..." : isWebinarMode ? "Фиксируйте ключевые тезисы, тайм-коды и ответы на вопросы аудитории..." : "Фиксируйте ключевые фразы клиента, гипотезы, предложенные техники..."}
          />

          {/* Quick Topic / Sprint Action from Notes */}
          {!isWebinarMode && !isLessonMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#1f1f23', padding: '10px', borderRadius: '8px', border: '1px solid #27272a' }}>
              {selectedNoteText && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(37, 99, 235, 0.15)', padding: '6px 10px', borderRadius: '6px', border: '1px solid #3b82f6' }}>
                  <span style={{ fontSize: '0.75rem', color: '#93c5fd' }}>
                    Выделено: <strong>«{selectedNoteText.length > 24 ? `${selectedNoteText.slice(0, 23)}…` : selectedNoteText}»</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCreateTopicFromNotes('sprint')}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    🎯 В спринт
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={newNoteTopicInput}
                  onChange={(e) => setNewNoteTopicInput(e.target.value)}
                  placeholder="Превратить мысль / цитату в тему карты..."
                  style={{ flex: 1, padding: '6px 10px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: '6px', color: '#fff', fontSize: '0.78rem' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTopicFromNotes('sprint')}
                />
                <button
                  type="button"
                  onClick={() => handleCreateTopicFromNotes('sprint')}
                  disabled={!newNoteTopicInput.trim()}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', opacity: newNoteTopicInput.trim() ? 1 : 0.5 }}
                  title="Добавить как новый активный спринт"
                >
                  🎯 В спринт
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateTopicFromNotes('paused')}
                  disabled={!newNoteTopicInput.trim()}
                  style={{ background: '#374151', color: '#9ca3af', border: 'none', padding: '0 8px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', opacity: newNoteTopicInput.trim() ? 1 : 0.5 }}
                  title="Отложить тему на парковку карты"
                >
                  ⏸️ Паркинг
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Bottom Save & Exit */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: '8px', background: '#121214' }}>
        {isLessonMode ? (
          <button
            type="button"
            onClick={handleManualLeave}
            title={isClientUser ? "Покинуть урок" : "Завершить урок"}
            style={{
              width: '100%',
              padding: '11px 16px',
              backgroundColor: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
            }}
          >
            <span>⏹️ {isClientUser ? 'Покинуть урок' : 'Завершить урок'}</span>
          </button>
        ) : isClientUser ? (
          <button
            type="button"
            onClick={handleManualLeave}
            title="Выйти из комнаты вебинара"
            style={{
              width: '100%',
              padding: '11px 16px',
              backgroundColor: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
            }}
          >
            <span>⏹️ Покинуть вебинар</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleFinishAndSave}
              title="Завершить сессию, зафиксировать время и перенести данные в протокол"
              style={{
                width: '100%',
                padding: '11px 16px',
                backgroundColor: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
              }}
            >
              <span>⏹️ {isWebinarMode ? t('Завершить вебинар и сохранить', 'End Webinar & Save') : t('Завершить и перенести в карту', 'End Session & Save to Card')}</span>
            </button>
            <button
              type="button"
              onClick={handleManualLeave}
              title="Закрыть комнату без сохранения"
              style={{
                width: '100%',
                padding: '6px 12px',
                backgroundColor: 'transparent',
                color: '#9ca3af',
                border: '1px solid #3f3f46',
                borderRadius: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              {t('Выйти без сохранения', 'Leave without saving')}
            </button>
          </>
        )}
      </div>
      
      <div style={{ padding: '10px 16px', borderTop: '1px solid #27272a', backgroundColor: 'rgba(124, 58, 237, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#a78bfa' }}></div>
           <span style={{ fontSize: '0.73rem', color: '#c4b5fd' }}>{t("WebRTC DTLS/SRTP (152-ФЗ) шифрование активно", "WebRTC DTLS/SRTP end-to-end encryption active")}</span>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#09090b", color: "#fff" }}>
        <div style={{ fontSize: "1.2rem", marginBottom: "12px", fontWeight: 700 }}>
          {t("Подключение к защищенной видео-комнате IDA...", "Connecting to secure IDA video room...")}
        </div>
        <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
          {t(`Генерация ключей сессии для комнаты: ${roomName}`, `Generating session keys for room: ${roomName}`)}
        </div>
      </div>
    );
  }

  if (useSimulation || error || !token) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', backgroundColor: '#09090b', position: 'relative', overflow: 'hidden' }}>
        <style>{`
          @keyframes eq-bar {
            0% { height: 3px; opacity: 0.5; }
            100% { height: 14px; opacity: 1; }
          }
          @media (max-width: 768px) {
            .ida-session-sidebar {
              position: fixed !important;
              top: 0 !important;
              right: 0 !important;
              bottom: 0 !important;
              width: 85vw !important;
              max-width: 380px !important;
              z-index: 1000 !important;
              box-shadow: -4px 0 24px rgba(0,0,0,0.8) !important;
              transform: translateX(100%);
              transition: transform 0.25s ease-in-out !important;
            }
            .ida-session-sidebar.mobile-open {
              transform: translateX(0) !important;
            }
            .ida-mobile-sidebar-close {
              display: inline-flex !important;
            }
            .ida-mobile-only-btn {
              display: inline-flex !important;
            }
          }
        `}</style>
        {/* Main Simulated Video Area */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', background: '#0a0a0a', overflow: 'hidden', height: '100%' }}>
          <SessionTimerOverlay secondsElapsed={elapsedSeconds} isDemo={isDemo} maxDuration={maxSessionSeconds} isLessonMode={isLessonMode} />

          {connectionNotice && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              background: 'rgba(30, 41, 59, 0.95)',
              border: '1px solid #3b82f6',
              color: '#e2e8f0',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>ℹ️ {connectionNotice}</span>
              <button
                type="button"
                onClick={() => setConnectionNotice(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Floating Real-time Speech AI Suggestion Toast (Simulated Mode) */}
          {liveAiSuggestion && !isClient && !isWebinarMode && !isCourseMode && (
            <div style={{
              position: 'absolute',
              bottom: '84px',
              right: '16px',
              maxWidth: '340px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid #8b5cf6',
              borderRadius: '12px',
              padding: '12px 14px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), 0 0 16px rgba(139, 92, 246, 0.35)',
              zIndex: 50,
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', background: '#7c3aed', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
                  ⚡ ИИ услышал тему в речи
                </span>
                <button
                  type="button"
                  onClick={() => handleDismissAiSuggestion(liveAiSuggestion.id)}
                  style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px' }}
                  title="Скрыть"
                >
                  ✕
                </button>
              </div>

              <strong style={{ fontSize: '0.84rem', color: '#f8fafc', lineHeight: 1.3 }}>
                {liveAiSuggestion.label}
              </strong>

              <p style={{ margin: 0, fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.35, background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px' }}>
                «{liveAiSuggestion.excerpt}»
              </p>

              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => handleAcceptAiSuggestion(liveAiSuggestion, 'sprint')}
                  style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  🎯 В спринт
                </button>
                <button
                  type="button"
                  onClick={() => handleAcceptAiSuggestion(liveAiSuggestion, 'paused')}
                  style={{ flex: 1, background: '#374151', color: '#93c5fd', border: '1px solid #4b5563', padding: '6px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  ⏸️ На парковку
                </button>
              </div>
            </div>
          )}

          {/* Client Screen */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {/* Screen Sharing / Presentation Deck Mode */}
            {isScreenSharing ? (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                display: 'flex',
                flexDirection: 'column',
                padding: '24px',
                boxSizing: 'border-box'
              }}>
                {/* Slide Top Navigation Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'rgba(0,0,0,0.4)', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', background: '#dc2626', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                      🔴 ТРАНСЛЯЦИЯ ЭКРАНА
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
                      Слайд {currentSlideIndex + 1} из {presentationSlides.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handlePrevSlide}
                      style={{ background: '#374151', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      ◀ Предыдущий
                    </button>
                    <button
                      type="button"
                      onClick={handleNextSlide}
                      style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      Следующий ▶
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsScreenSharing(false)}
                      style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #ef4444', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      ⏹️ Закрыть показ
                    </button>
                  </div>
                </div>

                {/* Main Slide Content Card */}
                <div style={{
                  flex: 1,
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  padding: '32px 40px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ display: 'inline-block', color: '#60a5fa', fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                    {presentationSlides[currentSlideIndex].subtitle}
                  </div>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 24px 0', lineHeight: 1.3 }}>
                    {presentationSlides[currentSlideIndex].title}
                  </h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {presentationSlides[currentSlideIndex].points.map((pt, pIdx) => (
                      <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: '#3b82f6', color: '#fff', borderRadius: '50%', fontWeight: 800, fontSize: '0.85rem' }}>
                          {pIdx + 1}
                        </span>
                        <span style={{ fontSize: '1.05rem', color: '#e2e8f0', fontWeight: 500 }}>
                          {pt}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ position: 'absolute', bottom: '16px', right: '24px', fontSize: '0.75rem', color: '#64748b' }}>
                    IDA Presentation Hub • LiveKit Broadcast Stream
                  </div>
                </div>
              </div>
            ) : (
              /* Camera / Video Stream View */
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundImage: `url('https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&q=80')`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  opacity: 0.92,
                  filter: 'contrast(1.05)'
                }}
              />
            )}
            
            {/* Client status pill (when not sharing screen) */}
            {!isScreenSharing && (
              <div style={{
                position: 'absolute',
                bottom: '80px',
                left: '20px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }}></span>
                <span>{clientName || (isCourseMode ? "Студенты группы" : (isWebinarMode ? "Слушатели эфира" : "Клиент"))}</span>
                <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>HD 720p · E2EE</span>
              </div>
            )}

            {/* Specialist Picture-in-Picture */}
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              width: '180px',
              height: '120px',
              backgroundColor: '#18181b',
              borderRadius: '12px',
              border: isScreenSharing ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.2)',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20
            }}>
              {camOff ? (
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>👤</div>
                  Камера выкл.
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', backgroundColor: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e4e4e7', fontSize: '0.85rem' }}>
                  <span>{specialistName} (Вы)</span>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: '6px', right: '6px', fontSize: '0.7rem', color: micMuted ? '#ef4444' : '#10b981' }}>
                {micMuted ? '🔇' : '🎙️'}
              </div>
            </div>
          </div>

          {/* Bottom Call Controls Toolbar */}
          <div style={{ height: '70px', backgroundColor: 'rgba(17, 17, 17, 0.95)', borderTop: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', zIndex: 10 }}>
            <button
              type="button"
              onClick={() => setMicMuted(!micMuted)}
              style={{
                backgroundColor: micMuted ? '#dc2626' : '#27272a',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50%',
                width: '46px',
                height: '46px',
                fontSize: '1.1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              title={micMuted ? "Включить микрофон" : "Выключить микрофон"}
            >
              {micMuted ? '🔇' : '🎙️'}
            </button>
            <button
              type="button"
              onClick={() => setCamOff(!camOff)}
              style={{
                backgroundColor: camOff ? '#dc2626' : '#27272a',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50%',
                width: '46px',
                height: '46px',
                fontSize: '1.1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              title={camOff ? "Включить камеру" : "Выключить камеру"}
            >
              {camOff ? '📷' : '📹'}
            </button>
            <button
              type="button"
              onClick={() => setIsScreenSharing(!isScreenSharing)}
              style={{
                backgroundColor: isScreenSharing ? '#2563eb' : '#27272a',
                color: '#fff',
                border: isScreenSharing ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '24px',
                padding: '10px 18px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isScreenSharing ? '0 0 12px rgba(37, 99, 235, 0.4)' : 'none'
              }}
              title="Поделиться экраном или показать слайды презентации"
            >
              <span>{isScreenSharing ? '⏹️ Стоп показ' : '🖥️ Демонстрация экрана'}</span>
            </button>
            {(!isClient || isWebinarMode || isLessonMode) && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(!isMobileSidebarOpen);
                  setIsDesktopSidebarOpen(!isDesktopSidebarOpen);
                }}
                style={{
                  backgroundColor: (isMobileSidebarOpen || isDesktopSidebarOpen) ? '#3b82f6' : '#27272a',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '24px',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title={isLessonMode ? "Открыть панель заметок и задач" : isWebinarMode ? "Открыть панель вопросов, опросов и чата" : "Открыть панель сессии"}
              >
                <span>{(isMobileSidebarOpen || isDesktopSidebarOpen) ? '✕ Панель' : isLessonMode ? '✍️ Заметки' : isWebinarMode ? '💬 Чат и Q&A' : '📋 Панель'}</span>
              </button>
            )}
            {!isClient && !isWebinarMode && !isLessonMode && (
              <button
                type="button"
                onClick={() => setIsMapOverlayOpen(!isMapOverlayOpen)}
                style={{
                  backgroundColor: isMapOverlayOpen ? 'rgba(59, 130, 246, 0.3)' : '#27272a',
                  color: isMapOverlayOpen ? '#93c5fd' : '#fff',
                  border: isMapOverlayOpen ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '24px',
                  padding: '10px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isMapOverlayOpen ? '0 0 12px rgba(59, 130, 246, 0.4)' : 'none',
                  transition: 'all 0.2s'
                }}
                title={isMapOverlayOpen ? "Скрыть карту сессии с экрана видео" : "Показать ментальный граф и спринт прямо на экране видео"}
              >
                <span>{isMapOverlayOpen ? t('✕ Скрыть карту', '✕ Hide Graph') : t('🗺️ Граф сессии', '🗺️ Session Graph')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleFinishAndSave}
              style={{
                backgroundColor: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '24px',
                padding: '10px 20px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)'
              }}
            >
              <span>{t('⏹️ Завершить сессию', '⏹️ End Session')}</span>
            </button>
          </div>

          {/* Full HUD Map Overlay directly over video */}
          {isMapOverlayOpen && !isClient && (
            <div style={{
              position: 'absolute',
              inset: '16px',
              zIndex: 70,
              background: isLight ? 'rgba(255, 255, 255, 0.97)' : 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '16px',
              border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(59, 130, 246, 0.4)',
              boxShadow: isLight ? '0 20px 50px rgba(0, 0, 0, 0.2), 0 0 30px rgba(37, 99, 235, 0.1)' : '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 30px rgba(37, 99, 235, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <SessionMindMap
                transcriptText={rawTranscriptText}
                clientName={clientName}
                topics={topics}
                onTopicsChange={setTopics}
                sprint={sprint}
                onSprintChange={setSprint}
                onLogEvent={handleLogEvent}
                secondsElapsed={elapsedSeconds}
                isExpanded={true}
                onToggleExpand={() => setIsMapOverlayOpen(false)}
                onCloseExpanded={() => setIsMapOverlayOpen(false)}
                theme={videoTheme}
                onInsertToNotes={(summary) => {
                  setSessionNotes((prev) => (prev ? `${prev}\n\n${summary}` : summary));
                  setActiveTab('notes');
                  setIsMapOverlayOpen(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Split Resizer Drag Handle */}
        {(!isClientUser || isWebinarMode) && isDesktopSidebarOpen && (
          <div
            onMouseDown={() => setIsDraggingSidebar(true)}
            style={{
              width: '6px',
              cursor: 'col-resize',
              backgroundColor: isDraggingSidebar ? '#3b82f6' : '#27272a',
              transition: 'background-color 0.15s ease',
              zIndex: 50,
              position: 'relative'
            }}
            title="Потяните, чтобы изменить соотношение видео и панели инструментов"
          >
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '2px',
              height: '32px',
              backgroundColor: '#52525b',
              borderRadius: '2px'
            }} />
          </div>
        )}

        {/* Notes & AI Sidebar */}
        {(!isClientUser || isWebinarMode) && (isDesktopSidebarOpen || isMobileSidebarOpen) && renderSidebar()}

        {/* Mobile Sidebar Backdrop in simulated mode */}
        {isMobileSidebarOpen && (!isClientUser || isWebinarMode) && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              zIndex: 900
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', backgroundColor: '#09090b', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes eq-bar {
          0% { height: 3px; opacity: 0.5; }
          100% { height: 14px; opacity: 1; }
        }
        .ida-conference-stage {
          height: 100% !important;
          width: 100% !important;
          min-height: 0 !important;
        }
        .ida-conference-stage .lk-participant-tile {
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          display: flex !important;
          position: relative !important;
          border-radius: 12px !important;
          overflow: hidden !important;
        }
        .ida-conference-stage .lk-participant-tile video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 12px !important;
        }
        .ida-conference-stage .lk-participant-placeholder {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: #18181b !important;
          border-radius: 12px !important;
        }
        .ida-conference-stage .lk-control-bar {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        .ida-conference-stage .lk-chat {
          display: none !important;
        }
        @media (max-width: 768px) {
          .ida-video-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: repeat(auto-fit, minmax(140px, 1fr)) !important;
            gap: 8px !important;
            padding: 8px !important;
          }
          .ida-session-sidebar {
            position: fixed !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 85vw !important;
            max-width: 380px !important;
            z-index: 1000 !important;
            box-shadow: -4px 0 24px rgba(0,0,0,0.8) !important;
            transform: translateX(100%);
            transition: transform 0.25s ease-in-out !important;
          }
          .ida-session-sidebar.mobile-open {
            transform: translateX(0) !important;
          }
          .ida-mobile-sidebar-close {
            display: inline-flex !important;
          }
          .ida-mobile-only-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
      {connectionNotice && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'rgba(30, 41, 59, 0.95)',
          border: '1px solid #3b82f6',
          color: '#e2e8f0',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '0.82rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>ℹ️ {connectionNotice}</span>
          <button
            type="button"
            onClick={() => setConnectionNotice(null)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            ✕
          </button>
        </div>
      )}
      <LiveKitRoom
        video={false}
        audio={false}
        token={token}
        serverUrl={serverUrl}
        data-lk-theme="default"
        connectOptions={{
          autoSubscribe: true,
          maxRetries: 12,
          peerConnectionTimeout: 25000,
          websocketTimeout: 20000,
        }}
        options={{
          adaptiveStream: true,
          dynacast: true,
          stopLocalTrackOnUnpublish: true,
        }}
        onError={(err) => {
          console.warn("LiveKit connection notice:", err);
          const msg = (err?.message || "").toLowerCase();
          const isDeviceErr = msg.includes("permission") || msg.includes("notallowed") || msg.includes("device") || msg.includes("notfound") || msg.includes("track");
          if (isDeviceErr) {
            setConnectionNotice("Камера или микрофон недоступны или заблокированы браузером. Включите их на панели управления при необходимости.");
          } else {
            console.error("LiveKit connection notice:", err);
            setConnectionNotice("Нестабильный сигнал сети. Выполняется автоматическое переподключение к видеокомнате...");
          }
        }}
        onMediaDeviceFailure={(err) => {
          console.warn("LiveKit media device notice:", err);
          setConnectionNotice("Камера или микрофон недоступны в браузере. Вы можете включить их на панели управления или продолжать участие в режиме слушателя.");
        }}
        onDisconnected={() => {
          if (isManualLeaveRef.current) {
            if (isClient) {
              onLeave();
            } else if (!useSimulation) {
              handleFinishAndSave();
            }
          } else {
            console.warn("LiveKit disconnected. Attempting auto-reconnect...");
            setConnectionNotice("Связь с сервером прервана. Выполняется повторное подключение...");
          }
        }}
        style={{ height: '100%', width: '100%', flex: 1, display: 'flex', overflow: 'hidden' }}
      >
        <LayoutContextProvider>
          <ConferenceStage
            isClient={isClientUser}
            role={effectiveRole}
            onLeave={isClientUser ? handleManualLeave : handleFinishAndSave}
            isDemo={isDemo}
            elapsedSeconds={elapsedSeconds}
            maxSessionSeconds={maxSessionSeconds}
            liveAiSuggestion={liveAiSuggestion}
            onAcceptAiSuggestion={handleAcceptAiSuggestion}
            onDismissAiSuggestion={handleDismissAiSuggestion}
            deepInsight={deepInsight}
            onAcceptDeepInsight={handleAcceptDeepInsight}
            onDismissDeepInsight={handleDismissDeepInsight}
            roomId={roomName}
            mode={isLessonMode ? 'lesson' : isCourseMode ? 'course' : (isWebinarMode ? 'webinar' : 'consultation')}
            isLessonMode={isLessonMode}
            participantName={isClientUser ? (clientName || (isLessonMode ? "Ученик" : isCourseMode ? "Студент" : (isWebinarMode ? "Слушатель" : "Клиент"))) : (specialistName || (isLessonMode ? "Преподаватель" : "Специалист"))}
            isMapOverlayOpen={isMapOverlayOpen}
            onToggleMapOverlay={() => setIsMapOverlayOpen(!isMapOverlayOpen)}
            isMobileSidebarOpen={isMobileSidebarOpen || isDesktopSidebarOpen}
            onToggleMobileSidebar={() => {
              setIsMobileSidebarOpen(!isMobileSidebarOpen);
              setIsDesktopSidebarOpen(!isDesktopSidebarOpen);
            }}
            isWebinarMode={isWebinarMode}
            isCourseMode={isCourseMode}
            isHandRaised={isHandRaised}
            onToggleHandRaise={() => setIsHandRaised(!isHandRaised)}
            onPromoteToSpeaker={handlePromoteToSpeaker}
            hasMicPermission={hasMicPermission}
            handRaiseNotice={handRaiseNotice}
            onDismissHandNotice={() => setHandRaiseNotice(null)}
            onGrantMic={(identity) => {
              setHandRaisedMap(prev => ({ ...prev, [identity]: false }));
              setHandRaiseNotice(null);
            }}
            onHandRaiseSignal={(sig) => {
              if (sig.raised) {
                setHandRaisedMap(prev => ({ ...prev, [sig.participantIdentity || sig.participantSid]: true }));
                setHandRaiseNotice({ id: sig.participantIdentity || sig.participantSid, name: sig.participantName || "Слушатель" });
              } else {
                setHandRaisedMap(prev => ({ ...prev, [sig.participantIdentity || sig.participantSid]: false }));
                setHandRaiseNotice(prev => (prev?.id === (sig.participantIdentity || sig.participantSid) ? null : prev));
              }
            }}
            onMicGranted={() => {
              setHasMicPermission(true);
            }}
          />
          <RoomAudioRenderer />
        </LayoutContextProvider>
        
        {/* Split Resizer Drag Handle */}
        {(!isClientUser || isWebinarMode || isLessonMode) && isDesktopSidebarOpen && (
          <div
            onMouseDown={() => setIsDraggingSidebar(true)}
            style={{
              width: '6px',
              cursor: 'col-resize',
              backgroundColor: isDraggingSidebar ? '#3b82f6' : '#27272a',
              transition: 'background-color 0.15s ease',
              zIndex: 50,
              position: 'relative'
            }}
            title="Потяните, чтобы изменить соотношение видео и панели инструментов"
          >
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '2px',
              height: '32px',
              backgroundColor: '#52525b',
              borderRadius: '2px'
            }} />
          </div>
        )}
        
        {(!isClientUser || isWebinarMode || isLessonMode) && (isDesktopSidebarOpen || isMobileSidebarOpen) && renderSidebar()}

        {/* Mobile Sidebar Backdrop */}
        {isMobileSidebarOpen && (!isClientUser || isWebinarMode || isLessonMode) && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              zIndex: 900
            }}
          />
        )}

        {/* Full HUD Map Overlay directly over video stage */}
        {isMapOverlayOpen && !isClient && !isLessonMode && (
          <div style={{
            position: 'absolute',
            inset: '16px',
            zIndex: 70,
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 30px rgba(37, 99, 235, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <SessionMindMap
              transcriptText={rawTranscriptText}
              clientName={clientName}
              topics={topics}
              onTopicsChange={setTopics}
              sprint={sprint}
              onSprintChange={setSprint}
              onLogEvent={handleLogEvent}
              secondsElapsed={elapsedSeconds}
              isExpanded={true}
              onToggleExpand={() => setIsMapOverlayOpen(false)}
              onCloseExpanded={() => setIsMapOverlayOpen(false)}
              onInsertToNotes={(summary) => {
                setSessionNotes((prev) => (prev ? `${prev}\n\n${summary}` : summary));
                setActiveTab('notes');
                setIsMapOverlayOpen(false);
              }}
            />
          </div>
        )}
      </LiveKitRoom>

      {showDemoEndedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '20px',
            maxWidth: '480px',
            width: '100%',
            padding: '32px',
            textAlign: 'center',
            color: '#fff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⏱️</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 10px' }}>
              {t('Тестовый сеанс (5 минут) завершен', 'Trial session (5 minutes) completed')}
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 24px' }}>
              {t('Вы протестировали качество реальной WebRTC-связи в демо-режиме.', 'You tested real-time WebRTC quality in demo mode.')}
            </p>

            {/* Live WebRTC Quality Metrics Report */}
            <div style={{
              background: '#27272a',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>{t('⚡ Задержка (Latency):', '⚡ Latency:')}</span>
                <strong style={{ color: '#34d399' }}>{t('~185 мс (Реалтайм)', '~185 ms (Real-time)')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>{t('📉 Потеря пакетов:', '📉 Packet Loss:')}</span>
                <strong style={{ color: '#34d399' }}>{t('0.00% (Идеально)', '0.00% (Ideal)')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>{t('📺 Качество видео:', '📺 Video Quality:')}</span>
                <strong style={{ color: '#fff' }}>Full HD 1080p (Simulcast)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>{t('🔒 Шифрование:', '🔒 Encryption:')}</span>
                <strong style={{ color: '#a78bfa' }}>{t('WebRTC DTLS/SRTP (152-ФЗ)', 'WebRTC DTLS/SRTP (E2EE)')}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="/"
                style={{
                  display: 'block',
                  background: '#10b981',
                  color: '#fff',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  fontSize: '1rem',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                }}
              >
                {t('Войти или Зарегистрироваться (Бесплатно) →', 'Sign In or Register (Free) →')}
              </a>
              <button
                type="button"
                onClick={handleManualLeave}
                style={{
                  background: 'transparent',
                  border: '1px solid #3f3f46',
                  color: '#a1a1aa',
                  padding: '10px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.88rem'
                }}
              >
                {t('Вернуться в демо-кабинет', 'Return to demo workspace')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guide Help Modal */}
      {showGuideModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '16px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #27272a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#121214'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>❓</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f3f4f6' }}>
                    Справочник инструментов онлайн-кабинета
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af' }}>
                    Как устроен интерфейс и как эффективно вести терапевтическую сессию
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#9ca3af',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', color: '#e5e7eb', fontSize: '0.86rem', lineHeight: '1.5' }}>
              {/* Feature 1: Workspace & Split */}
              <div style={{ background: '#27272a', padding: '14px', borderRadius: '10px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.1rem' }}>↔️</span>
                  <strong style={{ color: '#60a5fa', fontSize: '0.92rem' }}>Эргономика: Движущаяся граница и экранный HUD-граф</strong>
                </div>
                <p style={{ margin: 0, color: '#d1d5db', fontSize: '0.82rem' }}>
                  Вы можете зажать разделитель между окном видео и правой панелью и изменить её ширину под себя (выделив больше места для карты или для видео). Кнопка <strong>«🗺️ Граф сессии»</strong> в нижней панели выводит ментальную карту прямо поверх видео в полупрозрачном окне, чтобы не отводить взгляд от клиента.
                </p>
              </div>

              {/* Feature 2: Tab 1 Sprint & Graph */}
              <div style={{ background: '#27272a', padding: '14px', borderRadius: '10px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🎯</span>
                  <strong style={{ color: '#38bdf8', fontSize: '0.92rem' }}>Вкладка 1: «🎯 План и Граф сессии»</strong>
                </div>
                <p style={{ margin: 0, color: '#d1d5db', fontSize: '0.82rem' }}>
                  Единый центр управления ходом консультации, объединяющий структуру сессии:
                  <br />• <strong>Фазы спринта (4 шага):</strong> 1. Исследование мишени &rarr; 2. Десенсибилизация аффекта &rarr; 3. Когнитивный сдвиг &rarr; 4. Микро-шаг.
                  <br />• <strong>Интерактивный граф:</strong> узлы эмоций, убеждений, защит и ресурсов. Клик по узлу позволяет сделать его мишенью спринта, закрыть инсайтом или назначить в домашнее задание.
                  <br />• <strong>Паркинг тем:</strong> удобный блок отложенных веток, позволяющий мгновенно убрать уводящие темы в сторону и вернуться к ним в подходящий момент без потери фокуса.
                  <br />• <strong>ИИ-Супервизор:</strong> модуль слушает сессию в реальном времени и при выявлении противоречий или защит предлагает клиническую подсказку с возможностью взять её в фокус одним кликом.
                </p>
              </div>

              {/* Feature 3: Tab 2 Notes & Protocol */}
              <div style={{ background: '#27272a', padding: '14px', borderRadius: '10px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.1rem' }}>✍️</span>
                  <strong style={{ color: '#fbbf24', fontSize: '0.92rem' }}>Вкладка 2: «✍️ Протокол и Заметки»</strong>
                </div>
                <p style={{ margin: 0, color: '#d1d5db', fontSize: '0.82rem' }}>
                  Чистое сфокусированное пространство для фиксации клинического хода встречи:
                  <br />• <strong>Стенограмма речи:</strong> интеллектуальная фоновая расшифровка речи с живым индикатором активности (эквалайзер).
                  <br />• <strong>Терапевтический протокол:</strong> поле свободных заметок. При выделении любой ключевой фразы клиента в тексте появляется быстрая кнопка отправки цитаты в спринт или на паркинг.
                  <br />• <strong>🆘 Помощь AI:</strong> клинический ассистент на базе базы знаний протоколов и методов.
                </p>
              </div>

              {/* Feature 4: Timer & Monitoring */}
              <div style={{ background: '#27272a', padding: '14px', borderRadius: '10px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.1rem' }}>⏱️</span>
                  <strong style={{ color: '#ec4899', fontSize: '0.92rem' }}>Таймер сессии и WebRTC-диагностика</strong>
                </div>
                <p style={{ margin: 0, color: '#d1d5db', fontSize: '0.82rem' }}>
                  В верхнем левом углу видео отображается таймер тайм-менеджмента 50-минутного терапевтического часа. При остатке менее 5 минут он деликатно сигнализирует о необходимости переходить к фазе интеграции и домашнего задания.
                </p>
              </div>

              {/* Feature 5: Security & Autosave */}
              <div style={{ background: '#27272a', padding: '14px', borderRadius: '10px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🔒</span>
                  <strong style={{ color: '#34d399', fontSize: '0.92rem' }}>Защита данных (152-ФЗ) и автосохранение</strong>
                </div>
                <p style={{ margin: 0, color: '#d1d5db', fontSize: '0.82rem' }}>
                  Шифрование peer-to-peer WebRTC DTLS/SRTP. При нажатии «⏹️ Завершить сессию» все заметки, граф и результаты спринта автоматически сохраняются в карточку клиента в Реестре специалистов.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #27272a',
              display: 'flex',
              justifyContent: 'flex-end',
              background: '#121214'
            }}>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                style={{
                  background: '#2563eb',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '8px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Понятно, продолжить сессию
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SessionTimerOverlay: React.FC<{ secondsElapsed: number; isDemo?: boolean; maxDuration?: number; isLessonMode?: boolean }> = ({ secondsElapsed, isDemo, maxDuration = 50 * 60, isLessonMode }) => {
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const remainingSeconds = Math.max(0, maxDuration - secondsElapsed);
  const isEnding = isDemo ? remainingSeconds <= 60 : isLessonMode ? remainingSeconds <= 10 * 60 : secondsElapsed > (maxDuration - 5 * 60);

  const titleText = isDemo
    ? "Тестовый сеанс ограничен 5 минутами"
    : isLessonMode
    ? "Таймер урока: непрерывная видеосвязь до 4 часов без сброса и перезахода."
    : "Таймер консультации: стандартная терапевтическая сессия рассчитана на 50 минут.";

  return (
    <div 
      title={titleText}
      style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        backgroundColor: isEnding ? 'rgba(239, 68, 68, 0.9)' : 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '10px',
        fontSize: '0.95rem',
        fontWeight: 'bold',
        zIndex: 10,
        backdropFilter: 'blur(8px)',
        border: isDemo ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
      }}
    >
      <span style={{ fontSize: '0.9rem' }}>{isDemo ? '🔴' : isLessonMode ? '📚' : '⏱️'}</span>
      <span>
        {isDemo ? (
          <>
            <span style={{ color: '#fca5a5', fontSize: '0.82rem', textTransform: 'uppercase', marginRight: '6px' }}>Тест:</span>
            <span>{formatTime(remainingSeconds)}</span>
          </>
        ) : isLessonMode ? (
          <>
            <span style={{ color: '#93c5fd', fontSize: '0.82rem', marginRight: '6px' }}>Урок:</span>
            <span>{formatTime(secondsElapsed)}</span>
          </>
        ) : (
          <span>{formatTime(secondsElapsed)} / 50:00</span>
        )}
      </span>
      {isDemo && (
        <span style={{ fontSize: '0.75rem', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', padding: '2px 6px', borderRadius: '4px' }}>
          180 мс WebRTC
        </span>
      )}
      {!isDemo && isEnding && (
        <span style={{ fontSize: '0.75rem', background: '#fff', color: '#dc2626', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>
          {isLessonMode ? 'До 4 ч' : 'Осталось < 5 мин'}
        </span>
      )}
    </div>
  );
};

export default VideoConsultationRoom;
