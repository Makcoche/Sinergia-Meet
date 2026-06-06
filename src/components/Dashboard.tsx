/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Video, Calendar, Users, ArrowRight, ShieldCheck, Lock, Play, Plus, Trash2, Clock, Globe, Link } from 'lucide-react';
import { Meeting, User, Team } from '../types';

interface DashboardProps {
  user: User;
  onJoinMeeting: (meetingId: string) => void;
  onNavigateToWallet: () => void;
  onNavigateToBilling: () => void;
}

export default function Dashboard({ user, onJoinMeeting, onNavigateToWallet, onNavigateToBilling }: DashboardProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPass, setNewPass] = useState('');
  const [waitingRoom, setWaitingRoom] = useState(true);
  const [scheduledDate, setScheduledDate] = useState('');

  const [teamName, setTeamName] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (meetingId: string) => {
    const inviteUrl = `${window.location.origin}?meeting=${meetingId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedId(meetingId);
    setTimeout(() => setCopiedId(null), 3000);
  };

  // Fetch initial meetings and teams
  useEffect(() => {
    fetchMeetings();
    fetchTeams();
  }, [user]);

  const fetchMeetings = async () => {
    try {
      const res = await fetch('/api/meetings');
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch(`/api/teams/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          hostId: user.id,
          hostName: user.name,
          password: newPass || undefined,
          waitingRoom,
          scheduledFor: scheduledDate || undefined
        })
      });

      if (res.ok) {
        const created = await res.json();
        setShowCreateModal(false);
        setNewTitle('');
        setNewPass('');
        setScheduledDate('');
        fetchMeetings();
        
        // If instant, join immediately
        if (!scheduledDate) {
          onJoinMeeting(created.id);
        }
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Error al crear la reunión');
      }
    } catch (err) {
      setErrorMessage('Error de red al establecer conexión con el servidor de Sinergia.');
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName) return;

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName, ownerId: user.id })
      });

      if (res.ok) {
        setTeamName('');
        setIsCreatingTeam(false);
        fetchTeams();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard-workspace">
      {/* Welcome Banner */}
      <div className="p-8 rounded-2xl glass-panel relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-l-4 border-l-[#3B82F6]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2 text-[#3B82F6] font-mono text-xs uppercase tracking-wider font-bold">
            <Globe className="w-4 h-4 text-[#3B82F6]" /> S i n e r g i a &nbsp; M e e t
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight text-[#0F172A]">
            Hola de nuevo, <span className="text-[#3B82F6] font-semibold">{user.name}</span>
          </h1>
          <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
            Bienvenido al centro de comunicaciones de Sinergia Agencia Creativa SAS. Gestiona tus salas y tu Sinergia Wallet en un solo ecosistema integrado.
          </p>
        </div>

        <div className="flex gap-4 z-10 w-full md:w-auto">
          <button 
            id="btn-create-meet-modal"
            onClick={() => setShowCreateModal(true)}
            className="flex-1 md:flex-none py-3 px-6 rounded-xl bg-[#3B82F6] hover:bg-blue-700 font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 text-xs uppercase tracking-wider"
          >
            <Video className="w-4.5 h-4.5" />
            Nueva Reunión
          </button>
        </div>
      </div>

      {/* Grid Quick Entry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Wallet Indicator Card */}
        <div className="p-6 rounded-2xl glass-panel glass-card-hover flex flex-col justify-between h-50 relative overflow-hidden bg-white border border-slate-200">
          <div className="z-10">
            <span className="text-[10px] font-mono text-emerald-600 bg-emerald-500/10 py-1 px-3 rounded-full uppercase tracking-wider font-bold border border-emerald-500/10">
              Billetera Activa
            </span>
            <h3 className="text-lg font-display font-semibold mt-3.5 text-slate-900">Sinergia Wallet</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Realiza recargas, transferencias y retiros inmediatos antifraude.</p>
          </div>
          <button 
            id="btn-nav-wallet"
            onClick={onNavigateToWallet}
            className="text-emerald-600 hover:text-emerald-700 font-bold text-xs flex items-center gap-1.5 mt-4 group z-10 cursor-pointer uppercase tracking-wider"
          >
            Ir a Sinergia Wallet <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 text-emerald-600" />
          </button>
        </div>

        {/* Upgrade subscription Card */}
        <div className="p-6 rounded-2xl glass-panel glass-card-hover flex flex-col justify-between h-50 relative overflow-hidden bg-white border border-slate-200">
          <div className="z-10">
            <span className="text-[10px] font-mono text-[#3B82F6] bg-blue-500/10 py-1 px-3 rounded-full uppercase tracking-wider font-bold border border-blue-500/10">
              Planes SaaS
            </span>
            <h3 className="text-lg font-display font-semibold mt-3.5 text-slate-900">Suscripción SaaS</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Sube de nivel para videoconferencias HD ilimitadas de alta fidelidad.</p>
          </div>
          <button 
            id="btn-nav-billing"
            onClick={onNavigateToBilling}
            className="text-[#3B82F6] hover:text-blue-700 font-bold text-xs flex items-center gap-1.5 mt-4 group z-10 cursor-pointer uppercase tracking-wider"
          >
            Mejorar Plan <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 text-[#3B82F6]" />
          </button>
        </div>

        {/* Security Compliance Info */}
        <div className="p-6 rounded-2xl glass-panel flex flex-col justify-between h-50 bg-slate-50 border border-dashed border-slate-300">
          <div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <ShieldCheck className="w-5 h-5 text-slate-600" />
              <span className="text-[10px] font-mono font-bold text-slate-700 uppercase tracking-wider">Cumplimiento OWASP</span>
            </div>
            <h3 className="text-base font-display font-semibold mt-2.5 text-slate-900">Seguridad Empresarial</h3>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Protección XSS, inyecciones SQL mitigadas, encriptación AES-256 para enlaces únicos y auditoría transaccional.
            </p>
          </div>
          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5 text-slate-400" /> Criptografía avanzada
          </div>
        </div>
      </div>

      {/* Main Section Meetings List & Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Meetings Section (2 cols on large screen) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center pb-2">
            <h2 className="text-lg font-display font-bold flex items-center gap-2 text-slate-900 uppercase tracking-wide">
              <Clock className="w-5 h-5 text-[#3B82F6]" /> Salas de videoconferencia activas
            </h2>
            <button 
              id="btn-refresh-meetings"
              onClick={fetchMeetings} 
              className="text-xs text-[#3B82F6] hover:underline font-mono cursor-pointer uppercase font-bold"
            >
              [Actualizar]
            </button>
          </div>

          <div id="meetings-list" className="space-y-4">
            {meetings.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-white border border-slate-200 border-dashed text-slate-400 text-sm">
                No hay reuniones programadas o activas en este momento.
              </div>
            ) : (
              meetings.map((meet) => (
                <div 
                  key={meet.id} 
                  id={`meeting-card-${meet.id}`}
                  className="p-5 rounded-xl glass-panel hover:bg-slate-50/50 transition-all duration-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-slate-200"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-display font-bold text-slate-950 text-sm">{meet.title}</h4>
                      {meet.status === 'LIVE' ? (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      ) : null}
                      <span className={`text-[9px] font-mono py-0.5 px-2 rounded-full border ${
                        meet.status === 'LIVE' 
                          ? 'border-red-500/30 text-red-500 bg-red-50' 
                          : 'border-blue-500/30 text-blue-500 bg-blue-50'
                      }`}>
                        {meet.status === 'LIVE' ? 'EN VIVO' : 'PROGRAMADO'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Anfitrión: <strong className="text-slate-800">{meet.hostName}</strong></span>
                      {meet.scheduledFor ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(meet.scheduledFor).toLocaleString()}
                        </span>
                      ) : (
                        <span>Reunión instantánea</span>
                      )}
                      {meet.password && (
                        <span className="text-indigo-600 font-mono text-[10px] font-semibold bg-indigo-50 border border-indigo-100 px-1.5 rounded">[Contraseña requerida]</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                      id={`btn-share-meet-${meet.id}`}
                      onClick={() => handleCopyLink(meet.id)}
                      className={`w-full sm:w-auto py-2 px-4 rounded-lg border transition-all text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                        copiedId === meet.id
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Link className="w-3.5 h-3.5" />
                      {copiedId === meet.id ? '¡Enlace copiado!' : 'Copiar enlace'}
                    </button>
                    <button 
                      id={`btn-join-meet-${meet.id}`}
                      onClick={() => onJoinMeeting(meet.id)}
                      className="w-full sm:w-auto py-2 px-5 rounded-lg bg-slate-900 hover:bg-[#3B82F6] text-white transition-all font-semibold text-xs flex items-center justify-center gap-1.5 group cursor-pointer border border-slate-800"
                    >
                      <Play className="w-3 h-3 fill-current text-white" />
                      {meet.status === 'LIVE' ? 'Unirse a sala' : 'Iniciar'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Teams and Workspaces col */}
        <div className="space-y-4">
          <h2 className="text-lg font-display font-bold flex items-center gap-2 text-slate-900 uppercase tracking-wide">
            <Users className="w-5 h-5 text-[#3B82F6]" /> Equipos de Sinergia
          </h2>

          <div className="p-5 rounded-2xl glass-panel space-y-4 border border-slate-200">
            <form onSubmit={handleCreateTeam} className="flex gap-2">
              <input 
                id="input-team-name"
                type="text" 
                placeholder="Crear nuevo equipo..." 
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-850 outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
              />
              <button 
                id="btn-create-team"
                type="submit" 
                className="p-2 rounded-lg bg-[#3B82F6] hover:bg-blue-700 text-white cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 text-white font-bold" />
              </button>
            </form>

            <div className="divide-y divide-slate-100">
              {teams.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-4 text-center">No has creado ningún equipo para organizar videollamadas corporativas.</p>
              ) : (
                teams.map((t) => (
                  <div key={t.id} className="py-3 flex justify-between items-center">
                    <div>
                      <h5 className="text-xs font-semibold text-slate-800">{t.name}</h5>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {t.id}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                      {t.membersCount} miembros
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CREATE MEETING MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="modal-container">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 relative shadow-2xl space-y-5">
            <h3 className="text-xl font-display font-medium text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#3B82F6]" /> Crear videoconferencia
            </h3>

            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Título de la reunión o proyecto</label>
                <input 
                  id="meet-title-input"
                  type="text" 
                  required
                  placeholder="Ej: Revisión de Diseño de Sinergia Pay"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Contraseña de acceso (Opcional)</label>
                <input 
                  id="meet-pass-input"
                  type="password" 
                  placeholder="Dejar vacío para entrada pública"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Programar fecha de videoconferencia (Opcional)</label>
                <input 
                  id="meet-date-input"
                  type="datetime-local" 
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] font-mono"
                />
              </div>

              <div className="flex items-center justify-between py-2.5 border-t border-b border-slate-100 mt-2">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-700">Sala de espera</span>
                  <span className="text-[10px] text-slate-400">Filtrar asistentes antes de entrar</span>
                </div>
                <input 
                  id="meet-waiting-room-toggle"
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={(e) => setWaitingRoom(e.target.checked)}
                  className="w-4 h-4 text-[#3B82F6] border-slate-300 rounded focus:ring-[#3B82F6]"
                />
              </div>

              {errorMessage && (
                <p className="text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">{errorMessage}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  id="btn-close-meet-modal"
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all text-sm font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  id="btn-submit-meet-modal"
                  type="submit" 
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-700 text-white transition-all text-sm font-medium cursor-pointer shadow-sm shadow-blue-500/10"
                >
                  Crear sala
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
