/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Wallet, ArrowUpDown, ArrowUpRight, ArrowDownLeft, Plus, 
  Send, ShieldAlert, Lock, HelpCircle, CheckCircle2, History 
} from 'lucide-react';
import { User, Wallet as WalletType, WalletTransaction } from '../types';

interface WalletDashProps {
  user: User;
}

export default function WalletDash({ user }: WalletDashProps) {
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [depositAmount, setDepositAmount] = useState('');
  const [depositGateway, setDepositGateway] = useState<'STRIPE' | 'PAYPAL' | 'MERCADOPAGO' | 'WOMPI'>('STRIPE');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferEmail, setTransferEmail] = useState('');
  const [transferDesc, setTransferDesc] = useState('');

  // Status indicators
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [modalType, setModalType] = useState<'DEPOSIT' | 'TRANSFER' | null>(null);
  const [operationProcessing, setOperationProcessing] = useState(false);

  useEffect(() => {
    fetchWalletState();
  }, [user]);

  const fetchWalletState = async () => {
    try {
      const res = await fetch(`/api/wallet/balance/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setWallet(data.wallet);
        setTransactions(data.transactions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;

    setOperationProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: depositAmount,
          gateway: depositGateway,
          description: `Recarga aprobada usando pasarela ${depositGateway}`
        })
      });

      if (res.ok) {
        setDepositAmount('');
        setModalType(null);
         fetchWalletState();
        setSuccessMessage(`¡Felicidades! Se recargaron exitosamente tus fondos mediante pasarela ${depositGateway}.`);
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Error al efectuar el depósito.');
      }
    } catch (err) {
      setErrorMessage('Error de red al sincronizar con el gateway de pagos.');
    } finally {
      setOperationProcessing(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAmount || !transferEmail) return;

    setOperationProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUserId: user.id,
          targetEmail: transferEmail,
          amount: transferAmount,
          description: transferDesc || undefined
        })
      });

      if (res.ok) {
        setTransferAmount('');
        setTransferEmail('');
        setTransferDesc('');
        setModalType(null);
         fetchWalletState();
        setSuccessMessage('¡Transferencia inmediata efectuada con éxito!');
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Error al efectuar la transferencia.');
      }
    } catch (err) {
      setErrorMessage('Error de red al conectarse al nodo bancario central de Sinergia Pay.');
    } finally {
      setOperationProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" id="wallet-dashboard">
      
      {/* Sinergia Wallet Header card banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Principal Wallet card */}
        <div className="lg:col-span-2 p-8 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between relative overflow-hidden h-60 shadow-sm border-l-4 border-l-[#3B82F6]">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex justify-between items-start z-10">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                S I N E R G I A &nbsp; W A L L E T
              </span>
              <h2 className="text-sm font-semibold text-slate-700">Monedero Electrónico Corporativo</h2>
            </div>
            <span className={`text-[10px] font-mono py-0.5 px-2.5 rounded-full uppercase tracking-wider font-semibold border ${
              wallet?.status === 'ACTIVE' 
                ? 'border-emerald-500/30 text-emerald-600 bg-emerald-50' 
                : 'border-rose-500/30 text-rose-600 bg-rose-50'
            }`}>
              {wallet?.status === 'ACTIVE' ? 'SEGURIDAD ACTIVA' : 'CONGELADO'}
            </span>
          </div>

          <div className="z-10 py-1">
            <span className="text-slate-400 text-xs font-mono">Saldo Disponible</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-3xl font-display font-medium text-[#0F172A]">$</span>
              <span className="text-4xl font-display font-bold text-slate-900 tracking-tight">
                {wallet ? wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </span>
              <span className="text-xs font-mono text-slate-500 ml-1">{wallet?.currency || 'USD'}</span>
            </div>
          </div>

          <div className="flex gap-4 z-10 w-full">
            <button 
              id="btn-trigger-recharge"
              onClick={() => { setModalType('DEPOSIT'); setErrorMessage(''); setSuccessMessage(''); }}
              className="flex-1 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-705 transition-all font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <Plus className="w-4 h-4 text-[#3B82F6]" />
              Recargar Saldo
            </button>
            <button 
              id="btn-trigger-transfer"
              onClick={() => { setModalType('TRANSFER'); setErrorMessage(''); setSuccessMessage(''); }}
              className="flex-1 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-blue-700 text-white transition-all font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 uppercase tracking-wider font-bold"
            >
              <Send className="w-3.5 h-3.5 text-white" />
              Transferir Fondos
            </button>
          </div>
        </div>

        {/* Security / Anti-fraud and system rules widget */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm">
          <h4 className="text-xs font-bold font-mono text-slate-700 flex items-center gap-1.5 uppercase">
            <Lock className="w-4 h-4 text-blue-500" /> POLÍTICAS ANTIFRAUDE Y LÍMITES
          </h4>
          <div className="text-xs text-slate-500 space-y-3 leading-relaxed">
            <p>Sinergia Wallet opera con límites estrictos de transferencias para salvaguardar tu saldo:</p>
            <ul className="space-y-2 font-mono text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <li className="flex items-start gap-1">
                <span className="text-amber-500 font-bold">•</span>
                <span>Transferencias &gt; $500 USD: Enrutadas para auditoría biométrica.</span>
              </li>
              <li className="flex items-start gap-1">
                <span className="text-red-500 font-bold">•</span>
                <span>Transferencias &gt; $1,500 USD: Bloqueadas preventivamente.</span>
              </li>
            </ul>
            <p className="text-[10px] text-slate-400">
              * El ecosistema de Sinergia Pay, Sinergia Wallet, Sinergia Meet y Sinergia Workspace cumple con la normativa de seguridad de datos.
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2" id="wallet-success-alert">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2" id="wallet-error-alert">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-600" />
          {errorMessage}
        </div>
      )}

      {/* Sinergia Ledger History Block */}
      <div className="space-y-4">
        <h3 className="text-lg font-display font-bold flex items-center gap-2 text-slate-900 uppercase tracking-wide">
          <History className="w-5 h-5 text-[#3B82F6]" /> Historial de Transacciones Sinergia Wallet
        </h3>
        
        <div className="rounded-2xl bg-white border border-slate-205 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table id="transactions-table" className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-mono text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Operación ID</th>
                  <th className="py-3.5 px-5">Tipo</th>
                  <th className="py-3.5 px-5">Monto</th>
                  <th className="py-3.5 px-5">Descripción</th>
                  <th className="py-3.5 px-5">Estado</th>
                  <th className="py-3.5 px-5 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No se han realizado operaciones financieras en esta billetera todavía.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} id={`tx-row-${tx.id}`} className="hover:bg-slate-50/50 transition-colors duration-150">
                      <td className="py-3.5 px-5 font-mono text-slate-400">{tx.id}</td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full uppercase tracking-wider text-[9px] font-bold ${
                          tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' || tx.type === 'REFUND'
                            ? 'text-emerald-700 bg-emerald-50'
                            : 'text-amber-700 bg-amber-50'
                        }`}>
                          {tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN' || tx.type === 'REFUND' 
                            ? <ArrowDownLeft className="w-3 h-3 text-emerald-600 font-bold" /> 
                            : <ArrowUpRight className="w-3 h-3 text-amber-600 font-bold" />}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-900">
                        ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </td>
                      <td className="py-3.5 px-5 text-slate-500">{tx.description}</td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex py-0.5 px-2 rounded font-mono text-[9px] font-bold ${
                          tx.status === 'COMPLETED' ? 'text-emerald-700 bg-emerald-50' :
                          tx.status === 'PENDING' ? 'text-yellow-750 bg-yellow-50' :
                          'text-red-700 bg-red-50'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right text-slate-405 font-mono">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL WINDOW FOR RECHARGE & TRANSACTIONS */}
      {modalType === 'DEPOSIT' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="modal-container">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 relative shadow-2xl space-y-5">
            <h3 className="text-xl font-display font-semibold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#3B82F6]" /> Recargar monedero electrónico
            </h3>

            <form onSubmit={handleDeposit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Monto del depósito (USD)</label>
                <input 
                  id="recharge-amount-input"
                  type="number" 
                  required
                  min="5"
                  step="1"
                  placeholder="Mínimo de recarga: $5.00 USD"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Canal / Pasarela de Pagos Segura</label>
                <div className="grid grid-cols-2 gap-2">
                  {['STRIPE', 'PAYPAL', 'MERCADOPAGO', 'WOMPI'].map((gate) => (
                    <button
                      key={gate}
                      id={`btn-gateway-opt-${gate.toLowerCase()}`}
                      type="button"
                      onClick={() => setDepositGateway(gate as any)}
                      className={`py-2.5 px-3.5 rounded-lg border text-left text-xs font-mono font-bold transition-all cursor-pointer ${
                        depositGateway === gate 
                          ? 'border-[#3B82F6] bg-blue-50 text-[#3B82F6]' 
                          : 'border-slate-250 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {gate}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  id="close-recharge-modal"
                  type="button" 
                  onClick={() => setModalType(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all text-sm font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  id="submit-recharge"
                  type="submit" 
                  disabled={operationProcessing}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-700 text-white transition-all text-sm font-medium cursor-pointer shadow-md shadow-blue-500/10 disabled:bg-slate-350"
                >
                  {operationProcessing ? 'Procesando...' : 'Recargar saldo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType === 'TRANSFER' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="modal-container">
          <div className="w-full max-w-md bg-white border border-slate-202 rounded-2xl p-6 relative shadow-2xl space-y-5">
            <h3 className="text-xl font-display font-semibold text-slate-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-[#3B82F6]" /> Transferencia de Fondos Interna
            </h3>

            <p className="text-[11px] text-slate-500">Envía dinero de forma inmediata de billetera a billetera de Sinergia Meet.</p>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Email del destinatario</label>
                <input 
                  id="transfer-email-input"
                  type="email" 
                  required
                  placeholder="Ej: ana.milena@creative.com"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Monto a transferir (USD)</label>
                <input 
                  id="transfer-amount-input"
                  type="number" 
                  required
                  placeholder="Monto en USD"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Descripción / Concepto (Opcional)</label>
                <input 
                  id="transfer-desc-input"
                  type="text" 
                  placeholder="Ej: Pago de horas extras de diseño corporativo"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  id="close-transfer-modal"
                  type="button" 
                  onClick={() => setModalType(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all text-sm font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  id="submit-transfer"
                  type="submit" 
                  disabled={operationProcessing}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-700 text-white transition-all text-sm font-medium cursor-pointer shadow-md shadow-blue-500/10 disabled:bg-slate-350"
                >
                  {operationProcessing ? 'Procesando...' : 'Transferir fondos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
