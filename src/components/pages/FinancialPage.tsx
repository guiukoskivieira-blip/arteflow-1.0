import React, { useMemo, useState } from 'react';
import { DollarSign, History, Search, X } from 'lucide-react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { formatCentsToBRL, parseBRLInputToCents } from '../../domain/money';
import { deriveReceivableStatus } from '../../services/financialService';
import type { FinancialPayable, FinancialSettlement, PaymentMethod, ReceivableAccount, ReceivableStatus } from '../../types/financial';

const labels: Record<ReceivableStatus, string> = { PENDING: 'Pendente', PARTIAL: 'Parcial', PAID: 'Pago', OVERDUE: 'Vencido', CANCELLED: 'Cancelado' };
type SelectedTitle = { kind: 'RECEIVABLE'; value: ReceivableAccount } | { kind: 'PAYABLE'; value: FinancialPayable };
const payableStatus = (item: FinancialPayable): ReceivableStatus => item.status === 'CANCELLED' || item.status === 'PAID' || item.status === 'PARTIAL' ? item.status : new Date(`${item.dueDateISO}T23:59:59`).getTime() < Date.now() ? 'OVERDUE' : 'PENDING';

export const FinancialPage: React.FC = () => {
  const context = useArteFlow();
  const { receivables, financialIndicators, registerReceivablePayment, can = () => true } = context;
  const payables = context.payables ?? [];
  const connectedSettlements = context.financialSettlements ?? [];
  const legacySettlements: FinancialSettlement[] = (context.receivablePayments ?? []).map(item => ({ ...item, settledAt: item.paidAt, titleType: 'RECEIVABLE', payableId: null }));
  const settlements = connectedSettlements.length ? connectedSettlements : legacySettlements;
  const canManage = can('arteflow.finance.manage');
  const [tab, setTab] = useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | ReceivableStatus>('ALL');
  const [selected, setSelected] = useState<SelectedTitle | null>(null);
  const [historyTitle, setHistoryTitle] = useState<SelectedTitle | null>(null);
  const [amount, setAmount] = useState('');
  const [settledAt, setSettledAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>('PIX');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const receivableRows = useMemo(() => receivables.map(item => ({ ...item, status: deriveReceivableStatus(item) })).filter(item => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return (!query || `${item.customerName} ${item.orderNumber}`.toLocaleLowerCase('pt-BR').includes(query)) && (status === 'ALL' || item.status === status);
  }), [receivables, search, status]);
  const payableRows = useMemo(() => payables.map(item => ({ ...item, status: payableStatus(item) })).filter(item => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return (!query || `${item.supplierName} ${item.purchaseOrderNumber ?? ''} ${item.description}`.toLocaleLowerCase('pt-BR').includes(query)) && (status === 'ALL' || item.status === status);
  }), [payables, search, status]);
  const titleSettlements = historyTitle ? settlements.filter(item => historyTitle.kind === 'RECEIVABLE' ? item.receivableId === historyTitle.value.id : item.payableId === historyTitle.value.id) : [];
  const openPayment = (title: SelectedTitle) => { if (canManage && title.value.status !== 'PAID' && title.value.status !== 'CANCELLED') { setSelected(title); setAmount(''); setNotes(''); setError(''); } };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!canManage || !selected || submitting) return;
    const amountCents = parseBRLInputToCents(amount);
    const paid = selected.kind === 'RECEIVABLE' ? selected.value.receivedCents : selected.value.paidCents;
    const balance = selected.value.totalCents - paid;
    if (amountCents <= 0) return setError('Informe um valor positivo válido.');
    if (amountCents > balance) return setError('O pagamento não pode superar o saldo em aberto.');
    setSubmitting(true); setError('');
    try {
      const idempotencyKey = `${selected.value.id}:${Date.now()}:${amountCents}`;
      if (selected.kind === 'RECEIVABLE') await registerReceivablePayment({ receivableId: selected.value.id, amountCents, paidAt: settledAt, method, notes, idempotencyKey });
      else await context.registerPayableSettlement({ payableId: selected.value.id, amountCents, settledAt, method, notes, idempotencyKey });
      setSelected(null);
    } catch (cause: any) { setError(cause.message || 'Não foi possível registrar o pagamento.'); }
    finally { setSubmitting(false); }
  };
  const indicators: Array<[string, number]> = [['Total a receber', financialIndicators.totalReceivableCents], ['Total recebido', financialIndicators.totalReceivedCents], ['Total vencido', financialIndicators.totalOverdueCents], ['Saldo em aberto', financialIndicators.openBalanceCents]];
  const totalPayable = payables.filter(x => x.status !== 'CANCELLED').reduce((sum, x) => sum + x.totalCents - x.paidCents, 0);
  return <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6" data-testid="financial-page">
    <div className="flex items-center gap-3 mb-5"><div className="p-2.5 rounded-xl bg-emerald-600 text-white"><DollarSign className="w-5 h-5" /></div><div><h2 className="text-xl font-bold text-slate-900">Financeiro Operacional</h2><p className="text-xs text-slate-500">Obrigações, liquidações e liberação financeira da produção</p></div></div>
    <div className="grid grid-cols-2 xl:grid-cols-6 gap-3 mb-5">{indicators.map(([label, value]) => <div key={label} className="bg-white border border-slate-200 rounded-xl p-4"><p className="text-xs text-slate-500">{label}</p><p className="font-bold text-slate-900 mt-1">{formatCentsToBRL(value)}</p></div>)}<div className="bg-white border border-slate-200 rounded-xl p-4"><p className="text-xs text-slate-500">Contas pendentes</p><p className="font-bold text-slate-900 mt-1">{financialIndicators.pendingCount}</p></div><div className="bg-white border border-slate-200 rounded-xl p-4"><p className="text-xs text-slate-500">Total a pagar</p><p className="font-bold text-slate-900 mt-1">{formatCentsToBRL(totalPayable)}</p></div></div>
    <div className="flex gap-2 mb-3" role="tablist"><button role="tab" aria-selected={tab==='RECEIVABLE'} onClick={()=>setTab('RECEIVABLE')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab==='RECEIVABLE'?'bg-sky-600 text-white':'bg-white border'}`}>Contas a receber</button><button role="tab" aria-selected={tab==='PAYABLE'} onClick={()=>setTab('PAYABLE')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab==='PAYABLE'?'bg-sky-600 text-white':'bg-white border'}`}>Contas a pagar</button></div>
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden"><div className="p-4 flex flex-col sm:flex-row gap-3 border-b"><label className="flex-1 flex items-center gap-2 border rounded-lg px-3"><Search className="w-4 h-4 text-slate-400"/><input aria-label="Buscar contas" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={tab==='RECEIVABLE'?'Cliente ou pedido':'Fornecedor ou compra'} className="w-full py-2 text-sm outline-none"/></label><select aria-label="Filtrar status" value={status} onChange={(e)=>setStatus(e.target.value as typeof status)} className="border rounded-lg px-3 py-2 text-sm"><option value="ALL">Todos os status</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">{tab==='RECEIVABLE'?'Cliente / Pedido':'Fornecedor / Compra'}</th><th className="p-3">Total</th><th className="p-3">Pago</th><th className="p-3">Saldo</th><th className="p-3">Vencimento</th><th className="p-3">Status</th><th className="p-3">Histórico</th>{canManage&&<th className="p-3">Ação</th>}</tr></thead><tbody className="divide-y">
        {tab==='RECEIVABLE' ? receivableRows.map(item=><TitleRow key={item.id} primary={item.customerName} reference={item.orderNumber} total={item.totalCents} paid={item.receivedCents} due={item.dueDateISO} status={item.status} canManage={canManage} onHistory={()=>setHistoryTitle({kind:'RECEIVABLE',value:item})} onPay={()=>openPayment({kind:'RECEIVABLE',value:item})}/>) : payableRows.map(item=><TitleRow key={item.id} primary={item.supplierName} reference={item.purchaseOrderNumber??item.description} total={item.totalCents} paid={item.paidCents} due={item.dueDateISO} status={item.status} canManage={canManage} onHistory={()=>setHistoryTitle({kind:'PAYABLE',value:item})} onPay={()=>openPayment({kind:'PAYABLE',value:item})}/>)}
        {((tab==='RECEIVABLE'&&receivableRows.length===0)||(tab==='PAYABLE'&&payableRows.length===0))&&<tr><td colSpan={canManage?8:7} className="p-8 text-center text-slate-500">Nenhuma conta encontrada.</td></tr>}
      </tbody></table></div></div>
    {historyTitle&&<HistoryModal title={historyTitle} settlements={titleSettlements} close={()=>setHistoryTitle(null)}/>}
    {canManage&&selected&&<div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"><form onSubmit={submit} className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4" aria-label="Registrar pagamento"><div className="flex justify-between"><div><h3 className="font-bold">Registrar pagamento</h3><p className="text-xs text-slate-500">Saldo: {formatCentsToBRL(selected.value.totalCents-(selected.kind==='RECEIVABLE'?selected.value.receivedCents:selected.value.paidCents))}</p></div><button type="button" onClick={()=>setSelected(null)} aria-label="Fechar"><X/></button></div><label className="block text-xs font-semibold">Valor<input autoFocus value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0,00" className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label><label className="block text-xs font-semibold">Data<input type="date" value={settledAt} onChange={(e)=>setSettledAt(e.target.value)} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label><label className="block text-xs font-semibold">Forma<select value={method} onChange={(e)=>setMethod(e.target.value as PaymentMethod)} className="mt-1 w-full border rounded-lg p-2.5 text-sm"><option value="PIX">Pix</option><option value="TRANSFER">Transferência</option><option value="CASH">Dinheiro</option><option value="CARD">Cartão</option><option value="OTHER">Outro</option></select></label><label className="block text-xs font-semibold">Observação<textarea value={notes} onChange={(e)=>setNotes(e.target.value)} className="mt-1 w-full border rounded-lg p-2.5 text-sm"/></label>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<button disabled={submitting} className="w-full py-2.5 rounded-lg bg-sky-600 text-white font-semibold disabled:opacity-50">{submitting?'Registrando...':'Confirmar pagamento'}</button></form></div>}
  </div>;
};

const TitleRow:React.FC<{primary:string;reference:string;total:number;paid:number;due:string;status:ReceivableStatus;canManage:boolean;onHistory:()=>void;onPay:()=>void}>=({primary,reference,total,paid,due,status,canManage,onHistory,onPay})=><tr><td className="p-3"><strong>{primary}</strong><div className="text-xs text-slate-500">{reference}</div></td><td className="p-3">{formatCentsToBRL(total)}</td><td className="p-3 text-emerald-700">{formatCentsToBRL(paid)}</td><td className="p-3 font-semibold">{formatCentsToBRL(total-paid)}</td><td className="p-3">{new Date(`${due}T12:00:00`).toLocaleDateString('pt-BR')}</td><td className="p-3"><span className="px-2 py-1 rounded-full bg-slate-100 text-xs font-semibold">{labels[status]}</span></td><td className="p-3"><button onClick={onHistory} className="inline-flex items-center gap-1 text-xs text-sky-700"><History className="w-4 h-4"/>Ver histórico</button></td>{canManage&&<td className="p-3"><button disabled={status==='PAID'||status==='CANCELLED'} onClick={onPay} className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs disabled:bg-slate-300">Registrar pagamento</button></td>}</tr>;

const HistoryModal:React.FC<{title:SelectedTitle;settlements:FinancialSettlement[];close:()=>void}>=({title,settlements,close})=><div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"><section className="bg-white rounded-2xl p-5 w-full max-w-lg" aria-label="Histórico de baixas"><div className="flex justify-between mb-4"><div><h3 className="font-bold">Histórico de baixas</h3><p className="text-xs text-slate-500">{title.kind==='RECEIVABLE'?title.value.orderNumber:title.value.purchaseOrderNumber??title.value.description}</p></div><button onClick={close} aria-label="Fechar histórico"><X/></button></div><div className="space-y-2">{settlements.map(item=><div key={item.id} className="border rounded-xl p-3"><div className="flex justify-between"><strong>{formatCentsToBRL(item.amountCents)}</strong><span className="text-xs text-slate-500">{new Date(item.settledAt).toLocaleDateString('pt-BR')}</span></div><p className="text-xs text-slate-600 mt-1">{item.method} · {item.createdByName}</p>{item.notes&&<p className="text-xs text-slate-500 mt-1">{item.notes}</p>}</div>)}{settlements.length===0&&<p className="text-sm text-slate-500 py-4 text-center">Nenhuma baixa registrada.</p>}</div></section></div>;
