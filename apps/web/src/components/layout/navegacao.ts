import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  Clock3,
  Coins,
  FileText,
  Home,
  ListChecks,
  Package,
  Settings,
  TrendingUp,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { PerfilUsuario } from '@/lib/store';
import type { Auditoria } from '@/lib/api';

export interface ItemNavegacao {
  href: string;
  label: string;
  icon: LucideIcon;
  perfis: PerfilUsuario[];
}

export interface GrupoNavegacao {
  id: 'inicio' | 'operacao' | 'gestao' | 'administracao';
  titulo: string | null;
  itens: ItemNavegacao[];
}

export const HREF_NOVA_AUDITORIA = '/admin/auditoria/nova';

const { AUDITOR, GESTOR, MASTER } = PerfilUsuario;

/** O atalho global some quando a própria tela já oferece "Nova auditoria". */
export function mostrarAtalhoNovaAuditoria(pathname: string, perfil: PerfilUsuario): boolean {
  if (pathname === '/admin/auditorias' || pathname.startsWith(HREF_NOVA_AUDITORIA)) return false;
  if (pathname === '/admin/dashboard' && perfil === AUDITOR) return false;
  return true;
}
const TODOS = [AUDITOR, GESTOR, MASTER];
const GESTAO = [GESTOR, MASTER];
const SO_MASTER = [MASTER];

const INICIO: ItemNavegacao = { href: '/admin/dashboard', label: 'Início', icon: Home, perfis: TODOS };
const AUDITORIAS: ItemNavegacao = { href: '/admin/auditorias', label: 'Auditorias', icon: ClipboardCheck, perfis: TODOS };
const AGENDA: ItemNavegacao = { href: '/admin/agenda', label: 'Agenda', icon: CalendarClock, perfis: TODOS };
const PLANOS_ACAO: ItemNavegacao = { href: '/admin/planos-acao', label: 'Planos de ação', icon: ListChecks, perfis: TODOS };

const GRUPOS: GrupoNavegacao[] = [
  { id: 'inicio', titulo: null, itens: [INICIO] },
  {
    id: 'operacao',
    titulo: 'Operação',
    itens: [
      AUDITORIAS,
      AGENDA,
      PLANOS_ACAO,
      { href: '/admin/relatorios-tecnicos', label: 'Relatórios técnicos', icon: ClipboardPen, perfis: TODOS },
      { href: '/admin/checkins', label: 'Check-ins', icon: Clock3, perfis: GESTAO },
    ],
  },
  {
    id: 'gestao',
    titulo: 'Gestão',
    itens: [
      { href: '/admin/clientes', label: 'Clientes', icon: Building2, perfis: GESTAO },
      { href: '/admin/templates', label: 'Checklists', icon: FileText, perfis: GESTAO },
      { href: '/admin/usuarios', label: 'Equipe', icon: Users, perfis: GESTAO },
      { href: '/admin/legislacoes', label: 'Legislações', icon: BookOpen, perfis: SO_MASTER },
    ],
  },
  {
    id: 'administracao',
    titulo: 'Administração',
    itens: [
      { href: '/admin/lista-espera', label: 'Lista de espera', icon: ClipboardList, perfis: SO_MASTER },
      { href: '/admin/planos', label: 'Planos', icon: Package, perfis: SO_MASTER },
      { href: '/admin/planos/assinaturas', label: 'Assinaturas', icon: UserCheck, perfis: SO_MASTER },
      { href: '/admin/configuracoes-credito', label: 'Créditos', icon: Settings, perfis: SO_MASTER },
      { href: '/admin/auditoria-tokens', label: 'Consumo de IA', icon: BarChart3, perfis: SO_MASTER },
    ],
  },
];

const CONTA: ItemNavegacao[] = [
  { href: '/admin/perfil', label: 'Meu perfil', icon: User, perfis: TODOS },
  { href: '/admin/gestor/limites', label: 'Meus limites', icon: TrendingUp, perfis: [GESTOR] },
  { href: '/admin/gestor/creditos', label: 'Meus créditos', icon: Coins, perfis: [GESTOR] },
];

/** Rotas cujas subpáginas pertencem a outro item do menu (ex.: execução pertence a "Auditorias"). */
const ROTAS_RELACIONADAS: Record<string, string[]> = {
  '/admin/auditorias': ['/admin/auditoria'],
};

export function getGruposNavegacao(perfil: PerfilUsuario): GrupoNavegacao[] {
  return GRUPOS.map((grupo) => ({ ...grupo, itens: grupo.itens.filter((i) => i.perfis.includes(perfil)) })).filter(
    (grupo) => grupo.itens.length > 0,
  );
}

export function getItensConta(perfil: PerfilUsuario): ItemNavegacao[] {
  return CONTA.filter((i) => i.perfis.includes(perfil));
}

export function getBarraInferior(perfil: PerfilUsuario): ItemNavegacao[] {
  return [INICIO, AUDITORIAS, perfil === AUDITOR ? AGENDA : PLANOS_ACAO];
}

export function getItensMais(perfil: PerfilUsuario): ItemNavegacao[] {
  const naBarra = new Set(getBarraInferior(perfil).map((i) => i.href));
  const navegacao = getGruposNavegacao(perfil).flatMap((g) => g.itens);
  return [...navegacao, ...getItensConta(perfil)].filter((i) => !naBarra.has(i.href));
}

function casa(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isRotaAtiva(pathname: string, href: string): boolean {
  if (casa(pathname, href)) return true;
  if (pathname === HREF_NOVA_AUDITORIA) return false;
  return (ROTAS_RELACIONADAS[href] ?? []).some((base) => casa(pathname, base));
}

/** Entre os itens que casam com a rota, retorna o mais específico (evita "Planos" e "Assinaturas" ativos juntos). */
export function getHrefAtivo(pathname: string, itens: ItemNavegacao[]): string | null {
  const candidatos = itens.filter((i) => isRotaAtiva(pathname, i.href));
  if (candidatos.length === 0) return null;
  const diretos = candidatos.filter((i) => casa(pathname, i.href)).sort((a, b) => b.href.length - a.href.length);
  return (diretos[0] ?? candidatos[0]).href;
}

export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Filtro da busca global (assinatura do cmdk): 1 casa, 0 não casa; ignora acentos e maiúsculas. */
export function filtroBusca(valor: string, termo: string): number {
  return normalizar(valor).includes(normalizar(termo)) ? 1 : 0;
}

export function filtrarItensBusca(itens: ItemNavegacao[], termo: string): ItemNavegacao[] {
  if (!normalizar(termo)) return itens;
  return itens.filter((i) => filtroBusca(i.label, termo) === 1);
}


export interface ResultadoBusca {
  id: string;
  titulo: string;
  detalhe: string;
  href: string;
  termos: string;
}

export function itensBuscaAuditorias(lista: Auditoria[]): ResultadoBusca[] {
  return lista.map((a) => {
    const cliente = a.unidade?.cliente?.nomeFantasia || a.unidade?.cliente?.razaoSocial || '';
    const data = new Date(a.dataInicio).toLocaleDateString('pt-BR');
    return {
      id: a.id,
      titulo: a.unidade?.nome ?? 'Auditoria',
      detalhe: [cliente, a.template?.nome, data].filter(Boolean).join(' · '),
      href: a.status === 'finalizada' ? `/admin/auditoria/${a.id}/relatorio` : `/admin/auditoria/${a.id}`,
      termos: [a.unidade?.nome, cliente, a.template?.nome, data].filter(Boolean).join(' '),
    };
  });
}
