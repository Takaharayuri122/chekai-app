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

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function filtrarItensBusca(itens: ItemNavegacao[], termo: string): ItemNavegacao[] {
  const t = normalizar(termo);
  if (!t) return itens;
  return itens.filter((i) => normalizar(i.label).includes(t));
}
