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
} from 'lucide-react';
import { useAuthStore, PerfilUsuario } from '@/lib/store';

const allNavItems = [
  { href: '/dashboard', label: 'Início', icon: Home, roles: [PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR] },
  { href: '/auditoria/nova', label: 'Nova', icon: Plus, roles: [PerfilUsuario.AUDITOR] },
  { href: '/clientes', label: 'Clientes', icon: Building2, roles: [PerfilUsuario.MASTER, PerfilUsuario.GESTOR] },
  { href: '/templates', label: 'Checklists', icon: FileText, roles: [PerfilUsuario.MASTER, PerfilUsuario.GESTOR] },
  { href: '/auditorias', label: 'Auditorias', icon: ClipboardCheck, roles: [PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR] },
  { href: '/usuarios', label: 'Usuários', icon: User, roles: [PerfilUsuario.MASTER, PerfilUsuario.GESTOR] },
];

export function Navbar() {
  const pathname = usePathname();
  const { usuario, logout, isMaster, isGestor, isAuditor } = useAuthStore();

  const handleLogout = () => {
    logout();
    window.location.href = '/';
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
          <ul className="menu menu-horizontal px-1 gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${
                    pathname === item.href ? 'bg-primary text-primary-content' : ''
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar placeholder">
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
              {isMaster() && (
                <li>
                  <Link href="/usuarios">
                    <User className="w-4 h-4" />
                    Usuários
                  </Link>
                </li>
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
              <Menu className="w-5 h-5" />
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
            >
              <li className="menu-title">
                <span>{usuario?.nome || 'Usuário'}</span>
              </li>
              <div className="divider my-1"></div>
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

      {/* Bottom Navigation - Mobile */}
      <div className="btm-nav btm-nav-sm bg-base-100 border-t border-base-300 md:hidden safe-bottom z-50">
        {navItems.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href || pathname.startsWith(item.href + '/') ? 'active text-primary' : 'text-base-content/60'}
          >
            <item.icon className="w-5 h-5" />
            <span className="btm-nav-label text-xs">{item.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

