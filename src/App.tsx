/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Video, Wallet, CreditCard, ShieldAlert, BookOpen, 
  UserCheck, LogIn, RefreshCw, Menu, X, ArrowUpRight, Lock, LogOut
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import MeetingRoom from './components/MeetingRoom';
import WalletDash from './components/WalletDash';
import BillingSaaS from './components/BillingSaaS';
import AdminPanel from './components/AdminPanel';
import TechnicalGuides from './components/TechnicalGuides';
import { User, Wallet as WalletType } from './types';
import { apiFetch } from './utils/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('sinergia_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [walletBalance, setWalletBalance] = useState<number>(0.00);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'MEETING' | 'WALLET' | 'BILLING' | 'ADMIN' | 'GUIDE'>('DASHBOARD');
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [pendingMeetingId, setPendingMeetingId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const mId = params.get('meeting');
    if (mId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      return mId;
    }
    return null;
  });

  // Redirect to active meeting once authenticated
  useEffect(() => {
    if (currentUser && pendingMeetingId) {
      handleJoinMeeting(pendingMeetingId);
      setPendingMeetingId(null);
    }
  }, [currentUser, pendingMeetingId]);

  // Upload hooks & handlers
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const res = await apiFetch('/api/users/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, avatar: base64String }),
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          localStorage.setItem('sinergia_user', JSON.stringify(data.user));
        } else {
          console.error('Error al subir la foto de perfil en el servidor.');
        }
      } catch (err) {
        console.error('Error de comunicación con el servidor al subir la foto de perfil.', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const res = await apiFetch('/api/users/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, companyLogo: base64String }),
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          localStorage.setItem('sinergia_user', JSON.stringify(data.user));
        } else {
          console.error('Error al subir el logo de empresa en el servidor.');
        }
      } catch (err) {
        console.error('Error de comunicación con el servidor al subir el logo de empresa.', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Auth form states
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Authenticate user with Backend
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const resText = await res.text();
      let data: any;
      try {
        data = JSON.parse(resText);
      } catch (pErr) {
        throw new Error(`Respuesta inválida (Status ${res.status}): ${resText.trim().slice(0, 150) || '(Vacío/No-Body)'}`);
      }

      if (res.ok) {
        setCurrentUser(data.user);
        localStorage.setItem('sinergia_user', JSON.stringify(data.user));
      } else {
        setAuthError(data.error || 'Credenciales inválidas o correo no registrado.');
      }
    } catch (err) {
      setAuthError('Error al contactar con el nodo central de Sinergia: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAuthLoading(false);
    }
  };

  // Register user with Backend
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
      });

      const resText = await res.text();
      let data: any;
      try {
        data = JSON.parse(resText);
      } catch (pErr) {
        throw new Error(`Respuesta inválida (Status ${res.status}): ${resText.trim().slice(0, 150) || '(Vacío/No-Body)'}`);
      }

      if (res.ok) {
        setCurrentUser(data.user);
        localStorage.setItem('sinergia_user', JSON.stringify(data.user));
      } else {
        setAuthError(data.error || 'El correo electrónico ya existe.');
      }
    } catch (err) {
      setAuthError('Error corporativo de comunicación de red: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAuthLoading(false);
    }
  };

  // Helper for quick setup & preview of Admin user
  const handleQuickAdminLogin = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'josegregoriourdanetaguadama@gmail.com', password: 'admin' }),
      });

      const resText = await res.text();
      let data: any;
      try {
        data = JSON.parse(resText);
      } catch (pErr) {
        throw new Error(`Respuesta inválida (Status ${res.status}): ${resText.trim().slice(0, 150) || '(Vacío/No-Body)'}`);
      }

      if (res.ok) {
        setCurrentUser(data.user);
        localStorage.setItem('sinergia_user', JSON.stringify(data.user));
      } else {
        setAuthError(data.error || 'Error al autenticar');
      }
    } catch (err) {
      setAuthError('Error de red: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAuthLoading(false);
    }
  };

  // Session destruction
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sinergia_user');
    setActiveTab('DASHBOARD');
    setActiveMeetingId(null);
  };

  // Pull active Sinergia Wallet credits from Server-side database
  useEffect(() => {
    fetchWalletBalance();
  }, [currentUser]);

  const fetchWalletBalance = async () => {
    if (!currentUser) return;
    try {
      const res = await apiFetch(`/api/wallet/balance/${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setWalletBalance(data.wallet.balance);
      }
    } catch (e) {
      console.warn('Billetera no accesible localmente');
    }
  };

  const handleJoinMeeting = (meetingId: string) => {
    setActiveMeetingId(meetingId);
    setActiveTab('MEETING');
  };

  const menuItems = [
    { id: 'DASHBOARD', label: 'Inicio', icon: Video, roles: ['USER', 'ADMIN', 'ENTERPRISE'] },
    { id: 'WALLET', label: 'Sinergia Wallet', icon: Wallet, roles: ['USER', 'ADMIN', 'ENTERPRISE'] },
    { id: 'BILLING', label: 'Planes SaaS', icon: CreditCard, roles: ['USER', 'ADMIN', 'ENTERPRISE'] },
    { id: 'ADMIN', label: 'Consola Admin', icon: ShieldAlert, roles: ['ADMIN'] },
    { id: 'GUIDE', label: 'Manuales & API', icon: BookOpen, roles: ['USER', 'ADMIN', 'ENTERPRISE'] },
  ];

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans animation-fade-in" id="login-portal">
        {/* Abstract graphics background */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-sm bg-[#1E293B]/80 border border-[#2D3748] rounded-2xl p-7 space-y-6 relative z-10 shadow-2xl backdrop-blur-md">
          {/* Logo brand */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#3B82F6] flex items-center justify-center font-display font-extrabold text-white tracking-widest text-[22px] shadow-lg shadow-blue-500/25">
              S
            </div>
            <div>
              <h2 className="font-display font-bold tracking-tight text-white text-lg">Sinergia Meet</h2>
              <p className="text-[10px] text-[#94A3B8] font-mono tracking-wider mt-0.5">SaaS de Videollamadas & Billetera</p>
            </div>
          </div>

          {pendingMeetingId && (
            <div className="p-3.5 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-200 text-xs flex flex-col gap-1 shadow-inner">
              <span className="font-bold flex items-center gap-1.5 text-blue-400 font-mono text-[11px] uppercase tracking-wider">⚡ Invitación activa</span>
              <p className="text-[11px] text-slate-300 leading-normal">Inicia sesión, regístrate o usa la Entrada Instantánea para unirte de inmediato a la sala de videoconferencia.</p>
            </div>
          )}

          {/* Toggle buttons */}
          <div className="grid grid-cols-2 gap-1 bg-[#0F172A] p-1 rounded-xl border border-[#2D3748]">
            <button
              id="auth-toggle-login"
              type="button"
              onClick={() => { setAuthMode('LOGIN'); setAuthError(''); }}
              className={`py-1.5 rounded-lg text-center font-mono text-xs font-bold transition-all cursor-pointer ${
                authMode === 'LOGIN' ? 'bg-[#1E293B] text-[#3B82F6] border border-[#2D3748]' : 'text-[#94A3B8]'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              id="auth-toggle-register"
              type="button"
              onClick={() => { setAuthMode('REGISTER'); setAuthError(''); }}
              className={`py-1.5 rounded-lg text-center font-mono text-xs font-bold transition-all cursor-pointer ${
                authMode === 'REGISTER' ? 'bg-[#1E293B] text-[#3B82F6] border border-[#2D3748]' : 'text-[#94A3B8]'
              }`}
            >
              Regístrate
            </button>
          </div>

          <form onSubmit={authMode === 'LOGIN' ? handleLogin : handleRegister} className="space-y-4">
            {authMode === 'REGISTER' && (
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-[#94A3B8] uppercase tracking-wider font-semibold">Nombre Completo</label>
                <input
                  id="auth-name-input"
                  type="text"
                  required
                  placeholder="Ej: José Urdaneta"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full bg-[#0F172A] border border-[#2D3748] rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[9px] font-mono text-[#94A3B8] uppercase tracking-wider font-semibold">Correo Electrónico</label>
              <input
                id="auth-email-input"
                type="email"
                required
                placeholder="Ej: josegregoriourdanetaguadama@gmail.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-[#0F172A] border border-[#2D3748] rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-mono text-[#94A3B8] uppercase tracking-wider font-semibold">Contraseña</label>
              <input
                id="auth-password-input"
                type="password"
                required
                placeholder="••••••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#0F172A] border border-[#2D3748] rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors"
              />
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] flex items-center gap-2" id="auth-error-alert">
                <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-blue-500/20 disabled:bg-slate-700 disabled:cursor-not-allowed"
            >
              {authLoading ? 'Procesando...' : authMode === 'LOGIN' ? 'Ingresar al Ecosistema' : 'Registrarse y Obtener Regalo'}
            </button>
          </form>

          {/* Quick Admin Sign In Helper */}
          <div className="pt-3.5 border-t border-[#2D3748] text-center space-y-1.5">
            <span className="text-[10px] text-[#94A3B8] font-mono block">¿Quieres probar rápido el sistema?</span>
            <button
              id="auth-quick-admin-btn"
              type="button"
              onClick={handleQuickAdminLogin}
              disabled={authLoading}
              className="py-2 px-3 rounded-lg bg-[#1E293B] border border-[#2D3748] hover:bg-slate-800 text-xs font-semibold text-[#3B82F6] hover:text-blue-400 transition-colors cursor-pointer w-full uppercase tracking-wider"
            >
              ⚡ Entrada Instantánea de Super Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col md:flex-row relative font-sans">
      
      {/* Sidebar background visual noise glow */}
      <div className="absolute top-1/4 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* MOBILE HEADER TOP BAR PANEL */}
      <header className="md:hidden w-full bg-white border-b border-slate-200 text-slate-800 px-5 py-4 flex justify-between items-center z-40 sticky top-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-display font-black text-white shadow-md shadow-blue-600/30">
            S
          </div>
          <span className="font-display font-bold tracking-tight text-slate-800 text-base">Sinergia Meet</span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 py-1 px-2.5 rounded-lg border border-blue-100">
            ${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </span>
          <button 
            id="mobile-hamburger"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* SIDEBAR NAVIGATION DRAWER */}
      <aside className={`fixed md:sticky top-0 left-0 h-full w-72 bg-[#0F172A] border-r border-[#1E293B] p-6 flex flex-col justify-between z-40 transition-transform duration-300 transform md:transform-none ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        
        <div className="space-y-8">
          {/* Logo brand */}
          <div className="hidden md:flex items-center gap-3">
            <div 
              onClick={() => logoInputRef.current?.click()}
              className="w-10 h-10 rounded-xl bg-[#3B82F6] flex items-center justify-center font-display font-extrabold text-white tracking-widest text-[19px] shadow-lg shadow-blue-500/25 cursor-pointer relative group overflow-hidden"
              title="Subir logo de la empresa"
            >
              {currentUser.companyLogo ? (
                <img src={currentUser.companyLogo} className="w-full h-full object-cover" alt="Logo de Sinergia" />
              ) : (
                'S'
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity" id="logo-hover-indicator">
                <span className="text-[8px] uppercase tracking-wider font-mono font-bold text-slate-200">Logo</span>
              </div>
            </div>
            <div>
              <h2 className="font-display font-bold tracking-tight text-white text-[15px] leading-tight">Sinergia Meet</h2>
              <span className="text-[9px] text-[#94A3B8] font-mono tracking-wider">CREATIVE SAAS v1.0.0</span>
            </div>
            
            {/* Hidden files upload controls */}
            <input 
              type="file" 
              ref={logoInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleLogoUpload} 
            />
            <input 
              type="file" 
              ref={avatarInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleAvatarUpload} 
            />
          </div>

          {/* Account and balance info strip */}
          <div className="p-4 rounded-xl bg-[#1E293B]/60 border border-[#2D3748] space-y-3.5 text-slate-300">
            <div className="flex items-center gap-3">
              <img 
                referrerPolicy="no-referrer"
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'} 
                alt={currentUser.name} 
                className="w-10 h-10 rounded-full border border-[#2D3748] object-cover cursor-pointer hover:border-[#3B82F6] hover:scale-105 transition-all shadow-sm"
                onClick={() => avatarInputRef.current?.click()}
                title="Subir foto de perfil"
              />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white max-w-[140px] truncate">{currentUser.name}</p>
                <span className="text-[9px] font-mono py-0.5 px-2 bg-blue-500/10 text-blue-400 rounded border border-blue-500/15 font-semibold">
                  {currentUser.role}
                </span>
              </div>
            </div>

            {/* Wallet Quick indicators and refresh */}
            <div className="pt-2.5 border-t border-[#2D3748] flex justify-between items-center text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono">Billetera</span>
                <span className="font-semibold text-emerald-400 font-mono">${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
              </div>

              <button 
                id="btn-refresh-balance-direct"
                onClick={fetchWalletBalance} 
                className="p-1 hover:bg-[#1E293B]/80 text-[#94A3B8] hover:text-white rounded transition-colors cursor-pointer"
                title="Sincronizar saldo de Sinergia Wallet"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.55">
            <span className="text-[10px] font-mono text-slate-500 tracking-wider font-bold block pb-1.5 uppercase">
              Aplicaciones del Ecosistema
            </span>
            {menuItems
              .filter(item => item.roles.includes(currentUser.role))
              .map((item) => {
                const IconComp = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-tab-${item.id.toLowerCase()}`}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setSidebarOpen(false);
                      if (item.id !== 'MEETING') {
                        setActiveMeetingId(null);
                      }
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl font-medium text-xs flex items-center gap-3.5 transition-all text-left cursor-pointer ${
                      isSelected 
                        ? 'bg-[#1E293B] text-[#3B82F6] font-[#3B82F6] font-semibold shadow-sm' 
                        : 'hover:bg-[#1E293B]/60 text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                  >
                    <IconComp className="w-4.5 h-4.5" />
                    {item.label}
                  </button>
                );
              })}
          </nav>
        </div>

        {/* ACCOUNT ALTERATOR DROPDOWN SIMULATOR - REPLACED WITH REAL LOGOUT BUTTON */}
        <div className="pt-6 border-t border-[#1E293B] space-y-3">
          <button 
            id="btn-logout"
            onClick={handleLogout}
            className="w-full py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-bold text-xs rounded-xl cursor-pointer transition-all uppercase tracking-wider flex items-center justify-center gap-2 border border-rose-500/15"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            Cerrar Sesión
          </button>

          <p className="text-[9px] text-[#94A3B8]/60 leading-normal font-mono text-center">
            Sinergia Agencia Creativa SAS © 2026. Todos los derechos reservados.
          </p>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT SCROLL CONTAINER */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto" id="applet-view-content">
        
        {/* Render Tab accordingly */}
        {activeTab === 'DASHBOARD' && (
          <Dashboard 
            user={currentUser} 
            onJoinMeeting={handleJoinMeeting}
            onNavigateToWallet={() => setActiveTab('WALLET')}
            onNavigateToBilling={() => setActiveTab('BILLING')}
          />
        )}

        {activeTab === 'MEETING' && activeMeetingId && (
          <MeetingRoom 
            meetingId={activeMeetingId} 
            user={currentUser} 
            onExit={() => {
              setActiveMeetingId(null);
              setActiveTab('DASHBOARD');
            }}
          />
        )}

        {activeTab === 'WALLET' && (
          <WalletDash user={currentUser} />
        )}

        {activeTab === 'BILLING' && (
          <BillingSaaS 
            user={currentUser} 
            onRefreshUserBalance={fetchWalletBalance}
          />
        )}

        {activeTab === 'ADMIN' && currentUser.role === 'ADMIN' && (
          <AdminPanel />
        )}

        {activeTab === 'GUIDE' && (
          <TechnicalGuides />
        )}

      </main>

    </div>
  );
}
