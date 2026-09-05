import React, { useState, useMemo } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { Supplier } from '../../types/procurement';
import {
  Plus,
  Search,
  Building2,
  Edit2,
  Power,
  Mail,
  Phone,
  Clock,
  FileCheck,
} from 'lucide-react';

export const SuppliersTab: React.FC = () => {
  const {
    can = () => true,
    suppliers,
    setSelectedSupplier,
    setIsNewSupplierModalOpen,
    setIsEditSupplierModalOpen,
    toggleSupplierActive,
  } = useArteFlow();
  const canManage = can('arteflow.procurement.manage');

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((sup) => {
      const matchActive =
        activeFilter === 'ALL' ||
        (activeFilter === 'ACTIVE' && sup.isActive) ||
        (activeFilter === 'INACTIVE' && !sup.isActive);

      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        sup.code.toLowerCase().includes(q) ||
        sup.tradeName.toLowerCase().includes(q) ||
        (sup.corporateName && sup.corporateName.toLowerCase().includes(q)) ||
        (sup.document && sup.document.includes(q)) ||
        (sup.contactName && sup.contactName.toLowerCase().includes(q));

      return matchActive && matchSearch;
    });
  }, [suppliers, activeFilter, search]);

  const handleEdit = (supplier: Supplier) => {
    if (!canManage) return;
    setSelectedSupplier(supplier);
    setIsEditSupplierModalOpen(true);
  };

  const handleToggle = async (supplierId: string) => {
    if (!canManage) return;
    try {
      await toggleSupplierActive(supplierId);
    } catch {
      // Tratado via context
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código, nome, CNPJ ou contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
            />
          </div>

          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
          >
            <option value="ALL">Todos os Fornecedores</option>
            <option value="ACTIVE">Apenas Ativos</option>
            <option value="INACTIVE">Apenas Inativos</option>
          </select>
        </div>

        {canManage && <button
          type="button"
          onClick={() => setIsNewSupplierModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Novo Fornecedor
        </button>}
      </div>

      {/* Tabela de Fornecedores */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">Nenhum Fornecedor Encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            Cadastre os parceiros e distribuidores homologados para fornecimento de papéis, lonas, chapas e insumos.
          </p>
          {canManage && <button
            type="button"
            onClick={() => setIsNewSupplierModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Primeiro Fornecedor
          </button>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Razão / Nome Fantasia</th>
                  <th className="py-3.5 px-4">Documento</th>
                  <th className="py-3.5 px-4">Contato / Contato Comercial</th>
                  <th className="py-3.5 px-4">Prazo / Pagamento</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{sup.code}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{sup.tradeName}</div>
                      {sup.corporateName && (
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{sup.corporateName}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {sup.document || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 font-medium">{sup.contactName || 'Comercial'}</div>
                      <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 mt-0.5">
                        {sup.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {sup.email}
                          </span>
                        )}
                        {sup.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {sup.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 text-slate-900 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {sup.defaultLeadTimeDays ? `${sup.defaultLeadTimeDays} dias úteis` : 'A combinar'}
                      </div>
                      {sup.paymentTermsSnapshot && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <FileCheck className="w-3 h-3 text-slate-400" />
                          {sup.paymentTermsSnapshot}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          sup.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {sup.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {canManage && <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(sup)}
                          title="Editar fornecedor"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggle(sup.id)}
                          title={sup.isActive ? 'Desativar fornecedor' : 'Ativar fornecedor'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            sup.isActive
                              ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                              : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
