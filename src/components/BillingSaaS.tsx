/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Check, Lock, CreditCard, Receipt, FileDown, 
  HelpCircle, Ticket, CheckCircle2, ShieldAlert 
} from 'lucide-react';
import { User, SaaSPlan, PaymentInvoice } from '../types';

interface BillingSaaSProps {
  user: User;
  onRefreshUserBalance?: () => void;
}

export default function BillingSaaS({ user, onRefreshUserBalance }: BillingSaaSProps) {
  const [plans, setPlans] = useState<SaaSPlan[]>([
    {
      code: 'FREE',
      name: 'Plan Gratuito',
      price: 0,
      features: [
        'Videollamadas de hasta 40 minutos',
        'Hasta 50 participantes en simultáneo',
        'Chat básico en tiempo real',
        'Sinergia Wallet integrado con $50 de bienvenida'
      ],
      maxDuration: 40,
      limitParticipants: 50
    },
    {
      code: 'PROFESSIONAL',
      name: 'Plan Profesional',
      price: 19.99,
      features: [
        'Reuniones ilimitadas las 24 horas',
        'Hasta 150 participantes con calidad HD',
        'Grabación local y sala de espera avanzada',
        'Enlace de videoconferencia personalizado',
        'Análisis heurístico en el Co-piloto de Voz'
      ],
      maxDuration: 1440,
      limitParticipants: 150
    },
    {
      code: 'ENTERPRISE',
      name: 'Plan Empresarial',
      price: 49.99,
      features: [
        'Hasta 500 participantes y múltiples presentadores',
        'Grabaciones automáticas en la nube (MinIO S3)',
        'Resúmenes de reuniones automáticos de Gemini IA',
        'Generación de tareas accionables con IA',
        'Consola técnica de administración y métricas avanzadas',
        'Soporte técnico preferencial 24/7'
      ],
      maxDuration: 2880,
      limitParticipants: 500
    }
  ]);

  const [activePlan, setActivePlan] = useState<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE'>('FREE');
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [discount, setDiscount] = useState(0);

  // checkout controls
  const [checkoutPlan, setCheckoutPlan] = useState<SaaSPlan | null>(null);
  const [checkoutGateway, setCheckoutGateway] = useState<'STRIPE' | 'PAYPAL' | 'MERCADOPAGO' | 'WOMPI' | 'WALLET'>('STRIPE');
  const [processing, setProcessing] = useState(false);
  
  // alerts / outputs
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [invoices, setInvoices] = useState<PaymentInvoice[]>([]);
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);

  useEffect(() => {
    fetchBillingState();
  }, [user]);

  const fetchBillingState = async () => {
    // We can fetch user subscription state from server
    try {
      const res = await fetch(`/api/wallet/balance/${user.id}`);
      if (res.ok) {
        // Also simulate loading history of invoices
        setInvoices([
          { id: 'inv-891', userId: user.id, amount: 49.99, gateway: 'STRIPE', status: 'PAID', planCode: 'ENTERPRISE', date: new Date(Date.now() - 86400000 * 30).toISOString() },
          { id: 'inv-341', userId: user.id, amount: 19.99, gateway: 'WALLET', status: 'PAID', planCode: 'PROFESSIONAL', date: new Date().toISOString() }
        ]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (coupon.trim().toUpperCase() === 'SINERGIA2026') {
      setCouponApplied(true);
      setDiscount(20); // 20% off
      setErrorMsg('');
    } else {
      setErrorMsg('Cupón inválido. Pruebe "SINERGIA2026" para un descuento especial.');
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPlan) return;

    setProcessing(true);
    setErrorMsg('');
    setSuccessMsg('');

    const rawPrice = checkoutPlan.price;
    const finalPrice = couponApplied ? parseFloat((rawPrice * (1 - discount / 100)).toFixed(2)) : rawPrice;

    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          planCode: checkoutPlan.code,
          billingPeriod,
          gateway: checkoutGateway
        })
      });

      if (res.ok) {
        setSuccessMsg(`¡Suscripción al ${checkoutPlan.name} activada correctamente con ${checkoutGateway}!`);
        setActivePlan(checkoutPlan.code as any);
        setCheckoutPlan(null);
        await fetchBillingState();
        if (onRefreshUserBalance) onRefreshUserBalance();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'No se pudo completar el cobro planificado.');
      }
    } catch (err) {
      setErrorMsg('Error de red al establecer conexión con el procesador bancario.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="billing-plans-view">
      
      {/* Title */}
      <div className="pb-2 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 uppercase tracking-wide">Planes de Suscripción Sinergia Meet</h2>
          <p className="text-xs text-slate-500">Escala tu negocio de forma transparente, con facturación local y corporativa.</p>
        </div>

        <button 
          id="btn-show-invoices"
          onClick={() => setShowInvoicesModal(true)}
          className="py-2 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-all text-xs font-mono flex items-center gap-1.5 cursor-pointer font-semibold uppercase tracking-wider"
        >
          <Receipt className="w-4 h-4 text-[#3B82F6]" />
          [Ver Historial Facturas]
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2" id="billing-success">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-850 text-sm flex items-center gap-2" id="billing-error">
          <ShieldAlert className="w-5 h-5 text-red-550" />
          {errorMsg}
        </div>
      )}

      {/* Plans Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {plans.map((p) => {
          const isActive = activePlan === p.code;
          return (
            <div 
              key={p.code} 
              id={`plan-card-${p.code}`}
              className={`p-7 rounded-2xl bg-white border border-slate-200 relative flex flex-col justify-between overflow-hidden transition-all duration-300 ${
                isActive 
                  ? 'border-l-4 border-l-[#3B82F6] border-[#3B82F6] shadow-sm' 
                  : 'hover:border-slate-350'
              }`}
            >
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-display font-bold text-slate-900">{p.name}</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">SaaS de Videollamadas</p>
                  </div>
                  {isActive && (
                    <span className="py-0.5 px-2.5 bg-[#3B82F6] text-white font-mono text-[9px] uppercase tracking-wider rounded font-bold">
                      Activo
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 select-none">
                  <span className="text-2xl font-bold text-slate-900">$</span>
                  <span className="text-4xl font-extrabold font-display tracking-tight text-slate-900">{p.price}</span>
                  <span className="text-xs text-slate-405 font-mono">/mes</span>
                </div>

                <ul className="space-y-3 pt-2 text-xs">
                  {p.features.map((feat, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-slate-700 leading-normal">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8">
                {p.code === 'FREE' ? (
                  <button 
                    disabled 
                    className="w-full py-3 rounded-xl bg-slate-50 text-slate-400 border border-slate-200 font-semibold text-xs text-center cursor-not-allowed uppercase tracking-wider"
                  >
                    Por Defecto en Registro
                  </button>
                ) : (
                  <button 
                    id={`btn-select-plan-${p.code}`}
                    onClick={() => { setCheckoutPlan(p); setSuccessMsg(''); setErrorMsg(''); }}
                    className={`w-full py-3 rounded-xl font-bold text-xs text-center transition-all cursor-pointer uppercase tracking-wider ${
                      isActive 
                        ? 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:text-slate-900' 
                        : 'bg-[#3B82F6] hover:bg-blue-700 text-white shadow-sm active:scale-95'
                    }`}
                  >
                    {isActive ? 'Renovar Plan' : 'Adquirir Licencia'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CHECKOUT MODAL WINDOW */}
      {checkoutPlan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="modal-container">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 relative shadow-2xl space-y-5">
            <h3 className="text-xl font-display font-semibold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#3B82F6]" /> Pasarela de Pago Segura
            </h3>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
              <div className="space-y-0.5">
                <span className="text-slate-500">Plan Seleccionado</span>
                <p className="font-bold text-slate-800">{checkoutPlan.name}</p>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Total a Pagar</span>
                <p className="text-sm font-bold font-mono text-emerald-600">
                  ${couponApplied ? (checkoutPlan.price * (1 - discount / 100)).toFixed(2) : checkoutPlan.price} USD
                </p>
              </div>
            </div>

            {/* Billing period select */}
            <div className="space-y-1 text-xs">
              <label className="text-xs font-semibold text-slate-600">Ciclo de facturación</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button 
                  type="button" 
                  onClick={() => setBillingPeriod('MONTHLY')}
                  className={`py-1.5 rounded-lg text-center font-mono text-[11px] font-bold ${billingPeriod === 'MONTHLY' ? 'bg-white text-[#3B82F6] shadow-sm' : 'text-slate-500'}`}
                >
                  Mensual
                </button>
                <button 
                  type="button" 
                  onClick={() => setBillingPeriod('ANNUAL')}
                  className={`py-1.5 rounded-lg text-center font-mono text-[11px] font-bold ${billingPeriod === 'ANNUAL' ? 'bg-white text-[#3B82F6] shadow-sm' : 'text-slate-500'}`}
                >
                  Anual (-10% Descuento)
                </button>
              </div>
            </div>

            {/* Coupons */}
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <input 
                id="billing-coupon-input"
                type="text" 
                placeholder="Introducir código de descuento..." 
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-800 outline-none focus:border-[#3B82F6]"
              />
              <button 
                id="btn-apply-coupon"
                type="submit" 
                className="py-2 px-3.5 bg-slate-100 rounded-lg text-xs font-mono text-slate-700 border border-slate-200 hover:text-slate-900 hover:bg-slate-200 cursor-pointer"
              >
                <Ticket className="w-3.5 h-3.5" />
              </button>
            </form>

            <form onSubmit={handleSubscribe} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 font-mono">Procesador del Cobro</label>
                <div className="grid grid-cols-3 gap-2">
                  {['STRIPE', 'PAYPAL', 'MERCADOPAGO', 'WOMPI', 'WALLET'].map((gate) => (
                    <button
                      key={gate}
                      id={`gateway-select-${gate.toLowerCase()}`}
                      type="button"
                      onClick={() => setCheckoutGateway(gate as any)}
                      className={`py-2 rounded-lg border text-center text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        checkoutGateway === gate 
                          ? 'border-[#3B82F6] bg-blue-50 text-[#3B82F6]' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {gate === 'WALLET' ? 'Wallet Sinergia' : gate}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  id="checkout-cancel"
                  type="button" 
                  onClick={() => setCheckoutPlan(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-all text-sm font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  id="checkout-submit"
                  type="submit" 
                  disabled={processing}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-700 text-white transition-all text-sm font-medium cursor-pointer shadow-md shadow-blue-500/10 disabled:bg-slate-350"
                >
                  {processing ? 'Liquidando...' : 'Pagar hoy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVOICES LIST MODAL */}
      {showInvoicesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="modal-container">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 relative shadow-2xl space-y-4">
            <h3 className="text-lg font-display font-semibold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#3B82F6]" /> Historial de Facturación y Comprobantes
            </h3>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {invoices.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">Ninguna factura en archivo todavía.</p>
              ) : (
                invoices.map((inv) => (
                  <div key={inv.id} id={`invoice-${inv.id}`} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-800">REC-{inv.id}</span>
                        <span className="text-[9px] font-mono py-0.5 px-1.5 rounded bg-blue-50 text-[#3B82F6] border border-blue-100 font-bold">{inv.planCode}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">Gateway: {inv.gateway} | {new Date(inv.date).toLocaleDateString()}</p>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <div>
                        <span className="text-xs font-bold text-emerald-600 font-mono">${inv.amount} USD</span>
                        <p className="text-[9px] text-emerald-700 uppercase tracking-widest font-mono font-bold">PAGADO</p>
                      </div>
                      
                      <button 
                        id={`btn-download-${inv.id}`}
                        onClick={() => alert(`Sinergia Factura Electrónica REC-${inv.id} descargada exitosamente en formato PDF.`)}
                        className="p-2 bg-white text-slate-500 hover:text-slate-800 rounded border border-slate-200 cursor-pointer"
                        title="Descargar Comprobante PDF de Factura"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button 
              id="billing-close-invoices"
              onClick={() => setShowInvoicesModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer mt-2"
            >
              Cerrar Registro
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
