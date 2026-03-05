'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3, Eye, Filter, MapPin, Search } from 'lucide-react';
import {
  AppLayout,
  EmptyState,
  PageHeader,
  CrudFiltros,
  CrudTable,
  type ColunaTabela,
  type AcaoTabela,
} from '@/components';
import { PerfilUsuario } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { checkinService, CheckinRegistro } from '@/lib/services/checkin.service';

function formatarDataHora(data?: string | null): string {
  if (!data) return '-';
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarDuracao(dataCheckin: string, dataCheckout?: string | null): string {
  const inicio = new Date(dataCheckin).getTime();
  const fim = dataCheckout ? new Date(dataCheckout).getTime() : Date.now();
  const diferenca = Math.max(fim - inicio, 0);
  const horas = Math.floor(diferenca / (1000 * 60 * 60));
  const minutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));
  return `${horas}h ${minutos}min`;
}

interface FiltrosCheckin {
  auditorId: string;
  clienteId: string;
  dataInicio: string;
  dataFim: string;
}

const FILTROS_INICIAIS: FiltrosCheckin = {
  auditorId: '',
  clienteId: '',
  dataInicio: '',
  dataFim: '',
};

const colunas: ColunaTabela<CheckinRegistro>[] = [
  {
    label: 'Cliente',
    render: (c) => (
      <div>
        <div className="font-medium text-base-content">
          {c.cliente?.nomeFantasia || c.cliente?.razaoSocial || 'Cliente não informado'}
        </div>
        <div className="text-xs text-base-content/50 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {c.unidade?.nome || 'Unidade não informada'}
        </div>
      </div>
    ),
  },
  {
    label: 'Auditor',
    render: (c) => (
      <span className="text-sm text-base-content/70">
        {c.usuario?.nome || 'Não informado'}
      </span>
    ),
  },
  {
    label: 'Data',
    render: (c) => (
      <span className="text-sm text-base-content/70 tabular-nums">
        {formatarDataHora(c.dataCheckin)}
      </span>
    ),
  },
  {
    label: 'Duração',
    render: (c) => (
      <span className="text-sm text-base-content/70 tabular-nums">
        {formatarDuracao(c.dataCheckin, c.dataCheckout)}
      </span>
    ),
  },
  {
    label: 'Status',
    render: (c) => (
      <span className={`badge badge-sm ${c.status === 'aberto' ? 'badge-warning' : 'badge-success'}`}>
        {c.status === 'aberto' ? 'Aberto' : 'Fechado'}
      </span>
    ),
  },
];

export default function CheckinsPage() {
  const { usuario } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [checkins, setCheckins] = useState<CheckinRegistro[]>([]);
  const [isPesquisado, setIsPesquisado] = useState(false);
  const [auditoresOpcoes, setAuditoresOpcoes] = useState<Array<{ value: string; label: string }>>([]);
  const [clientesOpcoes, setClientesOpcoes] = useState<Array<{ value: string; label: string }>>([]);
  const [detalheCheckin, setDetalheCheckin] = useState<CheckinRegistro | null>(null);
  const [isDetalheAberto, setIsDetalheAberto] = useState(false);

  const podeVisualizar = useMemo(
    () => usuario?.perfil === PerfilUsuario.GESTOR || usuario?.perfil === PerfilUsuario.MASTER,
    [usuario?.perfil],
  );

  useEffect(() => {
    if (!podeVisualizar) return;
    const carregarOpcoes = async (): Promise<void> => {
      const filtros = await checkinService.buscarFiltros();
      setAuditoresOpcoes(
        filtros.auditores.map((auditor) => ({ value: auditor.id, label: auditor.nome })),
      );
      setClientesOpcoes(
        filtros.clientes.map((cliente) => ({
          value: cliente.id,
          label: cliente.nome,
        })),
      );
    };
    carregarOpcoes().catch(() => undefined);
  }, [podeVisualizar]);

  const carregarCheckins = async (filtros: FiltrosCheckin): Promise<void> => {
    setLoading(true);
    try {
      const resposta = await checkinService.listar({
        page: 1,
        limit: 200,
        auditorId: filtros.auditorId || undefined,
        clienteId: filtros.clienteId || undefined,
        dataInicio: filtros.dataInicio || undefined,
        dataFim: filtros.dataFim || undefined,
      });
      setCheckins(resposta.items || []);
    } finally {
      setLoading(false);
    }
  };

  const handleVisualizar = async (checkin: CheckinRegistro): Promise<void> => {
    const detalhe = await checkinService.buscarPorId(checkin.id);
    setDetalheCheckin(detalhe);
    setIsDetalheAberto(true);
  };

  const acoes: AcaoTabela<CheckinRegistro>[] = [
    { label: 'Visualizar', icon: Eye, onClick: (c) => { void handleVisualizar(c); } },
  ];

  if (!podeVisualizar) {
    return (
      <AppLayout>
        <PageHeader title="Checkins" subtitle="Acesso restrito para gestores e administradores" />
        <div className="px-4 py-4 lg:px-8">
          <EmptyState
            icon={Filter}
            title="Sem permissão para acessar checkins"
            description="Esta funcionalidade está disponível apenas para Gestor e Administrador."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Checkins"
        subtitle="Visualize checkins realizados com filtros por auditor, período e cliente"
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        <CrudFiltros
          campos={[
            { key: 'auditorId', label: 'Auditor', tipo: 'select', opcoes: auditoresOpcoes },
            { key: 'clienteId', label: 'Cliente', tipo: 'select', opcoes: clientesOpcoes },
            { key: 'dataInicio', label: 'Data início', tipo: 'date' },
            { key: 'dataFim', label: 'Data fim', tipo: 'date' },
          ]}
          valoresIniciais={FILTROS_INICIAIS}
          onPesquisar={(filtros) => {
            void carregarCheckins(filtros);
            setIsPesquisado(true);
          }}
          onLimpar={() => {
            setCheckins([]);
            setIsPesquisado(false);
          }}
        />

        {!isPesquisado && !loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center text-center py-12">
              <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-base-content/40" />
              </div>
              <h3 className="text-lg font-semibold text-base-content font-display">
                Realize uma pesquisa
              </h3>
              <p className="text-sm text-base-content/60 max-w-xs">
                Use os filtros acima para buscar checkins realizados.
              </p>
            </div>
          </div>
        ) : (
          <CrudTable
            colunas={colunas}
            dados={checkins}
            acoes={acoes}
            keyExtractor={(c) => c.id}
            loading={loading}
            emptyState={{
              icon: Clock3,
              title: 'Nenhum checkin encontrado',
              description: 'Ajuste os filtros para visualizar os checkins realizados.',
            }}
          />
        )}
      </div>

      {isDetalheAberto && detalheCheckin && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsDetalheAberto(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-base-300 bg-base-100 shadow-2xl">
            <div className="border-b border-base-300 px-6 py-4">
              <h3 className="text-lg font-semibold">Detalhes do Checkin</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-5 text-sm">
              <div><strong>Cliente:</strong> {detalheCheckin.cliente?.nomeFantasia || detalheCheckin.cliente?.razaoSocial || '-'}</div>
              <div><strong>Unidade:</strong> {detalheCheckin.unidade?.nome || '-'}</div>
              <div><strong>Auditor:</strong> {detalheCheckin.usuario?.nome || '-'}</div>
              <div><strong>Status:</strong> {detalheCheckin.status}</div>
              <div><strong>Data do checkin:</strong> {formatarDataHora(detalheCheckin.dataCheckin)}</div>
              <div><strong>Data do checkout:</strong> {formatarDataHora(detalheCheckin.dataCheckout)}</div>
              <div><strong>Latitude checkin:</strong> {detalheCheckin.latitudeCheckin}</div>
              <div><strong>Longitude checkin:</strong> {detalheCheckin.longitudeCheckin}</div>
              <div><strong>Latitude checkout:</strong> {detalheCheckin.latitudeCheckout ?? '-'}</div>
              <div><strong>Longitude checkout:</strong> {detalheCheckin.longitudeCheckout ?? '-'}</div>
              <div className="md:col-span-2">
                <strong>Duração:</strong> {formatarDuracao(detalheCheckin.dataCheckin, detalheCheckin.dataCheckout)}
              </div>
            </div>
            <div className="border-t border-base-300 px-6 py-4 flex justify-end">
              <button className="btn btn-ghost" onClick={() => setIsDetalheAberto(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
