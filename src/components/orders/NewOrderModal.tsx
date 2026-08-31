import React, { useState, useEffect, useRef } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { CreateManualOrderItemInput } from '../../services/orderService';
import { Priority, OrderOrigin } from '../../types/domain';
import { SECTORS } from '../../domain/constants';
import { parseBRLInputToCents, formatCentsToBRL } from '../../domain/money';
import {
  X,
  Plus,
  Trash2,
  ShoppingCart,
  Building2,
  Package,
  Sparkles,
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
};

export const NewOrderModal: React.FC = () => {
  const { isNewOrderModalOpen, setIsNewOrderModalOpen, createManualOrder } = useArteFlow();

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
  const [items, setItems] = useState<ItemFormState[]>([{ ...emptyItem }]);
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

  const handleClose = () => {
    setIsNewOrderModalOpen(false);
    // Retorno acessível de foco ao elemento acionador
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  };

  if (!isNewOrderModalOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [...prev, { ...emptyItem }]);
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
          initialStageId: 'stage-entry',
        };
      });

      const deliveryDateObj = new Date(deliveryDate);
      deliveryDateObj.setHours(18, 0, 0, 0);

      await createManualOrder({
        origin: orderOrigin,
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
      setItems([{ ...emptyItem }]);

      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar pedido manual.');
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

        {/* Form Body */}
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
                  value={orderOrigin}
                  onChange={(e) => setOrderOrigin(e.target.value as OrderOrigin)}
                  className="text-xs px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
                >
                  <option value="MANUAL">Manual (Interno)</option>
                  <option value="ORCAGRAF">OrçaGraf (Contratual)</option>
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
                  placeholder="(11) 90000-0000"
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
                  placeholder="Nome do contato"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Prazo de Entrega Geral *
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

          {/* Section 2: Order Items (1 Item = 1 OP) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-sky-600" />
                <span>2. Itens do Pedido ({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
              </h4>

              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Item</span>
              </button>
            </div>

            {items.map((item, index) => {
              const calc = calculatedItems[index];

              return (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3 relative group"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Item #{index + 1} — Gerará OP independente
                    </span>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nome do Produto / Trabalho *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Cartão de Visita 4x4 Couché 300g"
                        value={item.productName}
                        onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Setor Produtivo
                      </label>
                      <select
                        value={item.sector}
                        onChange={(e) => handleItemChange(index, 'sector', e.target.value)}
                        className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none"
                      >
                        {SECTORS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Prioridade da OP
                      </label>
                      <select
                        value={item.priority}
                        onChange={(e) => handleItemChange(index, 'priority', e.target.value as Priority)}
                        className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none"
                      >
                        <option value="LOW">Baixa</option>
                        <option value="MEDIUM">Média</option>
                        <option value="HIGH">Alta</option>
                        <option value="URGENT">Urgente</option>
                      </select>
                    </div>

                    {/* Dimensões e Quantidades */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Largura x Altura
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="Larg"
                          value={item.width}
                          onChange={(e) => handleItemChange(index, 'width', e.target.value)}
                          className="w-1/2 text-xs px-2 py-1.5 bg-slate-50 border border-slate-300 rounded"
                        />
                        <span className="text-slate-400 text-xs">x</span>
                        <input
                          type="number"
                          placeholder="Alt"
                          value={item.height}
                          onChange={(e) => handleItemChange(index, 'height', e.target.value)}
                          className="w-1/2 text-xs px-2 py-1.5 bg-slate-50 border border-slate-300 rounded"
                        />
                        <select
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value as any)}
                          className="text-xs px-1 py-1.5 bg-slate-50 border border-slate-300 rounded"
                        >
                          <option value="cm">cm</option>
                          <option value="mm">mm</option>
                          <option value="m">m</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Quantidade
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="w-2/3 text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded"
                        />
                        <input
                          type="text"
                          placeholder="un"
                          value={item.quantityUnit}
                          onChange={(e) => handleItemChange(index, 'quantityUnit', e.target.value)}
                          className="w-1/3 text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-center"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Preço Unitário (R$)
                      </label>
                      <input
                        type="text"
                        placeholder="0,00"
                        value={item.unitPriceStr}
                        onChange={(e) => handleItemChange(index, 'unitPriceStr', e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Subtotal do Item
                      </label>
                      <div className="text-xs font-bold text-slate-900 py-1.5">
                        {formatCentsToBRL(calc.itemTotalCents)}
                      </div>
                    </div>

                    {/* Acabamentos e Notas */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Acabamentos (separados por vírgula)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Laminação Fosca, Verniz Localizado, Refile"
                        value={item.finishingsInput}
                        onChange={(e) => handleItemChange(index, 'finishingsInput', e.target.value)}
                        className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Observações Técnicas para Produção
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Sangria 2mm, conferir gabarito do facão"
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

        {/* Footer Actions */}
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
      </div>
    </div>
  );
};
