'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  ClipboardCheck,
  Plus,
  Building2,
  User,
  LogOut,
  Menu,
  Home,
  FileText,
  Package,
  Coins,
  TrendingUp,
  UserCheck,
  Settings,
  Shield,
  ChevronDown,
  BarChart3,
} from 'lucide-react';
import { useAuthStore, useTutorialStore, PerfilUsuario } from '@/lib/store';
import { BookOpen } from 'lucide-react';

const allNavItems = [
  { href: '/dashboard', label: 'Início', icon: Home, roles: [PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR] },
  { href: '/auditoria/nova', label: 'Nova', icon: Plus, roles: [PerfilUsuario.AUDITOR] },
  { href: '/clientes', label: 'Clientes', icon: Building2, roles: [PerfilUsuario.MASTER, PerfilUsuario.GESTOR] },
  { href: '/templates', label: 'Checklists', icon: FileText, roles: [PerfilUsuario.MASTER, PerfilUsuario.GESTOR] },
  { href: '/auditorias', label: 'Auditorias', icon: ClipboardCheck, roles: [PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR] },
  { href: '/usuarios', label: 'Usuários', icon: User, roles: [PerfilUsuario.MASTER, PerfilUsuario.GESTOR] },
  { href: '/gestor/limites', label: 'Meus Limites', icon: TrendingUp, roles: [PerfilUsuario.GESTOR] },
  { href: '/gestor/creditos', label: 'Meus Créditos', icon: Coins, roles: [PerfilUsuario.GESTOR] },
];

const administrativoItems = [
  { href: '/planos', label: 'Planos', icon: Package },
  { href: '/planos/assinaturas', label: 'Assinaturas', icon: UserCheck },
  { href: '/configuracoes-credito', label: 'Config Créditos', icon: Settings },
  { href: '/auditoria-tokens', label: 'Auditoria Tokens', icon: BarChart3 },
];

export function Navbar() {
  const pathname = usePathname();
  const { usuario, logout, isMaster, isGestor, isAuditor } = useAuthStore();
  const { iniciarTour } = useTutorialStore();

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const handleVerTutorial = () => {
    if (usuario) {
      iniciarTour(usuario.perfil);
    }
  };

  const getNavItems = () => {
    if (!usuario) return [];
    return allNavItems.filter((item) => item.roles.includes(usuario.perfil));
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Top Navbar - Desktop */}
      <div className="navbar bg-base-100 border-b border-base-300 px-4 lg:px-8 hidden md:flex sticky top-0 z-40">
        <div className="flex-1">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/images/logo-large.png"
              alt="ChekAI"
              width={180}
              height={30}
              className="h-12 w-[150px] h-auto"
              priority
            />
          </Link>
        </div>

        <div className="flex-none gap-2">
          <ul className="menu menu-horizontal px-1 gap-1" data-tutorial-id="navbar">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const tutorialId = item.href === '/auditoria/nova' ? 'navbar-nova' : undefined;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={isActive ? 'bg-primary text-primary-content' : ''}
                    {...(tutorialId ? { 'data-tutorial-id': tutorialId } : {})}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {isMaster() && (
              <li className="dropdown dropdown-bottom">
                <div
                  tabIndex={0}
                  role="button"
                  className={`${
                    administrativoItems.some(
                      (item) => pathname === item.href || pathname.startsWith(item.href + '/')
                    )
                      ? 'bg-primary text-primary-content'
                      : ''
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Administrativo
                  <ChevronDown className="w-3 h-3 ml-1" />
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-300 mt-2"
                >
                  {administrativoItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={isActive ? 'bg-primary text-primary-content' : ''}
                        >
                          <item.icon className="w-4 h-4" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            )}
          </ul>

          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-ghost btn-circle avatar placeholder"
              data-tutorial-id="navbar-avatar"
            >
              <div className="bg-primary text-primary-content rounded-full w-10">
                <span className="text-sm">{usuario?.nome?.charAt(0) || 'U'}</span>
              </div>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
            >
              <li className="menu-title">
                <span>{usuario?.nome || 'Usuário'}</span>
              </li>
              <li>
                <Link href="/perfil">
                  <User className="w-4 h-4" />
                  Meu Perfil
                </Link>
              </li>
              <li>
                <button onClick={handleVerTutorial} type="button">
                  <BookOpen className="w-4 h-4" />
                  Ver Tutorial
                </button>
              </li>
              {isMaster() && (
                <>
                  <li>
                    <Link href="/usuarios">
                      <User className="w-4 h-4" />
                      Usuários
                    </Link>
                  </li>
                  <li>
                    <Link href="/planos">
                      <Package className="w-4 h-4" />
                      Planos
                    </Link>
                  </li>
                  <li>
                    <Link href="/planos/assinaturas">
                      <UserCheck className="w-4 h-4" />
                      Assinaturas
                    </Link>
                  </li>
                  <li>
                    <Link href="/configuracoes-credito">
                      <Settings className="w-4 h-4" />
                      Config. Créditos
                    </Link>
                  </li>
                </>
              )}
              {isGestor() && !isMaster() && (
                <>
                  <li>
                    <Link href="/gestor/limites">
                      <TrendingUp className="w-4 h-4" />
                      Meus Limites
                    </Link>
                  </li>
                  <li>
                    <Link href="/gestor/creditos">
                      <Coins className="w-4 h-4" />
                      Meus Créditos
                    </Link>
                  </li>
                </>
              )}
              <li>
                <button onClick={handleLogout} className="text-error">
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="navbar bg-base-100 border-b border-base-300 px-4 md:hidden safe-top sticky top-0 z-40">
        <div className="flex-1">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/images/logo-large.png"
              alt="ChekAI"
              width={280}
              height={74}
              className="h-10 w-auto w-[100px]"
              priority
            />
          </Link>
        </div>
        <div className="flex-none">
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
              <Menu className="w-6 h-6" />
            </div>
            <ul
              tabIndex={0}
              className="menu dropdown-content mt-3 z-[1] p-3 shadow-lg bg-base-100 rounded-box w-64 border border-base-300 max-h-[80vh] overflow-y-auto"
              data-tutorial-id="navbar"
            >
              <li className="menu-title">
                <span className="text-base font-semibold">{usuario?.nome || 'Usuário'}</span>
              </li>
              {navItems.map((item) => {
                const tutorialId = item.href === '/auditoria/nova' ? 'navbar-nova' : undefined;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`text-base py-3 ${
                        pathname === item.href || pathname.startsWith(item.href + '/') ? 'active' : ''
                      }`}
                      {...(tutorialId ? { 'data-tutorial-id': tutorialId } : {})}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              {isMaster() && (
                <li>
                  <details>
                    <summary className={administrativoItems.some(
                      (item) => pathname === item.href || pathname.startsWith(item.href + '/')
                    ) ? 'active' : ''}>
                      <Shield className="w-4 h-4" />
                      Administrativo
                    </summary>
                    <ul>
                      {administrativoItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={`text-base py-3 ${isActive ? 'active' : ''}`}
                            >
                              <item.icon className="w-5 h-5" />
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </li>
              )}
              <div className="divider my-2"></div>
              <li>
                <Link href="/perfil" className="text-base py-3">
                  <User className="w-5 h-5" />
                  Meu Perfil
                </Link>
              </li>
              <li>
                <button onClick={handleVerTutorial} type="button" className="text-base py-3 w-full text-left">
                  <BookOpen className="w-5 h-5" />
                  Ver Tutorial
                </button>
              </li>
              {isMaster() && (
                <>
                  <li>
                    <Link href="/planos" className="text-base py-3">
                      <Package className="w-5 h-5" />
                      Planos
                    </Link>
                  </li>
                  <li>
                    <Link href="/planos/assinaturas" className="text-base py-3">
                      <UserCheck className="w-5 h-5" />
                      Assinaturas
                    </Link>
                  </li>
                  <li>
                    <Link href="/configuracoes-credito" className="text-base py-3">
                      <Settings className="w-5 h-5" />
                      Config. Créditos
                    </Link>
                  </li>
                </>
              )}
              {isGestor() && !isMaster() && (
                <>
                  <li>
                    <Link href="/gestor/limites" className="text-base py-3">
                      <TrendingUp className="w-5 h-5" />
                      Meus Limites
                    </Link>
                  </li>
                  <li>
                    <Link href="/gestor/creditos" className="text-base py-3">
                      <Coins className="w-5 h-5" />
                      Meus Créditos
                    </Link>
                  </li>
                </>
              )}
              <div className="divider my-2"></div>
              <li>
                <button onClick={handleLogout} className="text-error text-base py-3">
                  <LogOut className="w-5 h-5" />
                  Sair
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Navigation - Mobile */}
      <div className="btm-nav bg-base-100 border-t border-base-300 md:hidden safe-bottom z-50 h-20">
        {navItems.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1.5 min-w-0 flex-1 ${
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'active text-primary'
                : 'text-base-content/60'
            }`}
          >
            <item.icon className="w-7 h-7" />
            <span className="text-sm font-medium leading-tight">{item.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

