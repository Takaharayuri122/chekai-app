'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormModal } from '@/components/ui/form-modal';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { auditoriaService } from '@/lib/api';
import { toastService } from '@/lib/toast';
import { interpretarDestinatarios, MAX_DESTINATARIOS } from './cartao-resultado.modelo';

interface EnviarRelatorioModalProps {
  auditoriaId: string;
  emailSugerido?: string;
  onEnviado?: () => void;
}

export function EnviarRelatorioModal({ auditoriaId, emailSugerido = '', onEnviado }: EnviarRelatorioModalProps) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(emailSugerido);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const alterado = texto !== emailSugerido;

  useEffect(() => {
    if (!aberto) {
      setTexto(emailSugerido);
      setErro(null);
      setConfirmandoDescarte(false);
    }
  }, [aberto, emailSugerido]);

  const cancelar = () => {
    if (alterado) setConfirmandoDescarte(true);
    else setAberto(false);
  };

  const enviar = async () => {
    const { emails, erro: erroLista } = interpretarDestinatarios(texto);
    if (erroLista) {
      setErro(erroLista);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const envio = await auditoriaService.enviarRelatorio(auditoriaId, emails);
      if (envio.sucesso) {
        toastService.success('Relatório enviado com sucesso.');
        setAberto(false);
      } else {
        setErro(envio.erro || 'Não foi possível enviar o relatório. Tente novamente.');
        toastService.error('Não foi possível enviar o relatório.');
      }
      onEnviado?.();
    } catch (e: any) {
      const mensagem = e?.response?.data?.message || e?.message || 'Não foi possível enviar o relatório.';
      setErro(Array.isArray(mensagem) ? mensagem.join(' ') : String(mensagem));
      toastService.error('Não foi possível enviar o relatório.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <Mail className="h-4 w-4" />
        <span className="hidden sm:inline">Enviar ao cliente</span>
        <span className="sm:hidden">Enviar</span>
      </Button>
      <FormModal
        open={aberto}
        onClose={() => !enviando && setAberto(false)}
        title="Enviar relatório ao cliente"
        maxWidth="md"
        isDirty={alterado}
        footer={
          <>
            <Button variant="outline" onClick={cancelar} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label htmlFor="destinatarios-relatorio" className="text-sm font-medium">
            Enviar para
          </label>
          <Input
            id="destinatarios-relatorio"
            type="text"
            inputMode="email"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setErro(null);
            }}
            placeholder="cliente@empresa.com"
            disabled={enviando}
          />
          <p className="text-xs text-muted-foreground">
            Separe os e-mails por vírgula (até {MAX_DESTINATARIOS}). O cliente recebe o relatório em PDF.
          </p>
          {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}
        </div>
      </FormModal>
      <ConfirmDialog
        open={confirmandoDescarte}
        onClose={() => setConfirmandoDescarte(false)}
        onConfirm={() => setAberto(false)}
        title="Descartar alterações?"
        message="Você possui alterações não salvas. Se fechar agora, todas as modificações serão perdidas."
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        variant="warning"
      />
    </>
  );
}
