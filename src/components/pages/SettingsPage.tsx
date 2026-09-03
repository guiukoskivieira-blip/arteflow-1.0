import React, { useState } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import {
  Building2,
  Layers,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Server,
  Users,
} from 'lucide-react';
import { useOptionalAuth } from '../../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const mode = useOptionalAuth()?.mode ?? 'standalone';
  const { organization, stages, resetDemoEnvironment, clearOperationalData } = useArteFlow();
  const [feedback, setFeedback] = useState('');

  const handleResetDemo = async () => {
    if (window.confirm('Deseja restaurar o ambiente demonstrativo com o pedido e as duas OPs iniciais?')) {
      await resetDemoEnvironment();
      setFeedback('Ambiente de demonstração restaurado com sucesso.');
      setTimeout(() => setFeedback(''), 4000);
    }
  };

  const handleClear = async () => {
    if (
      window.confirm(
        'Tem certeza que deseja apagar todos os pedidos, OPs e eventos operacionais? O estado vazio será preservado na próxima recarga.'
      )
    ) {
      await clearOperationalData();
      setFeedback('Dados operacionais removidos com sucesso. O estado vazio foi preservado.');
      setTimeout(() => setFeedback(''), 4000);
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Configurações & Estrutura Operacional</h2>
        <p className="text-xs text-slate-500 mt-1">
          Parâmetros da organização e etapas do fluxo operacional.
        </p>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Discrete Prexyon Alignment Notice */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs text-slate-600 flex items-start gap-3">
        <Users className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="leading-relaxed">
          {mode === 'connected'
            ? 'Identidade, organização e permissões são administradas centralmente pela Prexyon.'
            : 'Usuários, equipes e permissões serão administrados centralmente pela Prexyon quando o modo conectado estiver disponível.'}
        </p>
      </div>

      {/* Organization Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-600" />
          <span>Dados da Organização (Tenant Ativo)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-medium block">Nome da Empresa:</span>
            <span className="font-bold text-slate-900 text-sm">{organization.name}</span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Segmento:</span>
            <span className="font-semibold text-slate-800">{organization.segment}</span>
          </div>

          {mode === 'standalone' && <div>
            <span className="text-slate-400 font-medium block">Tenant ID (Isolamento Local):</span>
            <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              {organization.id}
            </span>
          </div>}
        </div>
      </div>

      {/* Workflow Stages Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-600" />
            <span>Etapas do Fluxo de Produção ({stages.length} etapas)</span>
          </h3>

          <span className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded font-medium">
            Referenciamento 100% por ID estável
          </span>
        </div>

        <p className="text-xs text-slate-500">
          As regras de negócio, movimentações e histórico utilizam estritamente o identificador único estável (ID) de cada etapa.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">Seq.</th>
                <th className="px-3 py-2.5">Nome da Etapa</th>
                <th className="px-3 py-2.5">ID Estável</th>
                <th className="px-3 py-2.5">Descrição Operacional</th>
                <th className="px-3 py-2.5">Cor</th>
                <th className="px-3 py-2.5">Status Especial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stages.map((stage) => (
                <tr key={stage.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2.5 font-bold font-mono text-slate-900">#{stage.sequence}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">{stage.name}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 bg-slate-50">
                    {stage.id}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{stage.description}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="font-mono text-[10px] text-slate-400">{stage.color}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {stage.isInitial && (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-semibold">
                        Inicial
                      </span>
                    )}
                    {stage.isFinal && (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold">
                        Final / Pronto
                      </span>
                    )}
                    {stage.isTerminal && (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10px] font-semibold">
                        Entregue
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Storage Management: development-only; never exposed in connected mode. */}
      {mode === 'standalone' && <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Server className="w-4 h-4 text-teal-600" />
          <span>Armazenamento & Dados Locais</span>
        </h3>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div>
            <h4 className="text-xs font-bold text-slate-800">Restaurar Ambiente Demo</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Restaura o pedido e as 2 OPs de demonstração e atualiza o marcador de versão de seed.
            </p>
          </div>
          <button
            onClick={handleResetDemo}
            className="px-3 py-2 text-xs font-semibold text-teal-700 bg-white hover:bg-teal-50 border border-teal-300 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Seed Demo</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-lg bg-red-50/50 border border-red-200">
          <div>
            <h4 className="text-xs font-bold text-red-900">Limpar Dados Operacionais</h4>
            <p className="text-xs text-red-700 mt-0.5">
              Remove todos os pedidos, OPs e eventos. Mantém o marcador de seed ativo para que os dados demo não reapareçam na recarga.
            </p>
          </div>
          <button
            onClick={handleClear}
            className="px-3 py-2 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 border border-red-300 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Dados Operacionais</span>
          </button>
        </div>
      </div>}
    </div>
  );
};
