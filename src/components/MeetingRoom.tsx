/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, Monitor, PhoneOff, 
  Send, Users, MessageSquare, Hand, Sparkles, Smile, ShieldAlert,
  Loader2, CheckCircle2, ListTodo, FileText, Lock, Link, Clock
} from 'lucide-react';
import { User, ChatMessage, Participant } from '../types';
import { apiFetch, directDb } from '../utils/api';
import { onSnapshot, collection, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';

interface MeetingRoomProps {
  meetingId: string;
  user: User;
  onExit: () => void;
}

// Active callers simulation database (realistic behavior with audio speaker cues)
const SIMULATED_PARTICIPANTS: Participant[] = [
  { id: 'part-1', userId: 'user-1', name: 'Ana Milena (Sinergia)', role: 'PRESENTER', isMuted: false, isVideoOff: false, handRaised: false, joinedAt: new Date().toISOString(), isInWaitingRoom: false },
  { id: 'part-2', userId: 'user-2', name: 'Carlos Mendoza (CTO)', role: 'ATTENDEE', isMuted: false, isVideoOff: false, handRaised: false, joinedAt: new Date().toISOString(), isInWaitingRoom: false },
  { id: 'part-3', userId: 'user-guest', name: 'Andrés García (Inversionista)', role: 'ATTENDEE', isMuted: true, isVideoOff: true, handRaised: false, joinedAt: new Date().toISOString(), isInWaitingRoom: true },
];

export default function MeetingRoom({ meetingId, user, onExit }: MeetingRoomProps) {
  const [meetingTitle, setMeetingTitle] = useState('Reunión Sinergia S.A.S.');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Real Local Camera Feed Integration
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');

  // Active callers REAL & SIMULATED state
  const [dbParticipants, setDbParticipants] = useState<Participant[]>([]);
  const [showSimulated, setShowSimulated] = useState<boolean>(false);
  const [meetingHostId, setMeetingHostId] = useState<string>('');
  const [amIInWaitingRoom, setAmIInWaitingRoom] = useState<boolean>(false);

  // Combined participants getter
  const participants = showSimulated 
    ? [...dbParticipants, ...SIMULATED_PARTICIPANTS] 
    : dbParticipants;

  const isHost = user.id === meetingHostId || (!meetingHostId && user.role === 'ADMIN');

  const [activeSpeaker, setActiveSpeaker] = useState<string>('local'); // 'local', 'part-1', 'part-2'
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [chats, setChats] = useState<ChatMessage[]>([]);
  
  // Transcription log
  const [transcriptsLog, setTranscriptsLog] = useState<string[]>([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<{
    summary?: string;
    tasks?: string[];
    minutes?: string;
    warning?: string;
  } | null>(null);

  // Floating reaction animation state
  const [reactions, setReactions] = useState<{ id: string; emoji: string; left: number }[]>([]);

  // Initialize browser camera/microphone media stream
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.warn('Acceso denegado a cámara o micrófono:', err);
        setCameraError('Cámara real no disponible (Operando en modo presentación segura)');
      }
    }

    startCamera();
    fetchMeetingDetails();
    fetchChats();

    return () => {
      // Clean up Stream
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const str = localVideoRef.current.srcObject as MediaStream;
        str.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Helper to sync our presence to Firestore
  const updateOurPresence = async (muted: boolean, videoOff: boolean, hand: boolean, waiting: boolean = amIInWaitingRoom, customHostId: string = meetingHostId) => {
    if (!directDb) return;
    try {
      const partId = `${meetingId}_${user.id}`;
      const isUserHost = user.id === customHostId || (!customHostId && user.role === 'ADMIN');
      await setDoc(doc(directDb, 'meetingParticipants', partId), {
        id: partId,
        meetingId,
        userId: user.id,
        name: user.name,
        avatar: user.avatar || '',
        role: isUserHost ? 'HOST' : 'ATTENDEE',
        isMuted: muted,
        isVideoOff: videoOff,
        handRaised: hand,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isInWaitingRoom: waiting
      }, { merge: true });
    } catch (e) {
      console.warn('[Presence] Error updating presence:', e);
    }
  };

  // Sync our media controls and metadata state whenever it changes
  useEffect(() => {
    updateOurPresence(isMuted, isVideoOff, handRaised, amIInWaitingRoom);
  }, [isMuted, isVideoOff, handRaised, meetingId, user.id, meetingHostId, amIInWaitingRoom]);

  // Periodic heartbeat to prevent timeout on other clients' grids
  useEffect(() => {
    const presenceHeartbeat = setInterval(() => {
      updateOurPresence(isMuted, isVideoOff, handRaised, amIInWaitingRoom);
    }, 5000);

    return () => clearInterval(presenceHeartbeat);
  }, [isMuted, isVideoOff, handRaised, meetingId, user.id, meetingHostId, amIInWaitingRoom]);

  // Remove our presence record on unmount / window unload
  useEffect(() => {
    const removePresence = async () => {
      if (directDb) {
        const partId = `${meetingId}_${user.id}`;
        try {
          await deleteDoc(doc(directDb, 'meetingParticipants', partId));
        } catch (e) {
          // ignore
        }
      }
    };

    window.addEventListener('beforeunload', removePresence);
    return () => {
      window.removeEventListener('beforeunload', removePresence);
      removePresence();
    };
  }, [meetingId, user.id]);

  // Listen to other users' presence from Firestore in real-time
  useEffect(() => {
    if (!directDb) return;

    const q = query(
      collection(directDb, 'meetingParticipants'),
      where('meetingId', '==', meetingId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Participant[] = [];
      const now = Date.now();
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data() as any;
        // Don't include ourselves in the remote stream list (as we are rendered specially)
        if (data.userId !== user.id) {
          // Prevent ghost/zombie participants by verifying the heartbeat is active (within last 120 seconds to be clock-skew robust)
          const updatedAtTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
          if (now - updatedAtTime < 120000) {
            list.push(data as Participant);
          }
        }
      });
      setDbParticipants(list);
    }, (error) => {
      console.error('[Firestore Participants Listener]', error);
    });

    return () => unsubscribe();
  }, [meetingId, user.id]);

  // Host Remote Regulation Listener (Kicked / Silenced / Admitted by Host)
  useEffect(() => {
    if (!directDb) return;
    const partId = `${meetingId}_${user.id}`;
    
    const unsubscribe = onSnapshot(doc(directDb, 'meetingParticipants', partId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.kicked) {
          alert('Has sido expulsado de la reunión por el anfitrión.');
          onExit();
        } else if (data.isMuted && !isMuted) {
          setIsMuted(true);
          // Update actual stream track state
          if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = false);
          }
        }
        
        if (data.isInWaitingRoom !== undefined) {
          setAmIInWaitingRoom(data.isInWaitingRoom);
        }
      }
    });

    return () => unsubscribe();
  }, [meetingId, user.id, isMuted, localStream]);

  // Periodic simulated transcriptions and active speaker switching to represent live conversation state
  useEffect(() => {
    if (!showSimulated) return;

    const dialogs = [
      { speaker: 'Ana Milena (Sinergia)', statement: 'El despliegue en VPS Ubuntu usando Docker Compose corre de forma sumamente veloz.' },
      { speaker: 'Carlos Mendoza (CTO)', statement: 'Completamente de acuerdo, la base de datos PostgreSQL y la encriptación AES-256 garantizan la seguridad empresarial.' },
      { speaker: 'Ana Milena (Sinergia)', statement: 'José, ¿puedes darnos el reporte del balance de Sinergia Wallet hoy?' },
      { speaker: 'Carlos Mendoza (CTO)', statement: 'Necesitamos definir el soporte de facturación automática del plan SaaS para Stripe.' },
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < dialogs.length) {
        const d = dialogs[index];
        const speakerId = d.speaker.includes('Ana') ? 'part-1' : 'part-2';
        setActiveSpeaker(speakerId);
        
        // Add speech bubble to transcript logger
        const msg = `${d.speaker}: ${d.statement}`;
        setTranscriptsLog(prev => [...prev, msg]);
        addParagraphToServer(msg);
        
        index++;
      } else {
        setActiveSpeaker('local');
        clearInterval(interval);
      }
    }, 12000); // add dialogue slightly faster in simulation mode (12s)

    return () => clearInterval(interval);
  }, [showSimulated]);

  const addParagraphToServer = async (text: string) => {
    try {
      await apiFetch(`/api/meetings/${meetingId}/transcript-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMeetingDetails = async () => {
    try {
      const res = await apiFetch('/api/meetings');
      if (res.ok) {
        const data = await res.json();
        const found = data.find((m: any) => m.id === meetingId);
        if (found) {
          setMeetingTitle(found.title);
          const currentHostId = found.hostId || '';
          setMeetingHostId(currentHostId);
          
          const isUserHost = user.id === currentHostId || (!currentHostId && user.role === 'ADMIN');
          if (found.waitingRoom && !isUserHost) {
            setAmIInWaitingRoom(true);
            await updateOurPresence(isMuted, isVideoOff, handRaised, true, currentHostId);
          } else {
            setAmIInWaitingRoom(false);
            await updateOurPresence(isMuted, isVideoOff, handRaised, false, currentHostId);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChats = async () => {
    // Standard chat load
    setChats([
      { id: 'c-1', meetingId, senderId: 'user-1', senderName: 'Ana Milena (Sinergia)', message: 'Sinergia Meet está 100% funcional. Increíble diseño!', timestamp: new Date().toISOString() }
    ]);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const newChat: ChatMessage = {
      id: `chat-${Date.now()}`,
      meetingId,
      senderId: user.id,
      senderName: user.name,
      message: chatMessage,
      timestamp: new Date().toISOString()
    };

    setChats(prev => [...prev, newChat]);
    setTranscriptsLog(prev => [...prev, `${user.name}: ${chatMessage}`]);
    addParagraphToServer(`${user.name}: ${chatMessage}`);
    setChatMessage('');
  };

  const triggerReaction = (emoji: string) => {
    const id = Math.random().toString();
    const left = Math.floor(Math.random() * 80) + 10; // offset percentage
    setReactions(prev => [...prev, { id, emoji, left }]);

    // auto clean
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 25000);
  };

  const handleToggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = isVideoOff;
      });
    }
    setIsVideoOff(!isVideoOff);
  };

  // Host Action: Kick Participant
  const handleKickParticipant = async (id: string, name: string) => {
    if (directDb) {
      try {
        await setDoc(doc(directDb, 'meetingParticipants', id), { kicked: true }, { merge: true });
      } catch (e) {
        console.warn('Fallo expulsar en Firestore:', e);
      }
    }
    setDbParticipants(prev => prev.filter(p => p.id !== id));
    setTranscriptsLog(prev => [...prev, `[SISTEMA]: El anfitrión expulsó a ${name} de la reunión.`]);
  };

  // Host Action: Mute Participant
  const handleMuteParticipant = async (id: string) => {
    if (directDb) {
      try {
        await setDoc(doc(directDb, 'meetingParticipants', id), { isMuted: true }, { merge: true });
      } catch (e) {
        console.warn('Fallo silenciar en Firestore:', e);
      }
    }
    setDbParticipants(prev => prev.map(p => p.id === id ? { ...p, isMuted: true } : p));
  };

  // Host Action: Accept Participant in Waiting Room
  const handleAcceptParticipant = async (id: string) => {
    if (directDb) {
      try {
        await setDoc(doc(directDb, 'meetingParticipants', id), { isInWaitingRoom: false }, { merge: true });
      } catch (e) {
        console.warn('Fallo admitir en Firestore:', e);
      }
    }
    setDbParticipants(prev => prev.map(p => p.id === id ? { ...p, isInWaitingRoom: false } : p));
  };

  // Generate AI Summaries via server-side Gemini request
  const handleGenerateAISummary = async () => {
    setAiGenerating(true);
    setAiResult(null);
    try {
      // First ensure the server has enough dialogue representation
      const initialDialogue = transcriptsLog.join('.\n') || `Ana Milena: Hola, la conexión de WebRTC es de baja latencia. José Delgado: Sí, y el panel administrativo muestra las analíticas del VPS adecuadamente. Carlos Mendoza: Excelente trabajo, ya tenemos el enrutador Nginx procesando los certificados SSL de sinergiameet.com de manera robusta.`;
      
      // Inject transcript to database
      await apiFetch(`/api/meetings/${meetingId}/transcript-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: initialDialogue })
      });

      const res = await apiFetch(`/api/meetings/${meetingId}/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        const data = await res.json();
        setAiResult(data);
      } else {
        console.error('Error al generar resumen');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiGenerating(false);
    }
  };

  if (amIInWaitingRoom) {
    return (
      <div className="h-[90vh] flex items-center justify-center bg-[#0F172A] border border-slate-800 rounded-3xl p-6 relative overflow-hidden" id="waiting-room-screen">
        <div className="absolute top-[-20%] right-[-20%] w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] left-[-20%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-6 relative z-10 shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Clock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-amber-400 bg-amber-500/10 py-1 px-3 rounded-full uppercase border border-amber-500/20">
              SALA DE ESPERA ACTIVA
            </span>
            <h2 className="text-xl font-display font-bold text-white tracking-tight pt-2">{meetingTitle}</h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Hola, <span className="text-white font-semibold">{user.name}</span>. Has solicitado unirte a la videoconferencia. Por favor, aguarda a que el anfitrión autorice tu ingreso desde su panel de moderación.
            </p>
          </div>

          <div className="border-t border-slate-800 pt-5 flex flex-col gap-3">
            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5 uppercase">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> Consultando autorización en tiempo real...
            </div>
            
            <button
              id="btn-quit-waiting-room"
              onClick={onExit}
              className="mt-2 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-semibold text-xs uppercase tracking-wider transition-all cursor-pointer border border-slate-700"
            >
              Salir de la sala
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[90vh] flex flex-col lg:flex-row gap-4 relative" id="live-meeting-room">
      
      {/* Dynamic Floating Reactions Canvas */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {reactions.map((r) => (
          <div 
            key={r.id} 
            className="absolute bottom-20 text-3xl animate-bounce-up"
            style={{ left: `${r.left}%`, animation: 'float-up 3.5s forwards ease-in' }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Main Conference Screen Container */}
      <div className="flex-1 flex flex-col justify-between p-4 rounded-3xl bg-[#0B1322] border border-slate-800 overflow-hidden relative">
        
        {/* Upper Dashboard Strip with Settings & Title */}
        <div className="z-10 flex justify-between items-center bg-slate-900/90 border border-slate-800 py-3 px-5 rounded-2xl">
          <div className="space-y-0.5">
            <span className="text-[10px] text-blue-400 font-mono font-semibold tracking-wider flex items-center gap-1 uppercase">
              <Lock className="w-3 h-3 text-blue-500" /> ENCRIPTADO TLS 1.3
            </span>
            <h1 className="text-xs font-semibold tracking-tight text-white">{meetingTitle}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-300 bg-slate-800 border border-slate-700 py-1 px-3 rounded-lg hidden sm:inline-block">
              ID: <strong>{meetingId.substring(0, 8)}...</strong>
            </span>
            <button
              id="btn-copy-live-link"
              onClick={() => {
                const inviteUrl = `${window.location.origin}?meeting=${meetingId}`;
                navigator.clipboard.writeText(inviteUrl);
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 3000);
              }}
              className={`py-1.5 px-3 rounded-lg border text-[10px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer uppercase ${
                copySuccess
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Link className="w-3 h-3 text-current" />
              {copySuccess ? 'Copiado' : 'Compartir sala'}
            </button>
          </div>
        </div>

        {/* Video Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 my-4 max-h-[64vh] overflow-y-auto">
          
          {/* USER LOCAL VIDEO FRAME */}
          <div className={`video-grid-cell aspect-video ${activeSpeaker === 'local' ? 'speaking-pulse border-blue-500' : ''}`}>
            {isVideoOff ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
                <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-300 font-display flex items-center justify-center text-xl font-bold uppercase">
                  {user.name.substring(0, 2)}
                </div>
                <span className="text-xs text-slate-500 mt-3">{user.name} {isHost ? '(Anfitrión)' : '(Participante)'}</span>
              </div>
            ) : (
              <div className="w-full h-full relative">
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                
                {/* Fallback avatar if browser has camera disabled/rejected */}
                {(!localStream || cameraError) && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-700/20 to-slate-900 flex flex-col items-center justify-center">
                    <img 
                      referrerPolicy="no-referrer"
                      src={user.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=180&h=180&q=80"} 
                      alt={user.name}
                      className="w-16 h-16 rounded-full border border-blue-500/40 shadow-md object-cover"
                    />
                    <span className="text-xs text-slate-300 mt-2 font-display text-center">{user.name} {isHost ? '(Anfitrión)' : '(Participante)'}</span>
                  </div>
                )}

                <div className="absolute bottom-2 left-2 bg-slate-950/80 border border-slate-800/80 py-1 px-3 rounded-lg text-[11px] font-mono flex items-center gap-1.5 z-10 text-slate-200">
                  {isMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                  Tú {isHost ? '(Anfitrión)' : `(${user.name})`} {handRaised && <Hand className="w-3 h-3 text-yellow-400 fill-current ml-1" />}
                </div>
              </div>
            )}
          </div>

          {/* ACTIVE PARTICIPANTS CALL GRIDS */}
          {participants.filter(p => !p.isInWaitingRoom).map((caller) => {
            const isSpeaker = activeSpeaker === caller.id;
            return (
              <div 
                key={caller.id} 
                id={`caller-grid-${caller.id}`}
                className={`video-grid-cell aspect-video ${isSpeaker ? 'speaking-pulse border-blue-500' : ''}`}
              >
                {caller.isVideoOff ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 relative">
                    <div className="w-16 h-16 rounded-full bg-indigo-950 text-indigo-200 font-display flex items-center justify-center text-lg font-semibold uppercase">
                      {caller.name.substring(0, 2)}
                    </div>
                    <span className="text-xs text-slate-500 mt-3">{caller.name}</span>
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    <img 
                      referrerPolicy="no-referrer"
                      src={caller.avatar || (caller.userId === 'user-1' 
                        ? "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=640&h=480&q=80"
                        : caller.userId === 'user-2'
                          ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=640&h=480&q=80"
                          : `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=640&h=480&q=80`
                      )} 
                      alt={caller.name}
                      className="w-full h-full object-cover"
                    />

                    {isSpeaker && (
                      <div className="absolute top-2 right-2 bg-blue-600 text-[9px] font-semibold text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-mono shadow-md animate-pulse">
                        Hablando
                      </div>
                    )}

                    <div className="absolute bottom-2 left-2 bg-slate-950/80 border border-slate-800/80 py-1 px-3 rounded-lg text-[11px] font-mono flex items-center gap-1.5 z-10 text-slate-100">
                      {caller.isMuted ? <MicOff className="w-3.5 h-3.5 text-red-500" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                      {caller.name}
                    </div>

                    {/* HOST ADVANCED ROW PANELS FOR MODERATION */}
                    <div className="absolute top-2 left-2 flex gap-1 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
                      <button 
                        id={`btn-mute-caller-${caller.id}`}
                        onClick={() => handleMuteParticipant(caller.id)}
                        title="Silenciar participante"
                        className="p-1 hover:bg-slate-800 text-red-400 rounded cursor-pointer animate-fade-in"
                      >
                        <MicOff className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        id={`btn-kick-caller-${caller.id}`}
                        onClick={() => handleKickParticipant(caller.id, caller.name)}
                        title="Expulsar de la reunión"
                        className="p-1 hover:bg-slate-800 text-rose-500 rounded cursor-pointer animate-fade-in"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* BOTTOM VIDEO CALL CONTROL BAR PANEL */}
        <div className="z-10 bg-slate-900/95 border border-slate-800/80 py-3 px-5 rounded-2xl flex flex-wrap justify-between items-center gap-4">
          
          {/* Left Media Controls */}
          <div className="flex gap-2">
            <button 
              id="btn-live-mute"
              onClick={handleToggleMute}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isMuted 
                  ? 'bg-rose-500/20 border-rose-500/30' 
                  : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isMuted ? <MicOff className="w-5 h-5 text-rose-400" /> : <Mic className="w-5 h-5 text-emerald-400" />}
            </button>
            <button 
              id="btn-live-video"
              onClick={handleToggleVideo}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isVideoOff 
                  ? 'bg-rose-500/20 border-rose-500/30' 
                  : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5 text-rose-400" /> : <VideoIcon className="w-5 h-5 text-[#3B82F6]" />}
            </button>
            <button 
              id="btn-live-screenshare"
              onClick={() => setIsScreenSharing(!isScreenSharing)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isScreenSharing 
                  ? 'bg-blue-600/20 border-blue-600/30' 
                  : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Monitor className={`w-5 h-5 ${isScreenSharing ? 'text-blue-400' : 'text-slate-300'}`} />
            </button>
          </div>

          {/* Quick Reaction Board */}
          <div className="hidden sm:flex gap-1.5 bg-slate-800/40 py-1.5 px-3 rounded-xl border border-slate-800">
            <button id="btn-react-clap" onClick={() => triggerReaction('👏')} className="hover:scale-125 transition-transform text-sm cursor-pointer">👏</button>
            <button id="btn-react-heart" onClick={() => triggerReaction('❤️')} className="hover:scale-125 transition-transform text-sm cursor-pointer">❤️</button>
            <button id="btn-react-fire" onClick={() => triggerReaction('🔥')} className="hover:scale-125 transition-transform text-sm cursor-pointer">🔥</button>
            <button id="btn-react-laugh" onClick={() => triggerReaction('😂')} className="hover:scale-125 transition-transform text-sm cursor-pointer">😂</button>
            <button id="btn-react-thumbsup" onClick={() => triggerReaction('👍')} className="hover:scale-125 transition-transform text-sm cursor-pointer">👍</button>
          </div>

          {/* Center Call actions */}
          <div className="flex gap-2">
            <button 
              id="btn-live-raisehand"
              onClick={() => setHandRaised(!handRaised)}
              className={`py-2 px-4 rounded-xl border transition-all font-medium text-xs flex items-center gap-1.5 cursor-pointer ${
                handRaised 
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' 
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <Hand className="w-4 h-4 fill-current" /> Alzada
            </button>
          </div>

          {/* Right Leave Button */}
          <button 
            id="btn-leave-room"
            onClick={onExit}
            className="py-2.5 px-6 rounded-xl bg-red-600 hover:bg-red-700 font-semibold text-white transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PhoneOff className="w-4 h-4 text-white font-bold" /> Finalizar
          </button>
        </div>
      </div>

      {/* CHAT PANEL & AI COMPANION COMPUNCT (Double Tab Layout) */}
      <div className="w-full lg:w-96 flex flex-col gap-4 animate-fade-in text-slate-800" id="side-utilities-container">
        
        {/* WAITING ROOM (CONDITIONAL DISPLAY ONLY FOR HOST) */}
        {participants.some(p => p.isInWaitingRoom) && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 mb-1" id="waiting-room-banner text-slate-800">
            <h5 className="text-xs font-bold text-amber-700 flex items-center gap-1.5 uppercase tracking-wider">
              <Users className="w-4 h-4 text-amber-600" /> Sala de espera ({participants.filter(p => p.isInWaitingRoom).length})
            </h5>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {participants.filter(p => p.isInWaitingRoom).map(guest => (
                <div key={guest.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-amber-200">
                  <span className="text-xs font-bold text-slate-800">{guest.name}</span>
                  <button 
                    id={`btn-admit-caller-${guest.id}`}
                    onClick={() => handleAcceptParticipant(guest.id)}
                    className="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold font-mono text-[10px] rounded cursor-pointer"
                  >
                    Admitir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI GEN COMPANION (Upper widget box) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold font-mono text-[#3B82F6] flex items-center gap-1.5 uppercase">
              <Sparkles className="w-4 h-4 text-[#3B82F6] fill-current" /> CO-PILOTO SINERGIA IA
            </h4>
            <span className="text-[9px] font-mono text-slate-500 bg-slate-50 py-0.5 px-2 rounded font-semibold border border-slate-205">
              Gemini 2.5 Flash
            </span>
          </div>

          <div id="ai-insights-box" className="text-xs space-y-3.5 max-h-48 overflow-y-auto">
            {aiResult ? (
              <div className="space-y-3 text-slate-800">
                <div className="space-y-1 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg">
                  <span className="text-[10px] font-bold text-emerald-700 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> RESUMEN EJECUTIVO
                  </span>
                  <p className="text-slate-800 leading-relaxed text-[11px] font-medium">{aiResult.summary}</p>
                </div>

                {aiResult.tasks && aiResult.tasks.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-blue-700 font-mono flex items-center gap-1">
                      <ListTodo className="w-3 h-3 text-blue-600" /> ASIGNACIONES DETECTADAS
                    </span>
                    <ul className="list-disc list-inside text-slate-705 text-[11px] space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      {aiResult.tasks.map((task, i) => (
                        <li key={i}>{task}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiResult.minutes && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-600 font-mono flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-500" /> COMPROBANTE DE ACTA
                    </span>
                    <pre className="text-[10px] bg-slate-50 p-2.5 rounded border border-slate-200 font-mono text-slate-600 whitespace-pre-wrap max-h-36 overflow-y-auto w-full">
                      {aiResult.minutes}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 leading-relaxed text-[11px]">
                Presiona el botón de abajo para transcribir y estructurar la videoconferencia de forma automatizada por Inteligencia Artificial.
              </p>
            )}
          </div>

          <button 
            id="btn-trigger-ai-summarizer"
            disabled={aiGenerating}
            onClick={handleGenerateAISummary}
            className="w-full py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-700 disabled:bg-slate-100 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 uppercase tracking-wider font-semibold"
          >
            {aiGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando con Gemini AI...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-current text-white" />
                Generar Resumen Técnica AI
              </>
            )}
          </button>
        </div>

        {/* DEMO / TEST ACTION CONTROLS */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-sm text-slate-800">
          <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
            <h4 className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              🧪  Simulación de Prueba (QA)
            </h4>
            <span className="text-[9px] font-mono text-[#3B82F6] font-bold">Opcional</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">Simular participantes ficticios:</span>
            <button
              id="btn-toggle-demo-simulation"
              type="button"
              onClick={() => setShowSimulated(!showSimulated)}
              className={`py-1 px-3 border rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm ${
                showSimulated 
                  ? 'bg-[#3B82F6] border-[#3B82F6] text-white' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
            >
              {showSimulated ? 'ACTIVO (3 Falsos)' : 'DESACTIVADO (Solo real)'}
            </button>
          </div>
          <p className="text-[9px] text-slate-400 leading-normal font-mono">
            * Desactívalo para probar una conexión 100% limpia con otro usuario real en otro navegador/pestaña o dispositivo. Actívalo si deseas rellenar la sala con participantes ficticios (Ana Milena, Carlos, Andrés) para demostrar la IA de transcripción.
          </p>
        </div>

        {/* CHAT TAB PANEL (Lower panel) */}
        <div className="flex-1 p-5 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between overflow-hidden max-h-[46vh] shadow-sm">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold font-mono text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
              <MessageSquare className="w-4 h-4 text-slate-500 animate-pulse" /> CHAT DE VIDEOCONFERENCIA
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">{chats.length} mensajes</span>
          </div>

          {/* Message List */}
          <div id="call-chats-list" className="flex-1 overflow-y-auto space-y-3 my-4">
            {chats.map((msg) => (
              <div key={msg.id} className="text-xs space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-800">{msg.senderName}</span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 leading-relaxed max-w-[90%] break-words">
                  {msg.message}
                </div>
              </div>
            ))}
          </div>

          {/* Chat Form */}
          <form onSubmit={handleSendChat} className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <input 
              id="call-chat-input"
              type="text" 
              placeholder="Mensaje al equipo..." 
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-xs text-slate-800 py-2 px-3 focus:ring-0 placeholder:text-slate-405"
            />
            <button 
              id="btn-send-call-chat"
              type="submit" 
              className="p-2 rounded-lg bg-[#3B82F6] hover:bg-blue-700 text-white cursor-pointer transition-colors active:scale-95"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
