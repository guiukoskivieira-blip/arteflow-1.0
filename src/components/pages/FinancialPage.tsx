import React, { useMemo, useState } from 'react';
import { DollarSign, Search, X } from 'lucide-react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { formatCentsToBRL, parseBRLInputToCents } from '../../domain/money';
import { deriveReceivableStatus } from '../../services/financialService';
import { PaymentMethod, ReceivableAccount, ReceivableStatus } from '../../types/financial';

const labels: Record<ReceivableStatus, string> = { PENDING: 'Pendente', PARTIAL: 'Parcial', PAID: 'Pago', OVERDUE: 'Vencido', CANCELLED: 'Cancelado' };

export const FinancialPage: React.FC = () => {
  const { receivables, financialIndicators, registerReceivablePayment, can = () => true } = useArteFlow();
  const canManage = can('arteflow.finance.manage');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | ReceivableStatus>('ALL');
  const [selected, setSelected] = useState<ReceivableAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>('PIX');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const rows = useMemo(() => receivables.map((account) => ({ ...account, status: deriveReceivableStatus(account) })).filter((account) => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return (!query || `${account.customerName} ${account.orderNumber}`.toLocaleLowerCase('pt-BR').includes(query)) && (status === 'ALL' || account.status === status);
  }), [receivables, search, status]);
  const openPayment = (account: ReceivableAccount) => { if (canManage && deriveReceivableStatus(account) !== 'PAID') { setSelected(account); setAmount(''); setNotes(''); setError(''); } };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!canManage || !selected || submitting) return;
    const amountCents = parseBRLInputToCents(amount); const balance = selected.totalCents - selected.receivedCents;
    if (amountCents <= 0) return setError('Informe um valor positivo válido.');
    if (amountCents > balance) return setError('O pagamento não pode superar o saldo em aberto.');
    setSubmitting(true); setError('');
    try {
      await registerReceivablePayment({ receivableId: selected.id, amountCents, paidAt, method, notes, idempotencyKey: `${selected.id}:${Date.now()}:${amountCents}` });
      setSelected(null);
    } catch (cause: any) { setError(cause.message || 'Não foi possível registrar o pagamento.'); }
    finally { setSubmitting(false); }
  };
  const indicators: Array<[string, number]> = [['Total a receber', financialIndicators.totalReceivableCents], ['Total recebido', financialIndicators.totalReceivedCents], ['Total vencido', financialIndicators.totalOverdueCents], ['Saldo em aberto', financialIndicators.openBalanceCents]];
  return <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6" data-testid="financial-page">
    <div className="flex items-center gap-3 mb-5"><div className="p-2.5 rounded-xl bg-emerald-600 text-white"><DollarSign className="w-5 h-5" /></div><div><h2 className="text-xl font-bold text-slate-900">Financeiro Operacional</h2><p className="text-xs text-slate-500">Contas a receber e liberação financeira da produção</p></div></div>
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-5">{indicators.map(([label, value]) => <div key={label} className="bg-white border border-slate-200 rounded-xl p-4"><p className="text-xs text-slate-500">{label}</p><p className="font-bold text-slate-900 mt-1">{formatCentsToBRL(value)}</p></div>)}<div className="bg-white border border-slate-200 rounded-xl p-4"><p className="text-xs text-slate-500">Contas pendentes</p><p className="font-bold text-slate-900 mt-1">{financialIndicators.pendingCount}</p></div></div>
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden"><div className="p-4 flex flex-col sm:flex-row gap-3 border-b"><label className="flex-1 flex items-center gap-2 border rounded-lg px-3"><Search className="w-4 h-4 text-slate-400"/><input aria-label="Buscar contas" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente ou pedido" className="w-full py-2 text-sm outline-none"/></label><select aria-label="Filtrar status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="border rounded-lg px-3 py-2 text-sm"><option value="ALL">Todos os status</option>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Cliente / Pedido</th><th className="p-3">Total</th><th className="p-3">Recebido</th><th className="p-3">Saldo</th><th className="p-3">Vencimento</th><th className="p-3">Status</th>{canManage && <th className="p-3">Ação</th>}</tr></thead><tbody className="divide-y">{rows.map((account) => { const balance=account.totalCents-account.receivedCents; return <tr key={account.id}><td className="p-3"><strong>{account.customerName}</strong><div className="text-xs text-slate-500">{account.orderNumber}</div></td><td className="p-3">{formatCentsToBRL(account.totalCents)}</td><td className="p-3 text-emerald-700">{formatCentsToBRL(account.receivedCents)}</td><td className="p-3 font-semibold">{formatCentsToBRL(balance)}</td><td className="p-3">{new Date(`${account.dueDateISO}T12:00:00`).toLocaleDateString('pt-BR')}</td><td className="p-3"><span className="px-2 py-1 rounded-full bg-slate-100 text-xs font-semibold">{labels[account.status]}</span></td>{canManage && <td className="p-3"><button disabled={account.status==='PAID'||account.status==='CANCELLED'} onClick={() => openPayment(account)} className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs disabled:bg-slate-300">Registrar pagamento</button></td>}</tr>;})}{rows.length===0&&<tr><td colSpan={canManage ? 7 : 6} className="p-8 text-center text-slate-500">Nenhuma conta encontrada.</td></tr>}</tbody></table></div></div>
    {canManage && selected && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"><form onSubmit={submit} className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4" aria-label="Registrar pagamento"><div className="flex justify-between"><div><h3 className="font-bold">Registrar pagamento</h3><p className="text-xs text-slate-500">Saldo: {formatCentsToBRL(selected.totalCents-selected.receivedCents)}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Fechar"><X/></button></div><label className="block text-xs font-semibold">Valor<input autoFocus value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0,00" className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label><label className="block text-xs font-semibold">Data<input type="date" value={paidAt} onChange={(e)=>setPaidAt(e.target.value)} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label><label className="block text-xs font-semibold">Forma<select value={method} onChange={(e)=>setMethod(e.target.value as PaymentMethod)} className="mt-1 w-full border rounded-lg p-2.5 text-sm"><option value="PIX">Pix</option><option value="TRANSFER">Transferência</option><option value="CASH">Dinheiro</option><option value="CARD">Cartão</option><option value="OTHER">Outro</option></select></label><label className="block text-xs font-semibold">Observação<textarea value={notes} onChange={(e)=>setNotes(e.target.value)} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<button disabled={submitting} className="w-full py-2.5 rounded-lg bg-sky-600 text-white font-semibold disabled:opacity-50">{submitting?'Registrando...':'Confirmar pagamento'}</button></form></div>}
  </div>;
};
