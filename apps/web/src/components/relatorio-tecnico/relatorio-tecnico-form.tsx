'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
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
interface FotoPendente {
  localId: string;
  preview: string;
}

interface RelatorioTecnicoFormProps {
  relatorioId?: string;
  valor: RelatorioTecnicoFormData;
  onChange: (valor: RelatorioTecnicoFormData) => void;
  somenteLeitura?: boolean;
  onApoioAnaliticoGerado?: (texto: string) => void;
  onAntesGerarApoioAnalitico?: () => Promise<boolean>;
  nomeConsultoraLogada?: string;
}

export function RelatorioTecnicoForm({
  relatorioId,
  valor,
  onChange,
  somenteLeitura = false,
  onApoioAnaliticoGerado,
  onAntesGerarApoioAnalitico,
  nomeConsultoraLogada = '',
}: RelatorioTecnicoFormProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState<boolean>(true);
  const [novaAcao, setNovaAcao] = useState<string>('');
  const [gerandoApoioAnalitico, setGerandoApoioAnalitico] = useState<boolean>(false);
  const [enviandoFoto, setEnviandoFoto] = useState<boolean>(false);
  const [fotosPendentes, setFotosPendentes] = useState<FotoPendente[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FOTOS = 5;

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

  const atualizarCampo = <K extends keyof RelatorioTecnicoFormData,>(
    campo: K,
    novoValor: RelatorioTecnicoFormData[K],
  ): void => {
    onChange({
      ...valor,
      [campo]: novoValor,
    });
  };
  useEffect(() => {
    if (!nomeConsultoraLogada || valor.assinaturaNomeConsultora === nomeConsultoraLogada) {
      return;
    }
    onChange({
      ...valor,
      assinaturaNomeConsultora: nomeConsultoraLogada,
    });
  }, [nomeConsultoraLogada, onChange, valor]);

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

  const blocosApoioAnalitico = useMemo(() => {
    const texto = (valor.apoioAnaliticoChekAi || '').trim();
    if (!texto) {
      return [];
    }
    return texto
      .split(/\n{2,}/)
      .map((bloco) => bloco.trim())
      .filter(Boolean)
      .map((bloco) => {
        const linhas = bloco.split('\n').map((linha) => linha.trim()).filter(Boolean);
        if (!linhas.length) {
          return null;
        }
        const primeiraLinha = linhas[0];
        const tituloMatch = primeiraLinha.match(/^\*\*(.+?)\*\*:?\s*$/) || primeiraLinha.match(/^(.+):$/);
        if (tituloMatch) {
          const titulo = tituloMatch[1].trim();
          const corpo = linhas.slice(1);
          return { titulo, linhas: corpo.length ? corpo : ['Sem detalhes adicionais.'] };
        }
        return { titulo: '', linhas };
      })
      .filter((item): item is { titulo: string; linhas: string[] } => Boolean(item));
  }, [valor.apoioAnaliticoChekAi]);

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
          <h3 className="font-semibold">Evidências fotográficas</h3>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            multiple
            disabled={!relatorioId || somenteLeitura || enviandoFoto}
            onChange={async (event) => {
              if (!relatorioId || !event.target.files?.length) {
                return;
              }
              const atuais = (valor.fotos?.length || 0) + fotosPendentes.length;
              const vagas = MAX_FOTOS - atuais;
              const selecionadas = Array.from(event.target.files).slice(0, vagas);
              if (selecionadas.length === 0) {
                toastService.warning(`Máximo de ${MAX_FOTOS} fotos por relatório.`);
                event.target.value = '';
                return;
              }
              if (event.target.files.length > vagas) {
                toastService.warning(`Foram selecionadas muitas fotos. Apenas ${vagas} serão enviadas agora.`);
              }
              const pendentesSelecionadas = selecionadas.map((file) => ({
                file,
                localId: `preview-${crypto.randomUUID()}`,
                preview: URL.createObjectURL(file),
              }));
              setFotosPendentes((prev) => [
                ...prev,
                ...pendentesSelecionadas.map(({ localId, preview }) => ({ localId, preview })),
              ]);
              setEnviandoFoto(true);
              try {
                for (const fotoSelecionada of pendentesSelecionadas) {
                  const { file, localId } = fotoSelecionada;
                  await relatorioTecnicoService.adicionarFoto(relatorioId, file);
                  setFotosPendentes((prev) => prev.filter((item) => item.localId !== localId));
                }
                const relatorioAtualizado = await relatorioTecnicoService.buscarPorId(relatorioId);
                onChange({
                  ...valor,
                  apoioAnaliticoChekAi: relatorioAtualizado.apoioAnaliticoChekAi || '',
                  fotos: relatorioAtualizado.fotos || [],
                });
                toastService.success('Fotos enviadas com sucesso.');
              } catch {
                // Erro tratado por interceptor
              } finally {
                setFotosPendentes([]);
                setEnviandoFoto(false);
                event.target.value = '';
              }
            }}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            {fotosPendentes.map((foto) => (
              <div key={foto.localId} className="relative aspect-square rounded-lg overflow-hidden border border-base-300">
                <img src={foto.preview} alt="Evidência em envio" className="w-full h-full object-cover grayscale blur-sm opacity-70" />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1 text-white">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">Enviando...</span>
                  </div>
                </div>
              </div>
            ))}
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
                          fotos: relatorioAtualizado.fotos || [],
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
          {(valor.fotos?.length || 0) + fotosPendentes.length < MAX_FOTOS && !somenteLeitura ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-full mt-3 h-20 border-2 border-dashed border-base-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors ${!relatorioId || enviandoFoto ? 'opacity-60 pointer-events-none' : ''}`}
              disabled={!relatorioId || enviandoFoto}
            >
              <Camera className="w-6 h-6 text-base-content/40" />
              <span className="text-sm text-base-content/60">
                Clique para adicionar fotos (até {MAX_FOTOS} • máx. 5MB cada)
              </span>
            </button>
          ) : null}
          {(valor.fotos?.length || 0) === 0 && fotosPendentes.length === 0 ? (
            <p className="text-sm text-base-content/60 mt-2">Nenhuma evidência adicionada.</p>
          ) : null}
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
              if (onAntesGerarApoioAnalitico) {
                const sucessoSync = await onAntesGerarApoioAnalitico();
                if (!sucessoSync) {
                  toastService.warning('Não foi possível sincronizar o relatório antes de gerar o apoio analítico.');
                  return;
                }
              }
              const completo =
                Boolean(valor.identificacao?.trim()) &&
                Boolean(valor.descricaoOcorrenciaHtml?.trim()) &&
                Boolean(valor.avaliacaoTecnicaHtml?.trim()) &&
                Boolean(valor.recomendacoesConsultoraHtml?.trim()) &&
                Boolean(valor.planoAcaoSugeridoHtml?.trim()) &&
                Boolean(valor.acoesExecutadas?.length);
              if (!completo) {
                toastService.warning('Preencha todo o relatório antes de gerar o apoio analítico.');
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
        {blocosApoioAnalitico.length > 0 ? (
          <div className="space-y-3">
            {blocosApoioAnalitico.map((bloco, index) => (
              <div key={`${bloco.titulo}-${index}`} className="alert alert-info">
                <div className="flex-1 space-y-1">
                  {bloco.titulo ? <p className="font-semibold">{bloco.titulo}</p> : null}
                  {bloco.linhas.map((linha, linhaIndex) => (
                    <p key={`${index}-${linhaIndex}`} className="text-sm">
                      {linha.replace(/^-\s*/, '• ')}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <textarea
            className="textarea textarea-bordered min-h-[120px]"
            value={valor.apoioAnaliticoChekAi || ''}
            readOnly
            disabled
            placeholder="Campo somente leitura, gerado automaticamente pela IA"
          />
        )}
      </div>

      <AssinaturaRelatorio
        nomeConsultora={nomeConsultoraLogada || valor.assinaturaNomeConsultora || ''}
      />
    </div>
  );
}
