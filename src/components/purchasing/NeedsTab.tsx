import React from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { ProcurementSuggestion } from '../../types/procurement';
import {
  AlertTriangle,
  ArrowRight,
  Package,
  CheckCircle2,
  FilePlus,
  Layers,
  Info,
} from 'lucide-react';

export const NeedsTab: React.FC = () => {
  const {
    can = () => true,
    procurementSuggestions,
    setIsNewRequestModalOpen,
    setPrefillRequestItem,
    setActivePage,
    setSelectedJob,
    jobs,
  } = useArteFlow();
  const canManage = can('arteflow.procurement.manage');

  const handleCreateRequestFromSuggestion = (sug: ProcurementSuggestion) => {
    if (!canManage) return;
    setPrefillRequestItem({
      materialId: sug.materialId,
      requestedQuantityMilli: sug.suggestedQuantityMilli,
      reason: sug.reason,
      productionJobId: sug.productionJobId,
      source: sug.source,
    });
    setIsNewRequestModalOpen(true);
  };

  const handleNavigateToJob = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      setSelectedJob(job);
      setActivePage('production');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Informativo */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Detecção Automática de Necessidades:</span>{' '}
          O sistema analisa continuamente os saldos disponíveis em estoque, o estoque mínimo de segurança e as demandas
          das Ordens de Produção (OPs). Nenhuma compra é realizada sem a confirmação expressa do operador.
        </div>
      </div>

      {procurementSuggestions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Nenhuma Necessidade de Compra Pendente</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
            Todos os materiais cadastrados possuem saldo suficiente para atender ao estoque mínimo e às Ordens de Produção ativas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {procurementSuggestions.map((sug) => {
            const isShortage = sug.source === 'PRODUCTION_SHORTAGE';

            return (
              <div
                key={sug.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all"
              >
                <div>
                  {/* Header do Card */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        isShortage
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {isShortage ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          Falta na Produção
                        </>
                      ) : (
                        <>
                          <Package className="w-3.5 h-3.5 text-amber-600" />
                          Abaixo do Mínimo
                        </>
                      )}
                    </span>

                    {sug.hasOpenRequest && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        Solicitação em aberto
                      </span>
                    )}
                  </div>

                  {/* Informações do Material */}
                  <h4 className="font-bold text-slate-900 text-base mb-0.5">{sug.materialName}</h4>
                  <div className="text-xs text-slate-500 font-mono mb-4">SKU: {sug.materialSku}</div>

                  {/* Detalhes de Saldo */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2 mb-4 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Estoque Físico:</span>
                      <span className="font-semibold text-slate-900">
                        {sug.stockOnHandMilli / 1000} {sug.unit}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Reservado:</span>
                      <span className="font-semibold text-slate-900">
                        {sug.reservedMilli / 1000} {sug.unit}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Disponível:</span>
                      <span
                        className={`font-semibold ${
                          sug.availableMilli === 0 ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {sug.availableMilli / 1000} {sug.unit}
                      </span>
                    </div>
                    {sug.minimumStockMilli > 0 && (
                      <div className="flex justify-between items-center border-t border-slate-200/60 pt-1.5">
                        <span className="text-slate-600">Estoque Mínimo:</span>
                        <span className="font-semibold text-slate-900">
                          {sug.minimumStockMilli / 1000} {sug.unit}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* OP Vinculada (se for falta de produção) */}
                  {sug.productionJobId && sug.jobCode && (
                    <div className="mb-4 p-2.5 rounded-lg bg-red-50/50 border border-red-100 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-red-900 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-red-600" />
                          OP: {sug.jobCode}
                        </div>
                        {sug.productName && (
                          <div className="text-[11px] text-red-700 truncate max-w-[180px]">
                            {sug.productName}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleNavigateToJob(sug.productionJobId!)}
                        className="text-xs font-medium text-red-700 hover:text-red-900 hover:underline flex items-center gap-1"
                      >
                        Ver OP <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Sugestão de Compra */}
                  <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3 mb-4">
                    <div className="text-xs text-blue-700 font-medium">Quantidade Sugerida:</div>
                    <div className="text-lg font-bold text-blue-900">
                      {sug.suggestedQuantityMilli / 1000} {sug.unit}
                    </div>
                    <div className="text-[11px] text-blue-600 mt-0.5">{sug.reason}</div>
                  </div>
                </div>

                {/* Ação */}
                {canManage && <button
                  type="button"
                  onClick={() => handleCreateRequestFromSuggestion(sug)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors shadow-xs"
                >
                  <FilePlus className="w-4 h-4" />
                  Gerar Solicitação de Compra
                </button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
