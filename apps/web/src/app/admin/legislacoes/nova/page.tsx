'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { AppLayout, PageHeader } from '@/components';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { SemPermissaoLegislacoes } from '@/components/legislacao/sem-permissao';
import { legislacaoService } from '@/lib/api';
import { mensagemDoErro } from '@/lib/legislacao/leitura';
import { resetarOpcoesLegislacao } from '@/lib/legislacao/use-opcoes-legislacao';
import { toastService } from '@/lib/toast';

interface ErroApi {
  response?: { status?: number; data?: { message?: string | string[]; id?: string } };
}

/**
 * Cadastro de legislação: só o link e o título; o sistema lê a página e preenche o resto.
 */
export default function NovaLegislacaoPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [linkOficial, setLinkOficial] = useState('');
  const [titulo, setTitulo] = useState('');
  const [informacoes, setInformacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [idExistente, setIdExistente] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdExistente(null);
    if (!linkOficial.trim() || !titulo.trim()) {
      toastService.warning('Preencha o link e o título.');
      return;
    }
    if (!/^https?:\/\//i.test(linkOficial.trim())) {
      toastService.warning('O link deve começar com http:// ou https://.');
      return;
    }
    try {
      setSalvando(true);
      const legislacao = await legislacaoService.criar({
        linkOficial: linkOficial.trim(),
        titulo: titulo.trim(),
        ...(informacoes.trim() ? { informacoes: informacoes.trim() } : {}),
      });
      resetarOpcoesLegislacao();
      router.push(`/admin/legislacoes/${legislacao.id}`);
    } catch (error) {
      const { response } = error as ErroApi;
      if (response?.status === 409 && response.data?.id) {
        setIdExistente(response.data.id);
      } else if (response?.status === 409) {
        toastService.error('Esta legislação já está cadastrada.');
      } else if (response?.status === 403) {
        setSemPermissao(true);
      } else {
        // o interceptor não exibe erros das telas de legislação
        toastService.error(mensagemDoErro(error));
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Nova legislação" backHref="/admin/legislacoes" />

      {semPermissao ? (
        <SemPermissaoLegislacoes />
      ) : (
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5 px-4 py-4 lg:px-8">
          <div className="space-y-2">
            <Label htmlFor="linkOficial">Link oficial *</Label>
            <Input
              id="linkOficial"
              type="url"
              inputMode="url"
              value={linkOficial}
              onChange={(e) => {
                setLinkOficial(e.target.value);
                setIdExistente(null);
              }}
              placeholder="https://..."
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">O sistema lê a página e preenche o resto.</p>
            {idExistente && (
              <p role="alert" className="text-sm text-destructive">
                Esta legislação já está cadastrada.{' '}
                <Link href={`/admin/legislacoes/${idExistente}`} className="font-medium underline">
                  Abrir a existente
                </Link>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Boas práticas para serviços de alimentação"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="informacoes">Informações (opcional)</Label>
            <Textarea
              id="informacoes"
              value={informacoes}
              onChange={(e) => setInformacoes(e.target.value)}
              rows={4}
              placeholder="Observações para quem for usar esta legislação"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" asChild>
              <Link href="/admin/legislacoes">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      )}
    </AppLayout>
  );
}
