import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { getArteFlowRuntimeConfig } from '../../config/runtime';
import { CreateManualOrderItemInput } from '../../services/orderService';
import { Priority, OrderOrigin } from '../../types/domain';
import { SECTORS } from '../../domain/constants';
import { parseBRLInputToCents, formatCentsToBRL } from '../../domain/money';
import type { OrcagrafQuote, OrcagrafEntitlementStatus } from '../../types/orcagraf';
import {
  X,
  Plus,
  Trash2,
  ShoppingCart,
  Building2,
  Package,
  Sparkles,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Search,
} from 'lucide-react';

interface ItemFormState {
  productName: string;
  category: string;
  sector: string;
  width: string;
  height: string;
  unit: 'mm' | 'cm' | 'm';
  quantity: string;
  quantityUnit: string;
  unitPriceStr: string;
  finishingsInput: string;
  technicalNotes: string;
  priority: Priority;
  initialStageId?: string;
}

const emptyItem: ItemFormState = {
  productName: '',
  category: '',
  sector: 'Impressão Digital',
  width: '',
  height: '',
  unit: 'cm',
  quantity: '1',
  quantityUnit: 'un',
  unitPriceStr: '0,00',
  finishingsInput: '',
  technicalNotes: '',
  priority: 'MEDIUM',
  initialStageId: '',
};

export const NewOrderModal: React.FC = () => {
  const {
    isNewOrderModalOpen,
    setIsNewOrderModalOpen,
    createManualOrder,
    checkOrcagrafEntitlement,
    listImportableOrcagrafQuotes,
    stages,
  } = useArteFlow();
  const config = useMemo(() => getArteFlowRuntimeConfig(), []);

  // Filter active stages for the organization
  const activeStages = useMemo(() => {
    return [...(stages || [])]
      .filter((s: any) => s.isActive !== false)
      .sort((a, b) => a.sequence - b.sequence);
  }, [stages]);

  // Determine default initial stage: isInitial=true (lowest sequence) or lowest sequence active stage
  const defaultStageId = useMemo(() => {
    if (activeStages.length === 0) return '';
    const initialStages = activeStages.filter((s) => s.isInitial);
    if (initialStages.length > 0) {
      return initialStages[0].id;
    }
    return activeStages[0].id;
  }, [activeStages]);

  // Creation mode: 'manual' vs 'orcagraf'
  const [creationMode, setCreationMode] = useState<'manual' | 'orcagraf'>('manual');

  // OrçaGraf Entitlement and Quote List State
  const [entitlementStatus, setEntitlementStatus] = useState<OrcagrafEntitlementStatus | null>(null);
  const [isLoadingEntitlement, setIsLoadingEntitlement] = useState(false);
  const [quotes, setQuotes] = useState<OrcagrafQuote[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [quotesLoadError, setQuotesLoadError] = useState<string | null>(null);
  const [quoteSearchQuery, setQuoteSearchQuery] = useState('');
  const [importedQuoteReference, setImportedQuoteReference] = useState<string | null>(null);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [sellerCommissionPct, setSellerCommissionPct] = useState<number | undefined>(undefined);

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [customerDoc, setCustomerDoc] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [orderOrigin, setOrderOrigin] = useState<OrderOrigin>('MANUAL');
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().substring(0, 10);
  });
  const [orderNotes, setOrderNotes] = useState('');
  const [items, setItems] = useState<ItemFormState[]>([{ ...emptyItem, initialStageId: defaultStageId }]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isNewOrderModalOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement | null;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isNewOrderModalOpen]);

  // Load entitlement check and quotes when switching to orcagraf tab
  useEffect(() => {
    if (isNewOrderModalOpen && creationMode === 'orcagraf') {
      let active = true;
      setIsLoadingEntitlement(true);
      setQuotesLoadError(null);

      checkOrcagrafEntitlement()
        .then((status) => {
          if (!active) return;
          setEntitlementStatus(status);
          setIsLoadingEntitlement(false);

          if (status.canImport) {
            setIsLoadingQuotes(true);
            setQuotesLoadError(null);
            listImportableOrcagrafQuotes()
              .then((loadedQuotes) => {
                if (!active) return;
                setQuotes(loadedQuotes);
              })
              .catch((err) => {
                if (!active) return;
                setQuotes([]);
                setQuotesLoadError(err.message || 'Erro ao carregar orçamentos.');
              })
              .finally(() => {
                if (active) setIsLoadingQuotes(false);
              });
          }
        })
        .catch(() => {
          if (!active) return;
          setEntitlementStatus({
            isEntitled: false,
            hasUserAccess: false,
            canImport: false,
            reason: 'Falha ao validar plano e permissões.',
          });
          setIsLoadingEntitlement(false);
        });

      return () => {
        active = false;
      };
    }
  }, [isNewOrderModalOpen, creationMode, checkOrcagrafEntitlement, listImportableOrcagrafQuotes]);

  const handleClose = () => {
    setIsNewOrderModalOpen(false);
    setCreationMode('manual');
    setImportedQuoteReference(null);
    setSellerName(null);
    setSellerCommissionPct(undefined);
    setErrorMsg('');
    setQuotesLoadError(null);
    // Retorno acessível de foco ao elemento acionador
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  };

  const filteredQuotes = useMemo(() => {
    if (!quoteSearchQuery.trim()) return quotes;
    const q = quoteSearchQuery.toLowerCase().trim();
    return quotes.filter(
      (item) =>
        item.quoteNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        (item.customerDocument && item.customerDocument.includes(q))
    );
  }, [quotes, quoteSearchQuery]);

  if (!isNewOrderModalOpen) return null;

  const handleSelectQuote = (quote: OrcagrafQuote) => {
    setImportedQuoteReference(quote.id);
    setOrderOrigin('ORCAGRAF');
    setCustomerName(quote.customerName || '');
    setCustomerDoc(quote.customerDocument || '');
    setCustomerEmail(quote.customerEmail || '');
    setCustomerPhone(quote.customerPhone || '');
    setContactPerson(quote.customerContactPerson || '');
    setSellerName(quote.sellerName || null);
    setSellerCommissionPct(quote.sellerCommissionPct);

    if (quote.deliveryDate) {
      setDeliveryDate(quote.deliveryDate.substring(0, 10));
    }

    const initialNote = `Importado do OrçaGraf — Orçamento ${quote.quoteNumber}${quote.notes ? `\nObs: ${quote.notes}` : ''}`;
    setOrderNotes(initialNote);

    if (quote.items && quote.items.length > 0) {
      const mappedItems: ItemFormState[] = quote.items.map((it) => {
        const unitPriceStr = (it.unitPriceCents / 100).toFixed(2).replace('.', ',');
        return {
          productName: it.productName || 'Item Orçado',
          category: it.category || '',
          sector: it.sector || 'Impressão Digital',
          width: it.width ? String(it.width) : '',
          height: it.height ? String(it.height) : '',
          unit: it.unit || 'cm',
          quantity: String(it.quantity || 1),
          quantityUnit: it.quantityUnit || 'un',
          unitPriceStr,
          finishingsInput: (it.finishings || []).join(', '),
          technicalNotes: it.technicalNotes || '',
          priority: 'MEDIUM',
          initialStageId: defaultStageId,
        };
      });
      setItems(mappedItems);
    }

    // Switch back to review form
    setCreationMode('manual');
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { ...emptyItem, initialStageId: defaultStageId }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemFormState, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Calcula totais em centavos
  const calculatedItems = items.map((item) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const unitPriceCents = parseBRLInputToCents(item.unitPriceStr);
    const itemTotalCents = qty * unitPriceCents;
    return { qty, unitPriceCents, itemTotalCents };
  });

  const totalOrderCents = calculatedItems.reduce((acc, curr) => acc + curr.itemTotalCents, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName.trim()) {
      setErrorMsg('O nome do cliente é obrigatório.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].productName.trim()) {
        setErrorMsg(`Preencha o nome do produto no Item #${i + 1}.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const formattedItems: CreateManualOrderItemInput[] = items.map((item) => {
        const widthNum = parseFloat(item.width) || undefined;
        const heightNum = parseFloat(item.height) || undefined;
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const unitPriceCents = parseBRLInputToCents(item.unitPriceStr);

        const finishings = item.finishingsInput
          ? item.finishingsInput
              .split(',')
              .map((f) => f.trim())
              .filter(Boolean)
          : [];

        return {
          productName: item.productName.trim(),
          category: item.category.trim() || undefined,
          sector: item.sector,
          width: widthNum,
          height: heightNum,
          unit: item.unit,
          quantity: qty,
          quantityUnit: item.quantityUnit.trim() || 'un',
          unitPriceCents,
          finishings,
          technicalNotes: item.technicalNotes.trim() || undefined,
          priority: item.priority,
          initialStageId: item.initialStageId || defaultStageId || undefined,
        };
      });

      const deliveryDateObj = new Date(deliveryDate);
      deliveryDateObj.setHours(18, 0, 0, 0);

      await createManualOrder({
        origin: orderOrigin,
        orcagrafQuoteId: importedQuoteReference || undefined,
        sellerName: sellerName || undefined,
        sellerCommissionPct: sellerCommissionPct,
        customer: {
          name: customerName.trim(),
          document: customerDoc.trim() || undefined,
          email: customerEmail.trim() || undefined,
          phone: customerPhone.trim() || undefined,
          contactPerson: contactPerson.trim() || undefined,
        },
        items: formattedItems,
        notes: orderNotes.trim() || undefined,
        deliveryDateISO: deliveryDateObj.toISOString(),
        dataOrigin: 'user',
      });

      // Limpa formulário após salvar com sucesso
      setCustomerName('');
      setCustomerDoc('');
      setCustomerEmail('');
      setCustomerPhone('');
      setContactPerson('');
      setOrderNotes('');
      setImportedQuoteReference(null);
      setSellerName(null);
      setSellerCommissionPct(undefined);
      setItems([{ ...emptyItem }]);

      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-order-modal-title"
      data-testid="new-order-modal"
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 id="new-order-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Novo Pedido de Venda
              </h3>
              <p className="text-xs text-slate-500">
                Cada item gerará uma Ordem de Produção (OP) independente no fluxo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar modal de novo pedido"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 pt-2">
          <button
            type="button"
            onClick={() => {
              setCreationMode('manual');
              if (!importedQuoteReference) setOrderOrigin('MANUAL');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              creationMode === 'manual'
                ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Preenchimento Manual</span>
          </button>

          <button
            type="button"
            onClick={() => setCreationMode('orcagraf')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              creationMode === 'orcagraf'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Importar do OrçaGraf</span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-extrabold text-emerald-800">
              Aprovados
            </span>
          </button>
        </div>

        {/* Import Banner if quote was loaded */}
        {importedQuoteReference && creationMode === 'manual' && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                Dados carregados do Orçamento OrçaGraf. Você pode revisar e editar os campos antes de salvar.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setImportedQuoteReference(null);
                setOrderOrigin('MANUAL');
                setSellerName(null);
                setSellerCommissionPct(undefined);
              }}
              className="text-[11px] font-bold text-emerald-700 hover:underline"
            >
              Desvincular Orçamento
            </button>
          </div>
        )}

        {/* Content switch */}
        {creationMode === 'orcagraf' ? (
          /* OrçaGraf Import Selector View */
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoadingEntitlement ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                <span>Validando autorização de integração OrçaGraf + ArteFlow...</span>
              </div>
            ) : !entitlementStatus?.canImport ? (
              /* Informative state when organization does NOT have dual entitlement */
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900">
                    Integração OrçaGraf Indisponível
                  </h4>
                  <p className="mt-1 text-xs text-amber-800 max-w-md mx-auto">
                    Disponível para organizações com <strong>OrçaGraf + ArteFlow</strong> ativos e acesso individual habilitado.
                  </p>
                </div>
                {config.prexyonPortalUrl && (
                  <div className="pt-2">
                    <a
                      href={config.prexyonPortalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-500 transition"
                    >
                      <span>Gerenciar Assinatura no Portal Prexyon</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              /* Quote List for Import */
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Selecione um Orçamento Aprovado do OrçaGraf
                    </h4>
                    <p className="text-xs text-slate-500">
                      Somente orçamentos com status <strong>Aprovado</strong> e ainda não importados para o ArteFlow.
                    </p>
                  </div>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar por número ou cliente..."
                      value={quoteSearchQuery}
                      onChange={(e) => setQuoteSearchQuery(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {isLoadingQuotes ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                    <span>Carregando orçamentos aprovados...</span>
                  </div>
                ) : quotesLoadError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50/70 p-6 text-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
                    <h4 className="text-sm font-bold text-red-900">
                      {quotesLoadError.includes('permissão')
                        ? 'Permissão Insuficiente'
                        : 'Não foi possível carregar os orçamentos'}
                    </h4>
                    <p className="text-xs text-red-800 max-w-md mx-auto">
                      {quotesLoadError}
                    </p>
                  </div>
                ) : filteredQuotes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500 text-xs">
                    Nenhum orçamento aprovado pendente de importação encontrado no OrçaGraf.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredQuotes.map((quote) => (
                      <div
                        key={quote.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-400 transition flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {quote.quoteNumber}
                            </span>
                            <span className="font-bold text-sm text-slate-900 truncate">
                              {quote.customerName}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {quote.itemCount} item(s) • Entrega prevista:{' '}
                            {quote.deliveryDate ? new Date(quote.deliveryDate).toLocaleDateString('pt-BR') : 'Não informada'}
                            {quote.sellerName ? ` • Vendedor: ${quote.sellerName}` : ''}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0 flex items-center gap-4">
                          <div>
                            <span className="block text-xs font-bold text-slate-900 font-mono">
                              {formatCentsToBRL(quote.totalAmountCents)}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">
                              Aprovado
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectQuote(quote)}
                            className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-xs flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Carregar Dados</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Section 1: Customer Snapshot & Order Details */}
            <div className="bg-slate-50/70 rounded-xl border border-slate-200 p-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-sky-600" />
                  <span>1. Dados do Cliente (Snapshot)</span>
                </h4>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Origem do Pedido:</span>
                  <select
                    aria-label="Origem do Pedido"
                    data-testid="order-origin-select"
                    value={orderOrigin}
                    onChange={(e) => setOrderOrigin(e.target.value as OrderOrigin)}
                    className="text-xs px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
                  >
                    <option value="MANUAL">Manual (Interno)</option>
                    <option value="ORCAGRAF">OrçaGraf (Integrado)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome / Razão Social *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Alfa Comunicação & Eventos"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CPF / CNPJ
                  </label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={customerDoc}
                    onChange={(e) => setCustomerDoc(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="contato@cliente.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pessoa de Contato
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Juliana Silva"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data de Entrega Prometida *
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Items & Production Jobs */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-sky-600" />
                  <span>2. Itens do Pedido ({items.length})</span>
                </h4>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Item</span>
                </button>
              </div>

              {items.map((item, index) => {
                const itemCalc = calculatedItems[index];

                return (
                  <div
                    key={index}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3 relative transition-all"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px]">
                          #{index + 1}
                        </span>
                        <span>Item & Ordem de Produção #{index + 1}</span>
                      </span>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-700">
                          Total: {formatCentsToBRL(itemCalc.itemTotalCents)}
                        </span>

                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            aria-label={`Remover item #${index + 1}`}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nome do Produto / Serviço *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Cartão de Visita 4x4 Couché 300g"
                          value={item.productName}
                          onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Categoria
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Comunicação Visual"
                          value={item.category}
                          onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Setor Produtivo
                        </label>
                        <select
                          value={item.sector}
                          onChange={(e) => handleItemChange(index, 'sector', e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none"
                        >
                          {SECTORS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Quantidade *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Unidade
                        </label>
                        <input
                          type="text"
                          placeholder="un, m², cento"
                          value={item.quantityUnit}
                          onChange={(e) => handleItemChange(index, 'quantityUnit', e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Preço Unitário (R$)
                        </label>
                        <input
                          type="text"
                          value={item.unitPriceStr}
                          onChange={(e) => handleItemChange(index, 'unitPriceStr', e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none text-right font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Prioridade
                        </label>
                        <select
                          value={item.priority}
                          onChange={(e) => handleItemChange(index, 'priority', e.target.value as Priority)}
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none"
                        >
                          <option value="LOW">Baixa</option>
                          <option value="MEDIUM">Média</option>
                          <option value="HIGH">Alta</option>
                          <option value="URGENT">Urgente</option>
                        </select>
                      </div>

                      {activeStages.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Etapa Inicial
                          </label>
                          <select
                            value={item.initialStageId || defaultStageId}
                            onChange={(e) => handleItemChange(index, 'initialStageId', e.target.value)}
                            className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none"
                          >
                            {activeStages.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name} {st.isInitial ? '(Padrão)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Dimensions Row */}
                      <div className="sm:col-span-2 grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Largura
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={item.width}
                            onChange={(e) => handleItemChange(index, 'width', e.target.value)}
                            className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Altura
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={item.height}
                            onChange={(e) => handleItemChange(index, 'height', e.target.value)}
                            className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Unidade Dim.
                          </label>
                          <select
                            value={item.unit}
                            onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                            className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-300 rounded"
                          >
                            <option value="cm">cm</option>
                            <option value="mm">mm</option>
                            <option value="m">m</option>
                          </select>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Acabamentos (separar por vírgula)
                        </label>
                        <input
                          type="text"
                          placeholder="Ilhós reforçado, Bainha soldada"
                          value={item.finishingsInput}
                          onChange={(e) => handleItemChange(index, 'finishingsInput', e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Observações Técnicas de Produção
                        </label>
                        <input
                          type="text"
                          placeholder="Sangria de 2mm, resolução 300dpi, etc."
                          value={item.technicalNotes}
                          onChange={(e) => handleItemChange(index, 'technicalNotes', e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Observations & Total Summary */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="w-full sm:w-1/2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações Gerais do Pedido
                </label>
                <textarea
                  rows={2}
                  placeholder="Instruções de entrega, condições comerciais, etc."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>

              <div className="text-right sm:self-end">
                <span className="text-xs text-slate-500 font-medium block">
                  Valor Total do Pedido:
                </span>
                <span className="text-xl font-black text-slate-900 font-mono">
                  {formatCentsToBRL(totalOrderCents)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Calculado em centavos inteiros ({totalOrderCents}¢)
                </span>
              </div>
            </div>
          </form>
        )}

        {/* Footer Actions */}
        {creationMode === 'manual' && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSubmitting ? 'Gerando OPs...' : 'Salvar Pedido & Gerar OPs'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
