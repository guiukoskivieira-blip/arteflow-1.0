import React from 'react';
import { AlertTriangle, Loader2, LockKeyhole } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, reason, returnToPrexyon } = useAuth();

  if (status === 'AUTHORIZED') return <>{children}</>;

  const loading = status === 'LOADING';
  const Icon = loading ? Loader2 : status === 'ERROR' ? AlertTriangle : LockKeyhole;
  const title = loading
    ? 'Validando acesso ao ArteFlow'
    : status === 'ERROR'
      ? 'Não foi possível validar o acesso'
      : 'Acesso ao ArteFlow não autorizado';

  return (
    <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-2xl" aria-live="polite">
        <Icon className={`h-8 w-8 text-blue-400 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        <h1 className="mt-5 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {loading
            ? 'Confirmando identidade, organização, licença e permissões na Prexyon.'
            : 'O acesso foi bloqueado de forma segura. Retorne à Prexyon para selecionar uma organização com acesso ao produto.'}
        </p>
        {!loading && reason && <p className="mt-4 rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-400">Código: {reason}</p>}
        {!loading && (
          <button
            type="button"
            onClick={returnToPrexyon}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Voltar para a Prexyon
          </button>
        )}
      </section>
    </main>
  );
};
