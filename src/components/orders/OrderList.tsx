import React, { useState } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { OriginBadge } from '../common/OriginBadge';
import { formatCentsToBRL } from '../../domain/money';
import { formatISODateBR } from '../../domain/jobStatus';
import {
  Search,
  ShoppingCart,
  Plus,
  Eye,
} from 'lucide-react';

export const OrderList: React.FC = () => {
  const {
    orders,
    jobs,
    setSelectedOrder,
    setIsOrderDetailsModalOpen,
    setIsNewOrderModalOpen,
  } = useArteFlow();

  const [search, setSearch] = useState('');

  const filteredOrders = orders.filter((order) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const matchNumber = order.orderNumber.toLowerCase().includes(q);
    const matchCustomer = order.customer.name.toLowerCase().includes(q);
    const matchDoc = order.customer.document?.toLowerCase().includes(q) || false;
    const matchItems = order.items.some((it) => it.productName.toLowerCase().includes(q));
    return matchNumber || matchCustomer || matchDoc || matchItems;
  });

  const handleOpenDetails = (order: typeof orders[0]) => {
    setSelectedOrder(order);
    setIsOrderDetailsModalOpen(true);
  };

  return (
    <div className="flex-1 p-4 md:p-6 space-y-4 overflow-y-auto">
      {/* Top Search & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar pedidos por número, cliente ou item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        <button
          onClick={() => setIsNewOrderModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Pedido Manual</span>
        </button>
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-slate-300 stroke-1" />
          <p className="text-sm font-medium text-slate-600">Nenhum pedido encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Crie um novo pedido ou ajuste o termo de busca.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Número do Pedido</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Itens / OPs</th>
                  <th className="px-4 py-3">Prazo Geral</th>
                  <th className="px-4 py-3">Valor Total</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const linkedJobs = jobs.filter((j) => j.orderId === order.id);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => handleOpenDetails(order)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      {/* Order Number & DataOrigin */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-900">
                            {order.orderNumber}
                          </span>
                          <div className="mt-1">
                            <OriginBadge type="data" value={order.dataOrigin} />
                          </div>
                        </div>
                      </td>

                      {/* Origin */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <OriginBadge type="order" value={order.origin} />
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{order.customer.name}</span>
                          {order.customer.document && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              {order.customer.document}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Items & OP Badges */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-800">
                            {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {linkedJobs.map((j) => (
                              <span
                                key={j.id}
                                className="px-1.5 py-0.2 bg-sky-50 text-sky-800 border border-sky-200 rounded font-mono text-[10px]"
                              >
                                {j.jobCode}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Deadline */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-slate-700">
                          {formatISODateBR(order.deliveryDateISO)}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-900 font-mono">
                          {formatCentsToBRL(order.totalAmountCents)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetails(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detalhes</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
