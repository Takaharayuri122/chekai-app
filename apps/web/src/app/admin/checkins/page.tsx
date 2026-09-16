'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Clock3, Edit, Eye, Filter, MapPin } from 'lucide-react';
import Link from 'next/link';
import {
  AppLayout,
  EmptyState,
  FormModal,
  PageHeader,
  CrudFiltros,
  CrudTable,
  type ColunaTabela,
  type AcaoTabela,
} from '@/components';
import { PerfilUsuario } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';
import { checkinService, CheckinRegistro, EditarCheckinRequest } from '@/lib/services/checkin.service';
import { CheckinMapa, type PontoCheckinMapa } from '@/components/checkin/checkin-mapa';
import { CheckinEditarModal } from '@/components/checkin/checkin-editar-modal';

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

function formatarFim(dataCheckin: string, dataCheckout?: string | null): string {
  if (!dataCheckout) return '-';
  const inicio = new Date(dataCheckin);
  const fim = new Date(dataCheckout);
  const mesmoDia = inicio.toDateString() === fim.toDateString();
  if (mesmoDia) {
    return fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return formatarDataHora(dataCheckout);
}

function formatarDuracao(dataCheckin: string, dataCheckout?: string | null): string {
  const inicio = new Date(dataCheckin).getTime();
  const fim = dataCheckout ? new Date(dataCheckout).getTime() : Date.now();
  const diferenca = Math.max(fim - inicio, 0);
  const horas = Math.floor(diferenca / (1000 * 60 * 60));
  const minutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));
  return `${horas}h ${minutos}min`;
}

function numeroCoord(valor?: number | string | null): number | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
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
    label: 'Início',
    render: (c) => (
      <span className="text-sm text-base-content/70 tabular-nums">
        {formatarDataHora(c.dataCheckin)}
      </span>
    ),
  },
  {
    label: 'Fim',
    render: (c) => (
      <span className="text-sm text-base-content/70 tabular-nums">
        {formatarFim(c.dataCheckin, c.dataCheckout)}
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
      <span className="flex flex-col items-start gap-1">
        <span className={`badge badge-sm ${c.status === 'aberto' ? 'badge-warning' : 'badge-success'}`}>
          {c.status === 'aberto' ? 'Aberto' : 'Fechado'}
        </span>
        {c.encerradoAutomaticamente ? (
          <span className="badge badge-sm badge-ghost">Auto</span>
        ) : null}
      </span>
    ),
  },
];

export default function CheckinsPage() {
  const { usuario } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [checkins, setCheckins] = useState<CheckinRegistro[]>([]);
  const [auditoresOpcoes, setAuditoresOpcoes] = useState<Array<{ value: string; label: string }>>([]);
  const [clientesOpcoes, setClientesOpcoes] = useState<Array<{ value: string; label: string }>>([]);
  const [detalheCheckin, setDetalheCheckin] = useState<CheckinRegistro | null>(null);
  const [isDetalheAberto, setIsDetalheAberto] = useState(false);
  const [edicaoCheckin, setEdicaoCheckin] = useState<CheckinRegistro | null>(null);
  const [isEdicaoAberta, setIsEdicaoAberta] = useState(false);
  const [ultimoFiltro, setUltimoFiltro] = useState<FiltrosCheckin>(FILTROS_INICIAIS);

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

  const carregarCheckins = async (filtros: FiltrosCheckin, limite = 20): Promise<void> => {
    setLoading(true);
    setUltimoFiltro(filtros);
    try {
      const resposta = await checkinService.listar({
        page: 1,
        limit: limite,
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

  const handleEditar = async (checkin: CheckinRegistro): Promise<void> => {
    const detalhe = await checkinService.buscarPorId(checkin.id);
    setEdicaoCheckin(detalhe);
    setIsEdicaoAberta(true);
  };

  const handleSalvarEdicao = async (dados: {
    dataCheckin: string;
    dataCheckout: string | null;
    comentario: string;
  }): Promise<void> => {
    if (!edicaoCheckin) {
      return;
    }
    const payload: EditarCheckinRequest = {
      dataCheckin: dados.dataCheckin,
      comentario: dados.comentario,
    };
    if (dados.dataCheckout) {
      payload.dataCheckout = dados.dataCheckout;
    } else if (edicaoCheckin.status === 'fechado') {
      toastService.warning('Não é possível reabrir um check-in já finalizado.');
      return;
    }
    setSalvando(true);
    try {
      await checkinService.editar(edicaoCheckin.id, payload);
      toastService.success('Check-in atualizado.');
      setIsEdicaoAberta(false);
      setEdicaoCheckin(null);
      await carregarCheckins(ultimoFiltro, 20);
    } finally {
      setSalvando(false);
    }
  };

  const acoes: AcaoTabela<CheckinRegistro>[] = [
    { label: 'Visualizar', icon: Eye, onClick: (c) => { void handleVisualizar(c); } },
    { label: 'Editar', icon: Edit, onClick: (c) => { void handleEditar(c); } },
  ];

  const pontosMapa: PontoCheckinMapa[] = useMemo(() => {
    if (!detalheCheckin) {
      return [];
    }
    const pontos: PontoCheckinMapa[] = [];
    const latIn = numeroCoord(detalheCheckin.latitudeCheckin);
    const lngIn = numeroCoord(detalheCheckin.longitudeCheckin);
    if (latIn !== null && lngIn !== null) {
      pontos.push({
        latitude: latIn,
        longitude: lngIn,
        titulo: 'Check-in',
        descricao: formatarDataHora(detalheCheckin.dataCheckin),
        cor: '#16a34a',
      });
    }
    const latOut = numeroCoord(detalheCheckin.latitudeCheckout);
    const lngOut = numeroCoord(detalheCheckin.longitudeCheckout);
    if (latOut !== null && lngOut !== null) {
      pontos.push({
        latitude: latOut,
        longitude: lngOut,
        titulo: 'Checkout',
        descricao: formatarDataHora(detalheCheckin.dataCheckout),
        cor: '#dc2626',
      });
    }
    return pontos;
  }, [detalheCheckin]);

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
        action={(
          <Link href="/admin/checkins/relatorio" className="btn btn-primary btn-sm gap-2">
            <BarChart3 className="w-4 h-4" />
            Relatório de horas
          </Link>
        )}
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
            void carregarCheckins(filtros, 200);
          }}
          onLimpar={() => {
            void carregarCheckins(FILTROS_INICIAIS, 20);
          }}
        />

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
      </div>

      <FormModal
        open={isDetalheAberto}
        onClose={() => setIsDetalheAberto(false)}
        title="Detalhes do Checkin"
        maxWidth="3xl"
        footer={(
          <button className="btn btn-ghost" onClick={() => setIsDetalheAberto(false)}>
            Fechar
          </button>
        )}
      >
        {detalheCheckin && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong>Cliente:</strong> {detalheCheckin.cliente?.nomeFantasia || detalheCheckin.cliente?.razaoSocial || '-'}</div>
              <div><strong>Unidade:</strong> {detalheCheckin.unidade?.nome || '-'}</div>
              <div><strong>Auditor:</strong> {detalheCheckin.usuario?.nome || '-'}</div>
              <div>
                <strong>Status:</strong>{' '}
                {detalheCheckin.status === 'aberto' ? 'Aberto' : 'Fechado'}
                {detalheCheckin.encerradoAutomaticamente ? ' · encerrado automaticamente' : ''}
              </div>
              <div><strong>Início:</strong> {formatarDataHora(detalheCheckin.dataCheckin)}</div>
              <div><strong>Fim:</strong> {formatarDataHora(detalheCheckin.dataCheckout)}</div>
              <div className="md:col-span-2">
                <strong>Duração:</strong> {formatarDuracao(detalheCheckin.dataCheckin, detalheCheckin.dataCheckout)}
              </div>
              <div className="md:col-span-2">
                <strong>Comentário:</strong> {detalheCheckin.comentario || '-'}
              </div>
            </div>
            <CheckinMapa pontos={pontosMapa} />
          </div>
        )}
      </FormModal>

      <CheckinEditarModal
        open={isEdicaoAberta}
        checkin={edicaoCheckin}
        salvando={salvando}
        onClose={() => {
          setIsEdicaoAberta(false);
        }}
        onSalvar={handleSalvarEdicao}
      />
    </AppLayout>
  );
}
