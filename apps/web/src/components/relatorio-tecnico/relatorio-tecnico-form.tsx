'use client';

import { useEffect, useMemo, useState } from 'react';
import { Camera, Plus, Sparkles, Trash2, X } from 'lucide-react';
import {
  clienteService,
  type Cliente,
  type CriarRelatorioTecnicoRequest,
  relatorioTecnicoService,
  type Unidade,
} from '@/lib/api';
import { toastService } from '@/lib/toast';
import { EditorRichTextBasico } from '@/components/ui/editor-richtext-basico';
import { AssinaturaRelatorio } from '@/components/ui/assinatura-relatorio';

export interface RelatorioTecnicoFormData extends CriarRelatorioTecnicoRequest {
  apoioAnaliticoChekAi?: string;
  fotos?: Array<{
    id: string;
    url: string;
  }>;
}

interface RelatorioTecnicoFormProps {
  relatorioId?: string;
  valor: RelatorioTecnicoFormData;
  onChange: (valor: RelatorioTecnicoFormData) => void;
  somenteLeitura?: boolean;
  onApoioAnaliticoGerado?: (texto: string) => void;
}

export function RelatorioTecnicoForm({
  relatorioId,
  valor,
  onChange,
  somenteLeitura = false,
  onApoioAnaliticoGerado,
}: RelatorioTecnicoFormProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState<boolean>(true);
  const [novaAcao, setNovaAcao] = useState<string>('');
  const [gerandoApoioAnalitico, setGerandoApoioAnalitico] = useState<boolean>(false);
  const [enviandoFoto, setEnviandoFoto] = useState<boolean>(false);

  useEffect(() => {
    async function carregarClientes(): Promise<void> {
      try {
        const response = await clienteService.listar(1, 200);
        setClientes(response.items || []);
      } finally {
        setLoadingClientes(false);
      }
    }
    void carregarClientes();
  }, []);

  const unidadesDoCliente: Unidade[] = useMemo(() => {
    const cliente = clientes.find((item) => item.id === valor.clienteId);
    return cliente?.unidades || [];
  }, [clientes, valor.clienteId]);

  const atualizarCampo = <K extends keyof RelatorioTecnicoFormData>(
    campo: K,
    novoValor: RelatorioTecnicoFormData[K],
  ): void => {
    onChange({
      ...valor,
      [campo]: novoValor,
    });
  };

  const adicionarAcao = (): void => {
    const texto = novaAcao.trim();
    if (!texto) {
      return;
    }
    atualizarCampo('acoesExecutadas', [...valor.acoesExecutadas, texto]);
    setNovaAcao('');
  };

  const removerAcao = (index: number): void => {
    atualizarCampo(
      'acoesExecutadas',
      valor.acoesExecutadas.filter((_, idx) => idx !== index),
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="form-control">
          <label className="label py-0">
            <span className="label-text font-medium">Cliente</span>
          </label>
          <select
            className="select select-bordered"
            value={valor.clienteId}
            disabled={somenteLeitura || loadingClientes}
            onChange={(event) => {
              const clienteId = event.target.value;
              onChange({
                ...valor,
                clienteId,
                unidadeId: '',
              });
            }}
          >
            <option value="">Selecione o cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nomeFantasia || cliente.razaoSocial}
              </option>
            ))}
          </select>
        </div>
        <div className="form-control">
          <label className="label py-0">
            <span className="label-text font-medium">Unidade (opcional)</span>
          </label>
          <select
            className="select select-bordered"
            value={valor.unidadeId || ''}
            disabled={somenteLeitura || !valor.clienteId}
            onChange={(event) => atualizarCampo('unidadeId', event.target.value)}
          >
            <option value="">Selecione a unidade</option>
            {unidadesDoCliente.map((unidade) => (
              <option key={unidade.id} value={unidade.id}>
                {unidade.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-control">
        <label className="label py-0">
          <span className="label-text font-medium">Identificação</span>
        </label>
        <input
          type="text"
          className="input input-bordered"
          placeholder="Ex.: setorial/estrutural"
          value={valor.identificacao}
          disabled={somenteLeitura}
          onChange={(event) => atualizarCampo('identificacao', event.target.value)}
        />
      </div>

      <EditorRichTextBasico label="Descrição da ocorrência" value={valor.descricaoOcorrenciaHtml} onChange={(html) => atualizarCampo('descricaoOcorrenciaHtml', html)} required />

      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Evidências fotográficas</h3>
            <label className={`btn btn-sm btn-outline gap-2 ${!relatorioId || somenteLeitura ? 'btn-disabled' : ''}`}>
              <Camera className="w-4 h-4" />
              {enviandoFoto ? 'Enviando...' : 'Adicionar foto'}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                disabled={!relatorioId || somenteLeitura || enviandoFoto}
                onChange={async (event) => {
                  if (!relatorioId || !event.target.files?.length) {
                    return;
                  }
                  const file = event.target.files[0];
                  setEnviandoFoto(true);
                  try {
                    await relatorioTecnicoService.adicionarFoto(relatorioId, file);
                    const relatorioAtualizado = await relatorioTecnicoService.buscarPorId(relatorioId);
                    onChange({
                      ...valor,
                      apoioAnaliticoChekAi: relatorioAtualizado.apoioAnaliticoChekAi || '',
                    });
                    toastService.success('Foto enviada com sucesso.');
                  } catch {
                    // Erro tratado por interceptor
                  } finally {
                    setEnviandoFoto(false);
                    event.target.value = '';
                  }
                }}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            {valor.fotos?.map((foto) => (
              <div key={foto.id} className="relative aspect-square rounded-lg overflow-hidden border border-base-300">
                <img src={foto.url} alt="Evidência" className="w-full h-full object-cover" />
                {!somenteLeitura && relatorioId ? (
                  <button
                    type="button"
                    className="btn btn-circle btn-xs btn-error absolute top-1 right-1"
                    onClick={async () => {
                      try {
                        await relatorioTecnicoService.removerFoto(relatorioId, foto.id);
                        const relatorioAtualizado = await relatorioTecnicoService.buscarPorId(relatorioId);
                        onChange({
                          ...valor,
                          apoioAnaliticoChekAi: relatorioAtualizado.apoioAnaliticoChekAi || '',
                        });
                        toastService.success('Foto removida com sucesso.');
                      } catch {
                        // Erro tratado por interceptor
                      }
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {valor.fotos?.length ? null : (
            <p className="text-sm text-base-content/60 mt-2">Nenhuma evidência adicionada.</p>
          )}
        </div>
      </div>

      <EditorRichTextBasico
        label="Avaliação técnica"
        value={valor.avaliacaoTecnicaHtml}
        onChange={(html) => atualizarCampo('avaliacaoTecnicaHtml', html)}
        required
      />

      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-4">
          <h3 className="font-semibold">Ações executadas na visita</h3>
          <div className="join w-full mt-3">
            <input
              type="text"
              className="input input-bordered join-item w-full"
              value={novaAcao}
              disabled={somenteLeitura}
              placeholder="Adicionar ação executada"
              onChange={(event) => setNovaAcao(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary join-item"
              onClick={adicionarAcao}
              disabled={somenteLeitura}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 mt-3">
            {valor.acoesExecutadas.map((acao, index) => (
              <div key={`${acao}-${index}`} className="flex items-center justify-between rounded-lg border border-base-300 p-2 text-sm">
                <span>{acao}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error"
                  onClick={() => removerAcao(index)}
                  disabled={somenteLeitura}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <EditorRichTextBasico
        label="Recomendações da consultora"
        value={valor.recomendacoesConsultoraHtml}
        onChange={(html) => atualizarCampo('recomendacoesConsultoraHtml', html)}
        required
      />

      <EditorRichTextBasico
        label="Plano de ação sugerido"
        value={valor.planoAcaoSugeridoHtml}
        onChange={(html) => atualizarCampo('planoAcaoSugeridoHtml', html)}
        required
      />

      <div className="form-control">
        <label className="label py-0">
          <span className="label-text font-medium">Apoio analítico ChekAi</span>
        </label>
        <div className="flex justify-end mb-2">
          <button
            type="button"
            className={`btn btn-sm btn-primary gap-2 ${!relatorioId || somenteLeitura ? 'btn-disabled' : ''}`}
            disabled={!relatorioId || somenteLeitura || gerandoApoioAnalitico}
            onClick={async () => {
              if (!relatorioId) {
                return;
              }
              setGerandoApoioAnalitico(true);
              try {
                const relatorioAtualizado = await relatorioTecnicoService.gerarApoioAnalitico(relatorioId);
                const apoio = relatorioAtualizado.apoioAnaliticoChekAi || '';
                atualizarCampo('apoioAnaliticoChekAi', apoio);
                if (onApoioAnaliticoGerado) {
                  onApoioAnaliticoGerado(apoio);
                }
                toastService.success('Apoio analítico gerado com sucesso.');
              } catch {
                // Erro tratado por interceptor
              } finally {
                setGerandoApoioAnalitico(false);
              }
            }}
          >
            <Sparkles className="w-4 h-4" />
            {gerandoApoioAnalitico ? 'Gerando...' : 'Gerar apoio analítico'}
          </button>
        </div>
        <textarea
          className="textarea textarea-bordered min-h-[120px]"
          value={valor.apoioAnaliticoChekAi || ''}
          onChange={(event) => atualizarCampo('apoioAnaliticoChekAi', event.target.value)}
          disabled={somenteLeitura}
          placeholder="Será gerado com IA após preenchimento completo"
        />
      </div>

      <AssinaturaRelatorio
        nomeConsultora={valor.assinaturaNomeConsultora || ''}
        onChangeNomeConsultora={(nome) => atualizarCampo('assinaturaNomeConsultora', nome)}
      />
    </div>
  );
}
