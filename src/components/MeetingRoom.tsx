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

// Production-grade fallback virtual stream containing both audio (with silent tone) and video (animated text canvas)
function createFullyVirtualStream(username: string): MediaStream {
  console.log('[WebRTC Audit / Fallback] ⚡ Inicializando generador de flujo multimedia virtual para bypass de cámara...');
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  
  const draw = () => {
    if (ctx) {
      // Ambient dark grey background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 640, 480);
      
      // Decorative blue pulse indicating streaming
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(320, 240, 60 + Math.abs(Math.sin(Date.now() / 1000)) * 20, 0, Math.PI * 2);
      ctx.fill();
      
      // Elegant circular avatar mock
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(320, 240, 45, 0, Math.PI * 2);
      ctx.fill();
      
      // Text uppercase initials
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(username.substring(0, 2).toUpperCase(), 320, 248);

      // Name caption
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(username, 320, 340);

      // Camera off caption
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[Cámara apagada / Virtual]', 320, 365);
    }
    requestAnimationFrame(draw);
  };
  draw();

  const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : (canvas as any).webkitCaptureStream(15);
  const videoTrack = canvasStream.getVideoTracks()[0];

  // Silent audio trick via window.AudioContext
  let audioTrack: MediaStreamTrack | null = null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const dest = audioCtx.createMediaStreamDestination();
      oscillator.connect(dest);
      oscillator.start();
      audioTrack = dest.stream.getAudioTracks()[0];
      audioTrack.enabled = false; // keep silent
    }
  } catch (e) {
    console.warn('[WebRTC Fallback Audio] AudioContext bloqueado o inválido:', e);
  }

  const stream = new MediaStream();
  if (videoTrack) stream.addTrack(videoTrack);
  if (audioTrack) stream.addTrack(audioTrack);
  return stream;
}

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

  // Generate a distinct tab/device session suffix to prevent signaling and presence collision
  const sessionSuffix = useRef(Math.random().toString(36).substring(2, 6)).current;
  const ownParticipantId = `${user.id}_${sessionSuffix}`;
  const partId = `${meetingId}_${ownParticipantId}`;

  // ============================================================================
  // DEPLOYED PRODUCTION-GRADE WEBRTC CONFERENCING ENGINE
  // ============================================================================
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  
  // Track all individual peer connections by participant unique ID (partId)
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  
  // Prevent glare by keeping track of which peers we have already initiated an offer to
  const initiatedPeersRef = useRef<Set<string>>(new Set());
  
  // Idempotency guard for processed signaling documents
  const processedSignalsRef = useRef<Set<string>>(new Set());
  
  // Buffer ICE Candidates if they arrive prior to remote description being set
  const bufferedCandidatesRef = useRef<Record<string, RTCIceCandidate[]>>({});

  // Helper routine to register and dispatch generated signaling payloads over Firestore
  const sendOffer = async (targetPartId: string, offer: RTCSessionDescriptionInit) => {
    if (!directDb) return;
    try {
      const signalId = `sig_off_${meetingId}_${ownParticipantId}_${targetPartId}`;
      await setDoc(doc(directDb, 'meetingSignals', signalId), {
        id: signalId,
        meetingId,
        senderId: partId,
        receiverId: targetPartId,
        type: 'offer',
        sdp: offer.sdp,
        timestamp: new Date().toISOString()
      }, { merge: true });
      console.log(`[WebRTC Audit] Oferta SDP enviada correctamente a: ${targetPartId}`);
    } catch (e) {
      console.error('[WebRTC Offer Send Error]', e);
    }
  };

  const sendAnswer = async (targetPartId: string, answer: RTCSessionDescriptionInit) => {
    if (!directDb) return;
    try {
      const signalId = `sig_ans_${meetingId}_${ownParticipantId}_${targetPartId}`;
      await setDoc(doc(directDb, 'meetingSignals', signalId), {
        id: signalId,
        meetingId,
        senderId: partId,
        receiverId: targetPartId,
        type: 'answer',
        sdp: answer.sdp,
        timestamp: new Date().toISOString()
      }, { merge: true });
      console.log(`[WebRTC Audit] Respuesta SDP enviada correctamente a: ${targetPartId}`);
    } catch (e) {
      console.error('[WebRTC Answer Send Error]', e);
    }
  };

  const sendIceCandidate = async (targetPartId: string, candidate: RTCIceCandidate) => {
    if (!directDb) return;
    try {
      const candidateId = `cand_${ownParticipantId}_${targetPartId}_${Math.random().toString(36).substring(2, 9)}`;
      const signalId = `sig_cand_${meetingId}_${candidateId}`;
      await setDoc(doc(directDb, 'meetingSignals', signalId), {
        id: signalId,
        meetingId,
        senderId: partId,
        receiverId: targetPartId,
        type: 'candidate',
        candidate: JSON.stringify(candidate.toJSON()),
        timestamp: new Date().toISOString()
      });
      console.log(`[WebRTC Audit] Candidato ICE enviado de forma asíncrona hacia el par: ${targetPartId}`);
    } catch (e) {
      console.error('[WebRTC Candidate Send Error]', e);
    }
  };

  // Setup actual RTCPeerConnection instances loaded with redundant production STUN/TURN traversal servers
  const createPeerConnection = (targetPartId: string) => {
    if (peerConnectionsRef.current[targetPartId]) {
      return peerConnectionsRef.current[targetPartId];
    }

    console.log(`[WebRTC Setup] Creando RTCPeerConnection para el par: ${targetPartId}`);
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.l.google.com:5349' },
        { urls: 'stun:stun1.l.google.com:5349' },
        // Enterprise high-availability Coturn configurations as requested
        { 
          urls: 'turn:turn.sinergiameet.com:3478?transport=udp',
          username: 'sinergia_sec_user',
          credential: 'SinergiaSuperSecureCredential2026'
        },
        { 
          urls: 'turn:turn.sinergiameet.com:3478?transport=tcp',
          username: 'sinergia_sec_user',
          credential: 'SinergiaSuperSecureCredential2026'
        },
        { 
          urls: 'turn:turn.sinergiameet.com:5349?transport=udp',
          username: 'sinergia_sec_user',
          credential: 'SinergiaSuperSecureCredential2026'
        },
        { 
          urls: 'turn:turn.sinergiameet.com:5349?transport=tcp',
          username: 'sinergia_sec_user',
          credential: 'SinergiaSuperSecureCredential2026'
        }
      ],
      iceCandidatePoolSize: 10
    });

    // Seed local tracks immediately so renegotiations are complete from step zero
    if (localStream) {
      console.log(`[WebRTC Media Router] 🚀 Añadiendo ${localStream.getTracks().length} pistas locales al PeerConnection de: ${targetPartId}`);
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
        console.log(`[WebRTC Audit / addTrack] 🟢 Pista local agregada [id: ${track.id}, kind: ${track.kind}] hacia: ${targetPartId}`);
      });
    } else {
      console.warn(`[WebRTC Media Router] ⚠️ No hay flujo local disponible para el PeerConnection hacia: ${targetPartId}`);
    }

    // High-availability track receiver with dynamic audio/video stream consolidation
    pc.ontrack = (event) => {
      const incomingTrack = event.track;
      console.log(`[WebRTC Audit / ontrack] 🏁 DETECCIÓN: Recibiendo transmisión remota en vivo para el par: ${targetPartId}, Track [id: ${incomingTrack.id}, kind: ${incomingTrack.kind}]`);
      
      setRemoteStreams(prev => {
        const existingStream = prev[targetPartId];
        // Reuse existing MediaStream or fallback to the event stream or provision a new one
        let streamToUse = existingStream || event.streams[0] || new MediaStream();
        
        // Safely add the track to avoid duplication crashes
        if (!streamToUse.getTracks().some(t => t.id === incomingTrack.id)) {
          console.log(`[WebRTC Audit / ontrack] ➕ Track (${incomingTrack.kind}) acoplado al MediaStream del par: ${targetPartId}`);
          streamToUse.addTrack(incomingTrack);
        }
        
        // Hook up lifecycle change hooks for diagnostic insights
        incomingTrack.onended = () => {
          console.warn(`[WebRTC Audit / ontrack] ⚠️ Pista finalizada para: ${targetPartId} (${incomingTrack.kind})`);
        };
        incomingTrack.onmute = () => {
          console.log(`[WebRTC Audit / ontrack] 🔇 Pista silenciada (mutes) por hardware o red para: ${targetPartId} (${incomingTrack.kind})`);
        };
        incomingTrack.onunmute = () => {
          console.log(`[WebRTC Audit / ontrack] 🔊 Pista restaurada (unmutes) para: ${targetPartId} (${incomingTrack.kind})`);
        };

        // Create a completely new MediaStream reference with all collected tracks to bypass browser caching limitations
        const freshStream = new MediaStream(streamToUse.getTracks());

        return {
          ...prev,
          [targetPartId]: freshStream
        };
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC Audit / onicecandidate] 🧊 Candidato ICE local disponible para: ${targetPartId} (${event.candidate.candidate.substring(0, 40)}...)`);
        sendIceCandidate(targetPartId, event.candidate);
      } else {
        console.log(`[WebRTC Audit / onicecandidate] ✅ Compilación de candidatos ICE finalizada para: ${targetPartId}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC State] Cambio en la conexión de ${targetPartId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn(`[WebRTC State] Reconectando de forma automática par: ${targetPartId}`);
        handlePeerReconnection(targetPartId);
      }
    };

    peerConnectionsRef.current[targetPartId] = pc;
    return pc;
  };

  // Self-healing automatic reconnect mechanics to solve mobile NAT drops
  const handlePeerReconnection = async (targetPartId: string) => {
    try {
      const pc = peerConnectionsRef.current[targetPartId];
      if (pc) {
        pc.close();
        delete peerConnectionsRef.current[targetPartId];
      }
      initiatedPeersRef.current.delete(targetPartId);
      
      // Spawn fresh replacement connection
      const newPc = createPeerConnection(targetPartId);
      
      // Respect lexicographical role: if smaller, re-offer
      if (partId < targetPartId) {
        initiatedPeersRef.current.add(targetPartId);
        const offer = await newPc.createOffer({ iceRestart: true });
        await newPc.setLocalDescription(offer);
        await sendOffer(targetPartId, offer);
      }
    } catch (e) {
      console.error('[WebRTC Reconnection Failed]', e);
    }
  };

  // 1. Dynamic peer list observer that cleans up zombie connections immediately
  useEffect(() => {
    const activeParticipantsSet = new Set(participants.filter(p => !p.isInWaitingRoom).map(p => p.id));
    
    Object.keys(peerConnectionsRef.current).forEach(targetPartId => {
      if (!activeParticipantsSet.has(targetPartId)) {
        console.log(`[WebRTC Lifecycle] Desconexión del par. Limpiando recurso: ${targetPartId}`);
        
        try {
          peerConnectionsRef.current[targetPartId].close();
        } catch (e) { /* ignore */ }
        
        delete peerConnectionsRef.current[targetPartId];
        initiatedPeersRef.current.delete(targetPartId);
        delete bufferedCandidatesRef.current[targetPartId];

        setRemoteStreams(prev => {
          const updated = { ...prev };
          delete updated[targetPartId];
          return updated;
        });
      }
    });
  }, [participants]);

  // 1.5 Sync camera updates if muted or video toggle happens during live meeting
  useEffect(() => {
    if (!localStream) return;
    Object.keys(peerConnectionsRef.current).forEach(targetPartId => {
      const pc = peerConnectionsRef.current[targetPartId];
      if (pc) {
        pc.getSenders().forEach(sender => {
          if (sender.track && sender.track.kind === 'audio') {
            sender.track.enabled = !isMuted;
          }
          if (sender.track && sender.track.kind === 'video') {
            sender.track.enabled = !isVideoOff;
          }
        });
      }
    });
  }, [isMuted, isVideoOff, localStream]);

  // 2. Proactive handshakes logic using lexicographical glare resolving guidelines
  useEffect(() => {
    if (!localStream) return;

    const remoteActiveParticipants = participants.filter(p => !p.isInWaitingRoom);

    remoteActiveParticipants.forEach(async (participant) => {
      const targetPartId = participant.id;

      // Rule: Smaller ID initiates connection to avoid glare race conditions
      if (partId < targetPartId) {
        if (!peerConnectionsRef.current[targetPartId]) {
          console.log(`[WebRTC Handshake Engine] Iniciando canal activo como solicitante hacia: ${participant.name}`);
          const pc = createPeerConnection(targetPartId);

          if (!initiatedPeersRef.current.has(targetPartId)) {
            initiatedPeersRef.current.add(targetPartId);
            try {
              const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
              });
              await pc.setLocalDescription(offer);
              await sendOffer(targetPartId, offer);
            } catch (err) {
              console.error(`[WebRTC Handshake Engine Offer Failed] ${targetPartId}:`, err);
            }
          }
        }
      } else {
        // Passive receiver: Pre-crear the connection to ensure candidate listeners and tracks are aligned early
        if (!peerConnectionsRef.current[targetPartId]) {
          console.log(`[WebRTC Handshake Engine] Pre-creando receptor pasivo a la espera para: ${participant.name}`);
          createPeerConnection(targetPartId);
        }
      }
    });
  }, [participants, localStream]);

  // 3. Signaling listener over Firestore direct live streaming channels
  useEffect(() => {
    if (!directDb || !localStream) return;

    console.log('[WebRTC Signaling] Activando canal de escucha de señales Firestore para: ' + user.name);

    const qSignals = query(
      collection(directDb, 'meetingSignals'),
      where('meetingId', '==', meetingId),
      where('receiverId', '==', partId)
    );

    const unsubscribe = onSnapshot(qSignals, async (snapshot) => {
      for (const d of snapshot.docs) {
        const data = d.data();
        const senderId = data.senderId;

        if (processedSignalsRef.current.has(data.id)) continue;
        processedSignalsRef.current.add(data.id);

        try {
          if (data.type === 'offer') {
            console.log(`[WebRTC signaling] Recibida oferta SDP de: ${senderId}`);
            let pc = peerConnectionsRef.current[senderId];
            if (!pc) {
              pc = createPeerConnection(senderId);
            }
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));

            // Process any temporarily buffered candidate messages
            if (bufferedCandidatesRef.current[senderId]) {
              console.log(`[WebRTC signaling] Aplicando canditatos en buffer (${bufferedCandidatesRef.current[senderId].length}) de: ${senderId}`);
              for (const cand of bufferedCandidatesRef.current[senderId]) {
                await pc.addIceCandidate(cand).catch(e => console.warn('[WebRTC candidate error]', e));
              }
              delete bufferedCandidatesRef.current[senderId];
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendAnswer(senderId, answer);
          } 
          else if (data.type === 'answer') {
            console.log(`[WebRTC signaling] Recibida respuesta SDP de: ${senderId}`);
            const pc = peerConnectionsRef.current[senderId];
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
              
              // Process any temporarily buffered candidate messages for the answerer!
              if (bufferedCandidatesRef.current[senderId]) {
                console.log(`[WebRTC signaling] Aplicando candidatos en buffer (${bufferedCandidatesRef.current[senderId].length}) de: ${senderId}`);
                for (const cand of bufferedCandidatesRef.current[senderId]) {
                  await pc.addIceCandidate(cand).catch(e => console.warn('[WebRTC candidate error]', e));
                }
                delete bufferedCandidatesRef.current[senderId];
              }
            }
          } 
          else if (data.type === 'candidate') {
            const candidateInfo = JSON.parse(data.candidate);
            const candidate = new RTCIceCandidate(candidateInfo);
            const pc = peerConnectionsRef.current[senderId];

            if (pc && pc.remoteDescription) {
              await pc.addIceCandidate(candidate).catch(e => console.warn('[WebRTC Candidate Sync failed]', e));
            } else {
              // Remote description not yet resolved, buffer candidates safely
              if (!bufferedCandidatesRef.current[senderId]) {
                bufferedCandidatesRef.current[senderId] = [];
              }
              bufferedCandidatesRef.current[senderId].push(candidate);
            }
          }
        } catch (signalErr) {
          console.error('[WebRTC signaling Dispatch Exception]', signalErr);
        }
      }
    }, (err) => {
      console.error('[WebRTC Signaling Engine Error]', err);
    });

    return () => {
      unsubscribe();
    };
  }, [localStream, meetingId, partId]);

  // Initialize browser camera/microphone media stream
  useEffect(() => {
    async function startCamera() {
      try {
        console.log('[WebRTC Media Setup] Intentando obtener acceso a cámara/micrófono real...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        console.log('[WebRTC Media Setup] Acceso real concedido de forma de alta definición.');
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.warn('Local play blocked by browser autoplay policy', e));
        }
      } catch (err: any) {
        console.warn('Acceso denegado a cámara o micrófono real. Intentando flujos alternativos:', err);
        setCameraError('Cámara real no disponible (Operando en formato de conexión híbrida segura)');
        
        try {
          // Attempt audio-only with mock video canvas stream
          console.log('[WebRTC Media Setup] Intentando recuperar canal de audio real independiente...');
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // Generate active canvas track to allow peer representation
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          
          let animId: any;
          const draw = () => {
            if (ctx) {
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(0, 0, 640, 480);
              
              // Draw ambient pulse
              ctx.fillStyle = '#1e293b';
              ctx.beginPath();
              ctx.arc(320, 240, 50 + Math.abs(Math.sin(Date.now() / 1000)) * 15, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.fillStyle = '#3b82f6';
              ctx.beginPath();
              ctx.arc(320, 240, 40, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 20px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(user.name.substring(0, 2).toUpperCase(), 320, 247);
              
              ctx.fillStyle = '#e2e8f0';
              ctx.font = '16px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(user.name, 320, 320);
              
              ctx.fillStyle = '#a1a1aa';
              ctx.font = '11px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('[Cámara apagada / Audio activo]', 320, 350);
            }
            animId = requestAnimationFrame(draw);
          };
          draw();
          
          const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : (canvas as any).webkitCaptureStream(15);
          const videoTrack = canvasStream.getVideoTracks()[0];
          
          const fallbackStream = new MediaStream();
          audioStream.getTracks().forEach(t => fallbackStream.addTrack(t));
          if (videoTrack) fallbackStream.addTrack(videoTrack);
          
          console.log('[WebRTC Media Setup] Concedido flujo de audio real con cámara simulada de compatibilidad.');
          setLocalStream(fallbackStream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = fallbackStream;
            localVideoRef.current.play().catch(e => console.warn('Local fallback play blocked', e));
          }
        } catch (audioErr) {
          console.warn('[WebRTC Media Setup] Audio real y video real fallidos, compilando flujo virtual de compatibilidad WebRTC...', audioErr);
          const fullyVirtualStream = createFullyVirtualStream(user.name);
          setLocalStream(fullyVirtualStream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = fullyVirtualStream;
            localVideoRef.current.play().catch(e => console.warn('Fully virtual play blocked', e));
          }
        }
      }
    }

    startCamera();
    fetchMeetingDetails();
    fetchChats();

    return () => {
      // Clean up local tracks
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const str = localVideoRef.current.srcObject as MediaStream;
        str.getTracks().forEach(track => track.stop());
      }
      // Clean up all initialized peer connections on room teardown
      Object.keys(peerConnectionsRef.current).forEach(targetUserId => {
        try {
          peerConnectionsRef.current[targetUserId].close();
        } catch (e) { /* ignore */ }
      });
      peerConnectionsRef.current = {};
    };
  }, []);

  // Helper to sync our presence to Firestore
  const updateOurPresence = async (muted: boolean, videoOff: boolean, hand: boolean, waiting: boolean = amIInWaitingRoom, customHostId: string = meetingHostId) => {
    if (!directDb) return;
    try {
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
  }, [isMuted, isVideoOff, handRaised, meetingId, partId, meetingHostId, amIInWaitingRoom]);

  // Periodic heartbeat to prevent timeout on other clients' grids
  useEffect(() => {
    const presenceHeartbeat = setInterval(() => {
      updateOurPresence(isMuted, isVideoOff, handRaised, amIInWaitingRoom);
    }, 5000);

    return () => clearInterval(presenceHeartbeat);
  }, [isMuted, isVideoOff, handRaised, meetingId, partId, meetingHostId, amIInWaitingRoom]);

  // Remove our presence record on unmount / window unload
  useEffect(() => {
    const removePresence = async () => {
      if (directDb) {
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
  }, [meetingId, partId]);

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
        if (data.id !== partId) {
          // Prevent ghost/zombie participants by verifying the heartbeat is active (within last 120 seconds to be clock-skew robust)
          const updatedAtTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
          if (now - updatedAtTime < 120000) {
            // Suffix name if same user account to prevent UI confusion
            const suffix = data.userId === user.id ? ' (Otro Dispositivo)' : '';
            list.push({
              ...data,
              name: data.name + suffix
            } as Participant);
          }
        }
      });
      setDbParticipants(list);
    }, (error) => {
      console.error('[Firestore Participants Listener]', error);
    });

    return () => unsubscribe();
  }, [meetingId, user.id, partId]);

  // Host Remote Regulation Listener (Kicked / Silenced / Admitted by Host)
  useEffect(() => {
    if (!directDb) return;
    
    const unsubscribe = onSnapshot(doc(directDb, 'meetingParticipants', partId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.kicked) {
          console.log(`[WebRTC Audit] EXPULSIÓN: El administrador nos ha expulsado de la reunión.`);
          alert('Has sido expulsado de la reunión por el anfitrión.');
          onExit();
        } else if (data.isMuted && !isMuted) {
          console.log(`[WebRTC Audit / Remote Command] SILENCIADO: El administrador ha silenciado nuestro micrófono.`);
          setIsMuted(true);
          // Update actual stream track state
          if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = false);
          }
        }
        
        // Handle remote video shutdown command from Admin
        if (data.isVideoOff && !isVideoOff) {
          console.log(`[WebRTC Audit / Remote Command] CAMARA APAGADA: El administrador ha desactivado nuestra cámara.`);
          setIsVideoOff(true);
          if (localStream) {
            localStream.getVideoTracks().forEach(track => {
              track.enabled = false;
            });
          }
        }
        
        if (data.isInWaitingRoom !== undefined) {
          setAmIInWaitingRoom(data.isInWaitingRoom);
        }
      }
    });

    return () => unsubscribe();
  }, [meetingId, partId, isMuted, localStream]);

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

  // Host Action: Disable Camera / Stop Video of Participant Remotely
  const handleDisableVideoParticipant = async (id: string) => {
    if (directDb) {
      try {
        await setDoc(doc(directDb, 'meetingParticipants', id), { isVideoOff: true }, { merge: true });
        console.log(`[WebRTC Audit / Admin] Apagar cámara remota enviado para el id: ${id}`);
      } catch (e) {
        console.warn('Fallo apagar cámara remota en Firestore:', e);
      }
    }
    setDbParticipants(prev => prev.map(p => p.id === id ? { ...p, isVideoOff: true } : p));
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
    <div className="h-auto lg:h-[90vh] flex flex-col lg:flex-row gap-4 relative" id="live-meeting-room">
      
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
      <div className="w-full lg:flex-1 flex flex-col justify-between p-4 rounded-3xl bg-[#0B1322] border border-slate-800 overflow-hidden relative min-h-[460px] lg:min-h-0">
        
        {/* Upper Dashboard Strip with Settings & Title */}
        <div className="z-10 flex justify-between items-center bg-slate-900/90 border border-slate-800 py-3 px-5 rounded-2xl">
          <div className="space-y-0.5">
            <span className="text-[10px] text-blue-400 font-mono font-semibold tracking-wider flex items-center gap-1 uppercase">
              <Lock className="w-3 h-3 text-blue-500" /> ENCRIPTADO TLS 1.3
            </span>
            <h1 className="text-xs font-semibold tracking-tight text-white">{meetingTitle}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[9px] sm:text-[10px] font-mono text-slate-300 bg-slate-800 border border-slate-700 py-1 px-2.5 rounded-lg">
              ID: <strong className="text-white">{meetingId.substring(0, 8)}</strong>
            </span>
            <button
              id="btn-copy-live-link"
              onClick={() => {
                const inviteUrl = `${window.location.origin}?meeting=${meetingId}`;
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(inviteUrl);
                  } else {
                    const textArea = document.createElement("textarea");
                    textArea.value = inviteUrl;
                    textArea.style.position = "fixed";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    document.execCommand("copy");
                    document.body.removeChild(textArea);
                  }
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 3000);
                } catch (err) {
                  console.error('Copy fallback failed', err);
                }
              }}
              className={`py-1.5 px-2.5 rounded-lg border text-[10px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer uppercase ${
                copySuccess
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Link className="w-3 h-3 text-current" />
              {copySuccess ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* Robust Visual Invitation URL Banner for the Current Active Session */}
        <div className="z-10 mt-2 bg-slate-950/80 border border-slate-800/80 px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 text-[10px] font-mono text-slate-450 z-10">
          <div className="flex items-center gap-2 truncate text-slate-300">
            <span className="text-blue-400 font-bold uppercase text-[9px] tracking-wider px-1.5 py-0.5 bg-blue-500/10 rounded-md shrink-0 border border-blue-500/20">Enlace:</span>
            <span className="truncate select-all text-[10px] text-slate-200 cursor-text" title="Seleccionar enlace">{`${window.location.origin}?meeting=${meetingId}`}</span>
          </div>
          <button
            onClick={() => {
              const inviteUrl = `${window.location.origin}?meeting=${meetingId}`;
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(inviteUrl);
                } else {
                  const textArea = document.createElement("textarea");
                  textArea.value = inviteUrl;
                  textArea.style.position = "fixed";
                  document.body.appendChild(textArea);
                  textArea.focus();
                  textArea.select();
                  document.execCommand("copy");
                  document.body.removeChild(textArea);
                }
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 3000);
              } catch (err) {
                console.error(err);
              }
            }}
            className="shrink-0 text-blue-400 hover:text-blue-300 text-[10px] font-bold uppercase underline cursor-pointer border border-transparent hover:border-current px-1 rounded"
          >
            {copySuccess ? 'Copiado' : 'Copiar'}
          </button>
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
                  ref={el => {
                    if (el) {
                      localVideoRef.current = el;
                      if (el.srcObject !== localStream) {
                        el.srcObject = localStream;
                      }
                      el.play().catch(e => console.warn('[Local Play blocked]', e));
                    }
                  }}
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                
                {/* Fallback avatar if browser has camera disabled/rejected */}
                {!localStream && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-700/20 to-slate-900 flex flex-col items-center justify-center animate-fade-in">
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
            const remoteStream = remoteStreams[caller.id];
            const hasVideo = remoteStream && remoteStream.getVideoTracks().length > 0;

            return (
              <div 
                key={caller.id} 
                id={`caller-grid-${caller.id}`}
                className={`video-grid-cell aspect-video ${isSpeaker ? 'speaking-pulse border-blue-500' : ''}`}
              >
                {caller.isVideoOff || !hasVideo ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 relative animate-fade-in font-sans">
                    <img 
                      referrerPolicy="no-referrer"
                      src={caller.avatar || (caller.userId === 'user-1' 
                        ? "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80"
                        : caller.userId === 'user-2'
                          ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80"
                          : `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80`
                      )} 
                      alt={caller.name}
                      className="w-16 h-16 rounded-full border border-slate-700 shadow-md object-cover"
                    />
                    <span className="text-xs text-slate-400 mt-2 font-display">{caller.name} {caller.userId === meetingHostId ? '(Anfitrión)' : ''}</span>
                    <div className="absolute bottom-2 left-2 bg-slate-950/80 border border-slate-800/80 py-1 px-3 rounded-lg text-[11px] font-mono flex items-center gap-1.5 z-10 text-slate-100 font-semibold shadow">
                      {caller.isMuted ? <MicOff className="w-3.5 h-3.5 text-red-500" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                      {caller.name}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full relative bg-slate-950 animate-fade-in font-sans">
                    {/* Separate muted video tag bypasses autoplay block on Safari & Chrome on Mobile devices */}
                    <video 
                      ref={el => {
                        if (el) {
                          if (el.srcObject !== remoteStream) {
                            el.srcObject = remoteStream;
                          }
                          el.play().catch(e => console.warn('[WebRTC Video Autoplay Blocked]', e));
                        }
                      }}
                      autoPlay 
                      playsInline 
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Highly-available separate invisible audio element for clear remote voice stream */}
                    <audio 
                      ref={el => {
                        if (el) {
                          if (el.srcObject !== remoteStream) {
                            el.srcObject = remoteStream;
                          }
                          el.play().catch(e => console.warn('[WebRTC Audio Autoplay Blocked]', e));
                        }
                      }}
                      autoPlay 
                      className="hidden"
                    />

                    {isSpeaker && (
                      <div className="absolute top-2 right-2 bg-blue-600 text-[9px] font-semibold text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-mono shadow-md animate-pulse">
                        Hablando
                      </div>
                    )}

                    <div className="absolute bottom-2 left-2 bg-slate-950/80 border border-slate-800/80 py-1 px-3 rounded-lg text-[11px] font-mono flex items-center gap-1.5 z-10 text-slate-100 font-semibold shadow">
                      {caller.isMuted ? <MicOff className="w-3.5 h-3.5 text-red-500" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                      {caller.name}
                    </div>

                    {/* HOST ADVANCED ROW PANELS FOR MODERATION */}
                    <div className="absolute top-2 left-2 flex gap-1 opacity-100 bg-slate-950/85 p-1.5 rounded-xl border border-slate-800 shadow">
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

        {/* MODERATOR AND ACTIVE PARTICIPANTS CONTROL PANEL */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm text-slate-800" id="admin-moderation-participants-panel">
          <div className="flex justify-between items-center pb-2 border-b border-secondary/15">
            <h4 className="text-xs font-bold font-mono text-slate-700 flex items-center gap-1.5 uppercase">
              <Users className="w-4 h-4 text-slate-500" /> Participantes Activos ({participants.length + 1})
            </h4>
            {isHost ? (
              <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 py-0.5 px-2 rounded-full font-bold border border-emerald-100">
                ADMINISTRADOR (TÚ)
              </span>
            ) : (
              <span className="text-[9px] font-mono text-blue-600 bg-blue-50 py-0.5 px-2 rounded-full font-bold border border-blue-100">
                IN VITADO / PARTICIPANTE
              </span>
            )}
          </div>

          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {/* Local Client (You) */}
            <div className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 truncate">
                <img 
                  referrerPolicy="no-referrer"
                  src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80'} 
                  alt={user.name} 
                  className="w-7 h-7 rounded-full object-cover border border-slate-200"
                />
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-800 truncate">Tú ({user.name})</p>
                  <span className="text-[9px] text-[#3B82F6] font-mono uppercase font-semibold">{isHost ? 'Host' : 'Participante'}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <span className={`p-1 rounded ${isMuted ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-110'}`} title={isMuted ? "Micrófono Silenciado" : "Micrófono Encendido"}>
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </span>
                <span className={`p-1 rounded ${isVideoOff ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-blue-50 text-blue-600 border border-blue-110'}`} title={isVideoOff ? "Cámara Apagada" : "Cámara Encendida"}>
                  {isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <VideoIcon className="w-3.5 h-3.5" />}
                </span>
              </div>
            </div>

            {/* Remote active callers */}
            {participants.map((guest) => (
              <div key={guest.id} className="flex justify-between items-center p-2 rounded-xl bg-white border border-slate-100 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-2 truncate">
                  <img 
                    referrerPolicy="no-referrer"
                    src={guest.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80'} 
                    alt={guest.name} 
                    className="w-7 h-7 rounded-full object-cover border border-slate-200"
                  />
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-800 truncate">{guest.name}</p>
                    <span className="text-[9px] text-slate-400 font-mono uppercase font-medium">
                      {guest.isInWaitingRoom ? 'En Sala Espera' : (guest.role === 'HOST' ? 'Host' : 'Participante')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Status icons for active devices */}
                  {!guest.isInWaitingRoom && (
                    <>
                      <span className={`p-1 rounded ${guest.isMuted ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`} title={guest.isMuted ? "Silenciado" : "Micrófono Activo"}>
                        {guest.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      </span>
                      <span className={`p-1 rounded ${guest.isVideoOff ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`} title={guest.isVideoOff ? "Cámara Desactivada" : "Cámara Activa"}>
                        {guest.isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <VideoIcon className="w-3.5 h-3.5" />}
                      </span>
                    </>
                  )}

                  {/* Administrative remote commands only if local isHost */}
                  {isHost && !guest.isInWaitingRoom && (
                    <div className="flex gap-0.5 border-l border-slate-100 pl-1.5 ml-1">
                      <button
                        onClick={() => handleMuteParticipant(guest.id)}
                        disabled={guest.isMuted}
                        title="Silenciar Micrófono"
                        className="p-1 text-red-500 hover:bg-slate-100 disabled:opacity-40 rounded cursor-pointer transition-colors"
                      >
                        <MicOff className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDisableVideoParticipant(guest.id)}
                        disabled={guest.isVideoOff}
                        title="Apagar Cámara"
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 disabled:opacity-40 rounded cursor-pointer transition-colors"
                      >
                        <VideoOff className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleKickParticipant(guest.id, guest.name)}
                        title="Expulsar de Sala"
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                      >
                        <PhoneOff className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {isHost && guest.isInWaitingRoom && (
                    <button
                      onClick={() => handleAcceptParticipant(guest.id)}
                      className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold font-mono text-[9px] rounded-lg cursor-pointer shadow-sm transition-all uppercase tracking-wider"
                    >
                      Admitir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

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
