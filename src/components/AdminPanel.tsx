/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, Cpu, Database, TrendingUp, Users, 
  Activity, RefreshCw, Layers, AlertOctagon, HelpCircle 
} from 'lucide-react';
import { AuditLog } from '../types';
import { apiFetch } from '../utils/api';

export default function AdminPanel() {
  const [metrics, setMetrics] = useState<any>({
    cpuUsage: '0.0 %',
    memoryUsage: '0 MB / 0 GB',
    dbPoolState: 'Cargando...',
    totalUsersCount: 0,
    activeMeetingsCount: 0,
    totalRevenueInUSD: 0,
    blockedAttemptsCounter: 0,
  });

  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchAdminState();
    const interval = setInterval(fetchAdminState, 15000); // refresh metrics every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAdminState = async () => {
    try {
      // Fetch Metrics Info
      const resMetrics = await apiFetch('/api/admin/metrics');
      if (resMetrics.ok) {
        const met = await resMetrics.json();
        setMetrics(met);
      }

      // Fetch Audit logs
      const resAud = await apiFetch('/api/admin/audits');
      if (resAud.ok) {
        const auds = await resAud.json();
        setAudits(auds);
      }
    } catch (e) {
      console.error('Error cargando métricas administrativas:', e);
    } finally {
      setLoading(false);
    }
  };

  const triggerResetDemo = async () => {
    setResetting(true);
    try {
      await apiFetch('/api/admin/reset-demo', { method: 'POST' });
      await fetchAdminState();
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" id="admin-telemetry-panel">
      
      {/* Upper header */}
      <div className="pb-2 border-b border-slate-200 flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#3B82F6]" /> Consola de Administración Sinergia Meet
          </h2>
          <p className="text-xs text-slate-500">Supervisa la salud de la infraestructura, transacciones bancarias, y eventos preventivos OWASP.</p>
        </div>

        <button 
          id="btn-manual-refresh-admin"
          onClick={fetchAdminState}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 text-slate-705 hover:text-slate-900 transition-all cursor-pointer"
          title="Refrescar métricas del VPS"
        >
          <RefreshCw className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Bento Grid Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-slate-800">
        
        {/* Metric Card: CPU & resources */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 relative overflow-hidden shadow-sm border-l-4 border-l-[#3B82F6]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Métricas VPS Ubuntu</span>
            <Cpu className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">{metrics.cpuUsage}</h4>
            <p className="text-[11px] text-slate-505 mt-1">Carga de procesador Hostinger</p>
          </div>
        </div>

        {/* Metric Card: RAM Memory */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Uso de Memoria</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-3">
            <h4 className="text-sm font-semibold text-slate-800 mt-1">{metrics.memoryUsage}</h4>
            <p className="text-[11px] text-slate-500 mt-2 font-mono bg-slate-50 p-1 rounded border border-slate-100">{metrics.dbPoolState}</p>
          </div>
        </div>

        {/* Metric Card: Financial revenue */}
        <div className="p-6 rounded-2xl bg-white border border-slate-205 relative overflow-hidden shadow-sm border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase">SaaS Facturación</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              ${metrics.totalRevenueInUSD ? metrics.totalRevenueInUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} USD
            </h4>
            <p className="text-[11px] text-slate-505 mt-1">Entradas acumuladas Sinergia Pay</p>
          </div>
        </div>

        {/* Metric Card: Anti-fraud blocked instances */}
        <div className="p-6 rounded-2xl bg-white border border-slate-205 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono text-rose-600 font-bold uppercase">Anti-Fraude</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-2xl font-bold font-mono text-rose-600">{metrics.blockedAttemptsCounter}</span>
              <span className="text-[8px] font-mono text-rose-700 bg-rose-50 py-0.5 px-2 rounded-full border border-rose-100 font-bold">BLOQUEADOS</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Anomalías controladas</p>
          </div>
        </div>
      </div>

      {/* Main Logs Area & Users */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Audit Log (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold font-mono text-slate-700 flex items-center gap-1.5 uppercase">
            <Activity className="w-4 h-4 text-[#3B82F6]" /> Registro de Seguridad y Auditoría (OWASP Audits)
          </h3>

          <div className="rounded-2xl bg-white overflow-hidden border border-slate-200 shadow-sm text-slate-800" id="audits-log-container">
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-mono text-slate-500">
              Servidor conectado a logs centrales. Monitoreando intentos delictivos y transferencias.
            </div>

            <div className="p-5 space-y-4 max-h-[50vh] overflow-y-auto">
              {audits.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Ningún registro en auditoría todavía.</p>
              ) : (
                audits.map((a) => (
                  <div key={a.id} id={`audit-card-${a.id}`} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono py-0.5 px-2 rounded font-bold ${
                          a.severity === 'CRITICAL' ? 'bg-red-500 text-white animate-pulse' :
                          a.severity === 'WARNING' ? 'bg-amber-500 text-slate-900' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {a.severity}
                        </span>
                        <strong className="text-xs font-mono text-slate-900">{a.action}</strong>
                      </div>
                      <span className="text-[9px] text-[#94A3B8] font-mono">{new Date(a.createdAt).toLocaleString()}</span>
                    </div>

                    <p className="text-[11px] text-slate-700 bg-white p-2.5 rounded border border-slate-200 leading-normal font-mono">
                      {a.details}
                    </p>

                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>IP de consulta: <strong className="text-slate-600">{a.ipAddress}</strong></span>
                      <span className="truncate max-w-xs">{a.userAgent}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* User Management mock action (1 col) */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold font-mono text-slate-700 flex items-center gap-1.5 uppercase">
            <ShieldAlert className="w-4 h-4 text-[#3B82F6]" /> Control del Ecosistema
          </h3>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm text-slate-800">
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-slate-900">Mitigaciones Activas</h5>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                El sistema bloquea automáticamente solicitudes con volumen sospechoso provenientes de una misma IP mediante Rate-Limiting.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <button
                id="btn-reset-demo-admin"
                disabled={resetting}
                onClick={triggerResetDemo}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-xl cursor-pointer transition-colors uppercase tracking-wider"
              >
                {resetting ? 'Por favor espere...' : 'Sanitizar Logs de Prueba'}
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
