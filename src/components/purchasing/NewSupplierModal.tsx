import React, { useState, useEffect, useRef } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { X, Building2, AlertCircle } from 'lucide-react';

export const NewSupplierModal: React.FC = () => {
  const { can = () => true, isNewSupplierModalOpen, setIsNewSupplierModalOpen, createSupplier, suppliers } = useArteFlow();

  const [code, setCode] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [corporateName, setCorporateName] = useState('');
  const [document, setDocument] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialInputRef = useRef<HTMLInputElement>(null);

  // Sugere próximo código (ex: SUP-003)
  useEffect(() => {
    if (isNewSupplierModalOpen) {
      const nextNum = suppliers.length + 1;
      setCode(`SUP-${nextNum.toString().padStart(3, '0')}`);
      setTradeName('');
      setCorporateName('');
      setDocument('');
      setContactName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setLeadTimeDays('');
      setPaymentTerms('');
      setNotes('');
      setError(null);

      setTimeout(() => {
        initialInputRef.current?.focus();
      }, 50);
    }
  }, [isNewSupplierModalOpen, suppliers.length]);

  // Tecla Escape para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNewSupplierModalOpen) {
        setIsNewSupplierModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewSupplierModalOpen, setIsNewSupplierModalOpen]);

  if (!isNewSupplierModalOpen || !can('arteflow.procurement.manage')) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError('Código do fornecedor é obrigatório.');
      return;
    }
    if (!tradeName.trim()) {
      setError('Nome fantasia do fornecedor é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createSupplier({
        code: code.trim().toUpperCase(),
        tradeName: tradeName.trim(),
        corporateName: corporateName.trim() || undefined,
        document: document.trim() || undefined,
        contactName: contactName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        defaultLeadTimeDays: leadTimeDays ? parseInt(leadTimeDays, 10) : undefined,
        paymentTermsSnapshot: paymentTerms.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setIsNewSupplierModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar fornecedor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-supplier-title"
    >
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="new-supplier-title" className="text-base font-bold text-slate-900">
                Cadastrar Fornecedor
              </h3>
              <p className="text-xs text-slate-500">Parceiro ou distribuidor homologado para compras</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsNewSupplierModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Código *</label>
              <input
                ref={initialInputRef}
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SUP-001"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Fantasia *</label>
              <input
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Ex: Suprimentos Gráficos Brasil"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Razão Social</label>
              <input
                type="text"
                value={corporateName}
                onChange={(e) => setCorporateName(e.target.value)}
                placeholder="Ex: Suprimentos Gráficos S/A"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ / CPF</label>
              <input
                type="text"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="12.345.678/0001-90"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contato Comercial</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nome do vendedor/contato"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendas@fornecedor.com"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço Completo</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, Número, Bairro, Cidade/UF"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Prazo Padrão de Entrega (dias úteis)</label>
              <input
                type="number"
                min="0"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                placeholder="Ex: 3"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Condição Padrão de Pagamento</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Ex: 28 dias / Boleto Bancário"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Observações Internas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre linhas de produtos, descontos comerciais acordados, etc."
              rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewSupplierModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              {isSubmitting ? 'Salvando...' : 'Cadastrar Fornecedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
