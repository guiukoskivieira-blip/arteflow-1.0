import React, { useState, useMemo } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { getArteFlowRuntimeConfig } from '../../config/runtime';
import {
  X,
  Search,
  BookOpen,
  HelpCircle,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Layers,
  ShoppingBag,
  Boxes,
  DollarSign,
  ShieldCheck,
  FileQuestion,
  FileText,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

type TabId =
  | 'getting-started'
  | 'orders'
  | 'production'
  | 'inventory'
  | 'procurement'
  | 'financial'
  | 'permissions'
  | 'faq'
  | 'support';

interface ManualTopic {
  id: string;
  title: string;
  tab: TabId;
  content: React.ReactNode;
  keywords: string[];
}

export const HelpCenterModal: React.FC = () => {
  const { isHelpModalOpen, setIsHelpModalOpen, activePage, organization, currentUser } = useArteFlow();
  const auth = useOptionalAuth();
  const config = useMemo(() => getArteFlowRuntimeConfig(), []);

  const [activeTab, setActiveTab] = useState<TabId>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  // Support Form State
  const [reportType, setReportType] = useState<'Bug' | 'Erro' | 'Dúvida' | 'Sugestão' | 'Feedback'>('Bug');
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSteps, setReportSteps] = useState('');
  const [reportExpected, setReportExpected] = useState('');
  const [reportActual, setReportActual] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const userName = auth?.tenant?.identity.name || currentUser.name || 'Usuário';
  const orgName = auth?.tenant?.organization.name || organization.name || 'Organização';
  const userRole = auth?.tenant?.membership.role || currentUser.role || 'operator';

  const topics: ManualTopic[] = useMemo(
    () => [
      {
        id: 'intro-arteflow',
        tab: 'getting-started',
        title: '1. O que é o ArteFlow e o Ecossistema Prexyon',
        keywords: ['ecossistema', 'prexyon', 'arteflow', 'orcagraf', 'artecheck', 'inicio', 'visão geral'],
        content: (
          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              O <strong>ArteFlow</strong> é o sistema de gestão da produção e operações gráficas da suíte <strong>Prexyon</strong>.
              Ele centraliza o acompanhamento do ciclo de vida dos pedidos, desde a emissão e roteamento de Ordens de Produção (OPs)
              até o controle de suprimentos, estoque e apuração financeira operacional.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                <p className="text-xs font-bold text-emerald-800">OrçaGraf</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">Orçamentos, engenharia de produto e propostas comerciais.</p>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
                <p className="text-xs font-bold text-sky-800">ArteFlow (Ativo)</p>
                <p className="text-[11px] text-sky-700 mt-0.5">Ordens de produção, Kanban, estoque, compras e expedição.</p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                <p className="text-xs font-bold text-violet-800">ArteCheck</p>
                <p className="text-[11px] text-violet-700 mt-0.5">Conferência de arquivos, preflight e pré-impressão.</p>
              </div>
            </div>
            <p className="pt-2">
              Você pode alternar entre os aplicativos através do seletor oficial de produtos na barra superior (Global Bar)
              sem precisar redigitar sua senha.
            </p>
          </div>
        ),
      },
      {
        id: 'orders-manual',
        tab: 'orders',
        title: '2. Emissão de Pedidos e Relação com a Produção',
        keywords: ['pedidos', 'itens', 'op', 'ordem de produção', 'prazo', 'manual', 'orcagraf'],
        content: (
          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              Novos pedidos podem ser emitidos diretamente através do botão <strong>+ Novo Pedido</strong> no cabeçalho ou na Visão Geral.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>
                <strong>Múltiplos Itens:</strong> Você pode adicionar múltiplos itens ou serviços ao mesmo pedido com dimensões,
                quantidade e acabamentos personalizados.
              </li>
              <li>
                <strong>Geração Atômica de OPs:</strong> Cada item incluído no pedido gera automaticamente sua respectiva Ordem de Produção (OP) vinculada.
              </li>
              <li>
                <strong>Origem do Pedido:</strong> Os pedidos registram a sua origem (emissão <em>Manual</em> interna ou futuros canais de integração).
                <span className="block mt-1 text-slate-500 italic">
                  * Nota: A importação automatizada direta do OrçaGraf está em desenvolvimento e será disponibilizada em versão futura.
                </span>
              </li>
              <li>
                <strong>Prazos e Prioridades:</strong> O prazo de entrega do pedido define o compromisso comercial, orientando a priorização da fila no chão de fábrica.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'production-kanban',
        tab: 'production',
        title: '3. Chão de Fábrica e Quadro Kanban de Produção',
        keywords: ['kanban', 'produção', 'etapas', 'op', 'gates', 'prioridade', 'bloqueio', 'reversão'],
        content: (
          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              O módulo de <strong>Produção</strong> organiza o fluxo das OPs através das etapas configuradas (ex: <em>Pré-Impressão</em>, <em>Impressão</em>, <em>Acabamento</em> e <em>Pronto</em>).
            </p>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-semibold text-slate-800">Movimentação de Cards:</span> É possível avançar ou retroceder OPs usando a alça de arraste (Drag & Drop acessível) ou os botões direcionais no cartão, conforme suas permissões operacionais.
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-semibold text-slate-800">Gates de Qualidade & Liberação:</span> Cada OP possui travas de segurança (Arte, Material e Financeiro). A ausência de liberação visualiza sinalizadores de aviso para a equipe antes da impressão.
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-semibold text-slate-800">Gaveta de Detalhes (Drawer):</span> Clicar sobre qualquer cartão abre a gaveta lateral completa com especificações, histórico de eventos de auditoria e notas de produção.
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'inventory-guide',
        tab: 'inventory',
        title: '4. Controle de Estoque e Reservas de Materiais',
        keywords: ['estoque', 'materiais', 'reservas', 'saldo', 'consumo', 'ajuste', 'inventario'],
        content: (
          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              O módulo de <strong>Estoque</strong> permite gerenciar matérias-primas (como papéis, lonas, tintas e insumos de acabamento)
              com precisão milimétrica / fracionária e rastreabilidade total.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Saldo em Mão vs Disponível:</strong> Exibe o saldo físico atual subtraindo as reservas ativas das OPs em andamento.</li>
              <li><strong>Reservas por OP:</strong> Requisitos de materiais podem ser vinculados diretamente a uma Ordem de Produção, garantindo reserva prévia.</li>
              <li><strong>Entradas e Ajustes:</strong> Registro de recebimentos de materiais e ajustes manuais com justificativa obrigatória de auditoria.</li>
            </ul>
          </div>
        ),
      },
      {
        id: 'procurement-guide',
        tab: 'procurement',
        title: '5. Gestão de Compras e Fornecedores',
        keywords: ['compras', 'fornecedores', 'solicitação', 'pedido de compra', 'recebimento', 'procurement'],
        content: (
          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              O módulo de <strong>Compras</strong> gerencia a cadeia de suprimentos e relacionamento com fornecedores homologados.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Cadastro de Fornecedores:</strong> Registro de contatos, dados fiscais e condições comerciais.</li>
              <li><strong>Solicitações de Compra:</strong> Abertura de requisições de compra manuais ou motivadas por falta de estoque.</li>
              <li><strong>Pedidos de Compra (PO):</strong> Emissão formal de ordens de compra e registro do recebimento de mercadorias.</li>
            </ul>
          </div>
        ),
      },
      {
        id: 'financial-guide',
        tab: 'financial',
        title: '6. Financeiro Operacional',
        keywords: ['financeiro', 'contas a pagar', 'contas a receber', 'faturamento', 'liquidação'],
        content: (
          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              O módulo <strong>Financeiro</strong> reflete a saúde operacional originada dos pedidos de venda e das despesas com compras de materiais.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Contas a Receber:</strong> Títulos e faturamentos decorrentes dos pedidos de clientes com controle de liquidação.</li>
              <li><strong>Contas a Pagar:</strong> Obrigações geradas a partir dos pedidos de compra de insumos e matérias-primas.</li>
              <li>
                <span className="text-slate-500 italic">
                  * Nota: O módulo de comissões de vendedores e operadores está previsto para a fase seguinte e não está ativo nesta versão.
                </span>
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'permissions-guide',
        tab: 'permissions',
        title: '7. Perfis de Acesso e Permissões (RBAC)',
        keywords: ['permissões', 'rbac', 'acesso', 'prexyon', 'admin', 'member', 'operator'],
        content: (
          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p>
              O acesso aos recursos do ArteFlow é centralizado e governado pela identidade da sua organização na plataforma Prexyon.
            </p>
            <div className="space-y-2 text-xs">
              <p>
                Dependendo da sua função atribuída pelo administrador (ex: <em>admin</em>, <em>manager</em>, <em>operator</em> ou <em>viewer</em>), determinadas telas, botões de ação ou edições de registros podem ficar desabilitados ou ocultos para garantir a integridade dos processos.
              </p>
              <p className="text-slate-500">
                Se você precisa de acesso a recursos restritos, solicite a alteração de perfil ao gestor da sua empresa no Portal Prexyon.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'faq-guide',
        tab: 'faq',
        title: '8. Perguntas e Dúvidas Frequentes',
        keywords: ['faq', 'dúvidas', 'perguntas', 'trocar produto', 'logout', 'sair', 'op bloqueada'],
        content: (
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <p className="font-bold text-slate-800">Qual a diferença entre Pedido e Ordem de Produção (OP)?</p>
              <p className="mt-1">
                O <em>Pedido</em> é o contrato comercial com o cliente (dados de faturamento, cliente e prazo total). A <em>OP</em> é a unidade fabril de execução para produzir cada item específico desse pedido no chão de fábrica.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <p className="font-bold text-slate-800">Por que não consigo movimentar uma OP no Kanban?</p>
              <p className="mt-1">
                A movimentação de etapas requer permissão operacional (perfil de operador ou gestor de produção). Caso seu usuário tenha acesso apenas de visualização (viewer), os cartões permanecem em modo somente-leitura.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <p className="font-bold text-slate-800">Como alternar para o OrçaGraf ou ArteCheck?</p>
              <p className="mt-1">
                Clique no seletor de produtos (com a sigla <strong>AF</strong>) na barra superior (Global Bar) e escolha o aplicativo desejado. O login unificado SSO abrirá o destino instantaneamente.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <p className="font-bold text-slate-800">Como retornar ao Portal Prexyon ou encerrar a sessão?</p>
              <p className="mt-1">
                Para ir ao Portal, clique na logo da Prexyon à esquerda na barra superior. Para sair, clique no círculo do seu avatar no canto superior direito e selecione <strong>Sair do ArteFlow</strong>.
              </p>
            </div>
          </div>
        ),
      },
    ],
    []
  );

  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) {
      return topics.filter((t) => t.tab === activeTab);
    }
    const q = searchQuery.toLowerCase().trim();
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [topics, activeTab, searchQuery]);

  const generateReportText = () => {
    const dateStr = new Date().toLocaleString('pt-BR');
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconhecido';

    return `ARTEFLOW — RELATO

TIPO: ${reportType}
TÍTULO: ${reportTitle.trim()}
DESCRIÇÃO:
${reportDescription.trim()}

PASSOS:
${reportSteps.trim() || 'Não informado'}

RESULTADO_ESPERADO:
${reportExpected.trim() || 'Não informado'}

RESULTADO_OBTIDO:
${reportActual.trim() || 'Não informado'}

MÓDULO: ${activePage}
USUÁRIO: ${userName}
ORGANIZAÇÃO: ${orgName}
ROLE: ${userRole}
VERSÃO: ArteFlow 1.0 (Produção)
NAVEGADOR: ${userAgent}
DATA/HORA: ${dateStr}
`;
  };

  const handleCopyReport = async () => {
    const text = generateReportText();
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 4000);
  };

  const handleGenerateReport = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!reportType) errors.type = 'Selecione o tipo do relato.';
    if (!reportTitle.trim()) errors.title = 'Informe um título claro para o relato.';
    if (!reportDescription.trim()) errors.description = 'Descreva os detalhes do relato.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setFormSubmitted(true);
  };

  if (!isHelpModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-center-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#031225] px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 id="help-center-title" className="text-base font-bold text-white flex items-center gap-2">
                Central de Ajuda ArteFlow
                <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-300 uppercase">
                  Manual & Suporte
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Guias operacionais, dúvidas frequentes e canal para relato de problemas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsHelpModalOpen(false)}
            aria-label="Fechar Central de Ajuda"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Navigation Bar */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar em todo o manual (ex: kanban, pedidos, estoque, comissões)..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Limpar
              </button>
            )}
          </div>

          {!searchQuery && (
            <div className="flex gap-1.5 overflow-x-auto pt-3 no-scrollbar pb-0.5">
              {[
                { id: 'getting-started', label: 'Começando', icon: Sparkles },
                { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
                { id: 'production', label: 'Produção', icon: Layers },
                { id: 'inventory', label: 'Estoque', icon: Boxes },
                { id: 'procurement', label: 'Compras', icon: ShoppingBag },
                { id: 'financial', label: 'Financeiro', icon: DollarSign },
                { id: 'permissions', label: 'Permissões', icon: ShieldCheck },
                { id: 'faq', label: 'FAQ', icon: FileQuestion },
                { id: 'support', label: 'Relatar Problema', icon: MessageSquare, isHighlight: true },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as TabId)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? tab.isHighlight
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-sky-600 text-white shadow-sm'
                        : tab.isHighlight
                        ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {searchQuery ? (
            /* Search Results View */
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Resultados da busca por "{searchQuery}" ({filteredTopics.length})
              </p>
              {filteredTopics.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                  <HelpCircle className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">Nenhum tópico encontrado</p>
                  <p className="text-xs text-slate-500">Tente buscar por termos mais genéricos ou abra uma das abas do menu.</p>
                </div>
              ) : (
                filteredTopics.map((topic) => (
                  <div key={topic.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <ChevronRight className="h-4 w-4 text-sky-500" />
                      {topic.title}
                    </h3>
                    <div>{topic.content}</div>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'support' ? (
            /* Support Form & Report View */
            <div className="space-y-4">
              <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3.5 text-xs text-sky-900 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-sky-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Canal de Relato & Feedback</p>
                  <p className="mt-0.5 leading-relaxed text-sky-800">
                    O envio automático direto para o suporte central está em fase de homologação técnica.
                    Você pode preencher os campos abaixo para gerar um relatório estruturado completo e copiá-lo para enviar ao suporte ou abrir o Portal Prexyon.
                  </p>
                </div>
              </div>

              <form onSubmit={handleGenerateReport} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Report Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tipo do Relato <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="Bug">Bug (Falha em funcionalidade)</option>
                      <option value="Erro">Erro (Mensagem de falha inesperada)</option>
                      <option value="Dúvida">Dúvida (Ajuda de utilização)</option>
                      <option value="Sugestão">Sugestão de melhoria</option>
                      <option value="Feedback">Feedback geral</option>
                    </select>
                    {formErrors.type && <p className="mt-1 text-[11px] text-red-500">{formErrors.type}</p>}
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Título Resumido <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      placeholder="Ex: Botão de impressão travou ao clicar"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    {formErrors.title && <p className="mt-1 text-[11px] text-red-500">{formErrors.title}</p>}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Descrição Detalhada <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Descreva claramente o que você estava tentando fazer ou o comportamento observado..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  {formErrors.description && <p className="mt-1 text-[11px] text-red-500">{formErrors.description}</p>}
                </div>

                {/* Optional fields for Bug/Error */}
                {(reportType === 'Bug' || reportType === 'Erro') && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Passos para Reproduzir</label>
                      <textarea
                        rows={2}
                        value={reportSteps}
                        onChange={(e) => setReportSteps(e.target.value)}
                        placeholder="1. Abrir pedidos&#10;2. Clicar em salvar..."
                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Resultado Esperado</label>
                      <textarea
                        rows={2}
                        value={reportExpected}
                        onChange={(e) => setReportExpected(e.target.value)}
                        placeholder="O pedido deveria ter sido salvo..."
                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Resultado Obtido</label>
                      <textarea
                        rows={2}
                        value={reportActual}
                        onChange={(e) => setReportActual(e.target.value)}
                        placeholder="Exibiu código de erro AUTHENTICATION..."
                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                )}

                {/* Context summary preview */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-slate-500" />
                    Contexto Técnico (Anexado automaticamente sem credenciais ou senhas):
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Produto: ArteFlow | Módulo: {activePage} | Usuário: {userName} | Organização: {orgName} | Perfil: {userRole}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-500 transition"
                  >
                    Gerar Relatório de Suporte
                  </button>
                </div>
              </form>

              {/* Generated Report Section */}
              {formSubmitted && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 mt-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <p className="text-xs font-bold text-slate-900">Relatório Estruturado Pronto para Envio</p>
                    <button
                      type="button"
                      onClick={handleCopyReport}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm"
                    >
                      {copiedSuccess ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedSuccess ? 'Copiado para Área de Transferência!' : 'Copiar Relatório'}</span>
                    </button>
                  </div>

                  <pre className="max-h-48 overflow-y-auto rounded-lg bg-slate-900 p-3 text-[11px] font-mono text-emerald-300 leading-relaxed whitespace-pre-wrap select-all">
                    {generateReportText()}
                  </pre>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-slate-500">
                      Envio automático indisponível. Cole o relatório no canal da Prexyon.
                    </p>
                    {config.prexyonPortalUrl && (
                      <a
                        href={config.prexyonPortalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
                      >
                        <span>Abrir Portal Prexyon</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Regular Tabs View */
            <div className="space-y-4">
              {filteredTopics.map((topic) => (
                <div key={topic.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <ChevronRight className="h-4 w-4 text-sky-500" />
                    {topic.title}
                  </h3>
                  <div>{topic.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          <span>ArteFlow 1.0 — Documentação Oficial</span>
          <button
            type="button"
            onClick={() => setIsHelpModalOpen(false)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
