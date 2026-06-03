'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ClipboardCheck,
  Camera,
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle,
  MapPin,
  Clock,
  BarChart3,
  Star,
  ChevronDown,
  FileCheck,
  HelpCircle,
  FileDown,
  Smartphone,
  Coins,
  Instagram,
  Building2,
  ClipboardList,
  LineChart,
  UserCog,
  Database,
  RefreshCw,
  Images,
  FileText,
  KeyRound,
  CreditCard,
  PieChart,
  Monitor,
  Server,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { CookieConsent } from '@/components/ui/cookie-consent';
import { LandingHeader } from '@/components/layout/landing-header';
import { FloatingCloud } from '@/components/ui/floating-cloud';
import { ListaEsperaModal } from '@/components/ui/lista-espera-modal';
import { LandingVideoSection } from '@/components/ui/landing-video-section';

const features = [
  {
    icon: ClipboardCheck,
    title: 'Checklists personalizáveis',
    description:
      'Crie templates com itens e grupos. Importe de planilhas Excel, duplique trechos e controle versões como rascunho ou publicadas.',
  },
  {
    icon: Sparkles,
    title: 'Geração de checklist com IA',
    description:
      'O sistema sugere itens com base na legislação cadastrada e no contexto da consultoria. Você revisa e ajusta antes de publicar.',
  },
  {
    icon: Shield,
    title: 'Base de legislação integrada',
    description:
      'Cadastre normas como RDC 216, RDC 275 e outras. O sistema consulta esse material ao sugerir itens e ao analisar visitas.',
  },
  {
    icon: ClipboardList,
    title: 'Auditorias completas',
    description:
      'Pontuação, não conformidades, evidências fotográficas, finalização e reabertura. Histórico por unidade disponível no painel web.',
  },
  {
    icon: FileText,
    title: 'Resumo executivo com IA',
    description:
      'Gere o resumo executivo da auditoria com apoio do sistema, agilizando a entrega ao cliente.',
  },
  {
    icon: LineChart,
    title: 'Relatórios técnicos',
    description:
      'Fluxo separado da auditoria, com apoio analítico por IA e inclusão de evidências fotográficas.',
  },
  {
    icon: Camera,
    title: 'Análise de fotos com IA',
    description:
      'Anexe várias fotos por item. O sistema sugere achados com base nas normas — processamento em sequência para controle de qualidade e custo.',
  },
  {
    icon: Images,
    title: 'Galeria de evidências',
    description:
      'No app, visualize fotos em grade ou tela cheia. As imagens são otimizadas antes do envio.',
  },
  {
    icon: FileDown,
    title: 'Geração de PDF',
    description:
      'Exporte auditorias e relatórios técnicos em PDF pelo painel web, com histórico de entregas.',
  },
  {
    icon: Building2,
    title: 'Clientes e unidades',
    description:
      'Organize a carteira por cliente e unidade. Defina quem da equipe acompanha cada local.',
  },
  {
    icon: UserCog,
    title: 'Gestão de equipe',
    description:
      'Convite por e-mail, perfis com diferentes níveis de acesso e separação de dados por consultoria.',
  },
  {
    icon: KeyRound,
    title: 'Acesso por código no e-mail',
    description:
      'Login sem senha fixa: um código é enviado ao e-mail a cada acesso, no app e no site.',
  },
  {
    icon: MapPin,
    title: 'Check-in e geolocalização',
    description:
      'Registre presença no local da visita. O acompanhamento administrativo fica disponível no painel web.',
  },
  {
    icon: Smartphone,
    title: 'App para iOS e Android',
    description:
      'O mesmo sistema do computador no celular: responder itens, registrar fotos e sincronizar quando houver conexão.',
  },
  {
    icon: Database,
    title: 'Funciona sem internet',
    description:
      'Auditorias, itens e clientes ficam disponíveis no aparelho. O trabalho continua offline e sincroniza ao voltar a conexão.',
  },
  {
    icon: RefreshCw,
    title: 'Sincronização automática',
    description:
      'O app baixa atualizações do servidor e envia o que foi feito em campo, com fila de envio para garantir que nada se perca.',
  },
  {
    icon: Coins,
    title: 'Créditos de IA',
    description:
      'O administrador da conta distribui créditos e acompanha o consumo da equipe.',
  },
  {
    icon: PieChart,
    title: 'Histórico de uso de IA',
    description:
      'Registro detalhado do consumo de IA para previsão de custos e acompanhamento administrativo.',
  },
  {
    icon: CreditCard,
    title: 'Planos e assinaturas',
    description:
      'Planos com limites configuráveis e visibilidade do que está contratado.',
  },
];

const ecossistemaPilares = [
  {
    icon: Monitor,
    titulo: 'No computador: gestão completa',
    texto:
      'Checklists, normas, clientes, visitas, relatórios, PDFs, registro de presença, planos e equipe — o que a consultoria precisa para organizar e cobrar com clareza.',
  },
  {
    icon: Smartphone,
    titulo: 'No celular: a visita em primeiro lugar',
    texto:
      'Comece e acompanhe visitas mesmo sem sinal, responda itens, anexe fotos e, quando a internet voltar, tudo se atualiza. É o mesmo sistema — não é um “modo limitado”.',
  },
  {
    icon: Server,
    titulo: 'Um só sistema, do escritório à visita',
    texto:
      'O que você faz no app e o que faz no site falam a mesma língua: mesmos dados, mesmas regras, e cada perfil vê só o que deve.',
  },
];

const benefits = [
  'Reduza o tempo gasto em auditorias e na elaboração de relatórios',
  'Consulte a legislação cadastrada diretamente durante a análise',
  'Padronize relatórios e PDFs com apoio de IA',
  'Continue trabalhando em campo mesmo sem conexão com a internet',
  'Acompanhe o consumo de IA com créditos e histórico de uso',
  'Gerencie tudo em um só lugar: painel web e aplicativo mobile integrados',
];

const stats = [
  { value: '70%', label: 'Redução de tempo', icon: Clock },
  { value: 'IA', label: 'Apoio inteligente', icon: Sparkles },
  { value: 'Offline', label: 'Funciona sem internet', icon: Database },
  { value: 'Web+App', label: 'Painel e aplicativo', icon: Smartphone },
];

const testimonials = [
  {
    name: 'Maria Silva',
    role: 'Consultora em Segurança de Alimentos',
    content:
      'Consegui organizar melhor as visitas e entregar relatórios mais rápido. O sistema centraliza tudo em um lugar só.',
    rating: 5,
  },
  {
    name: 'João Santos',
    role: 'Engenheiro de Alimentos',
    content:
      'A análise das fotos ajuda a identificar pontos que poderiam passar despercebidos. Reviso tudo, mas tenho um bom ponto de partida.',
    rating: 5,
  },
  {
    name: 'Ana Costa',
    role: 'Nutricionista',
    content:
      'Os relatórios ficam mais consistentes e a entrega ao cliente é mais ágil. Fez diferença na rotina.',
    rating: 5,
  },
];

const faqs = [
  {
    question: 'Como funciona a análise de fotos?',
    answer:
      'Você anexa uma ou mais fotos em cada item da auditoria. O sistema sugere não conformidades e melhorias com base na legislação cadastrada. O processamento é feito em sequência e a decisão final é sempre do profissional.',
  },
  {
    question: 'O aplicativo funciona sem internet?',
    answer:
      'Sim. Auditorias, itens e clientes ficam armazenados no celular. O trabalho continua normalmente e tudo sincroniza quando a conexão estiver disponível.',
  },
  {
    question: 'Como funciona o login?',
    answer:
      'O acesso é feito por um código enviado ao e-mail, sem necessidade de senha fixa. O administrador da conta cadastra a equipe e envia convites.',
  },
  {
    question: 'Quais legislações estão disponíveis?',
    answer:
      'A plataforma permite cadastrar normas como RDC 216, RDC 275, Portaria 3214/78 e outras. O sistema passa a usar esse material como referência nas análises e sugestões.',
  },
  {
    question: 'Posso criar meus próprios checklists?',
    answer:
      'Sim. Crie do zero, importe de planilha, duplique itens e grupos. Também é possível usar a geração com IA para ter um ponto de partida.',
  },
  {
    question: 'Como funciona o custo da IA?',
    answer:
      'O sistema usa créditos. O administrador distribui créditos para a equipe e acompanha o consumo pelo painel, facilitando o controle de custos.',
  },
  {
    question: 'Os dados são seguros?',
    answer:
      'Sim. Cada consultoria tem seus dados isolados, o acesso é controlado por perfil e seguimos práticas de segurança em conformidade com a LGPD.',
  },
  {
    question: 'Existe aplicativo para celular?',
    answer:
      'Sim, disponível para iOS e Android. É o mesmo sistema do painel web, com foco em auditorias, fotos e sincronização.',
  },
];

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [modalListaEsperaAberto, setModalListaEsperaAberto] = useState(false);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const heroY = useTransform(scrollY, [0, 300], [0, 50]);

  useEffect(() => {
    if (_hasHydrated && isAuthenticated) {
      router.push('/admin/dashboard');
    }
  }, [isAuthenticated, _hasHydrated, router]);

  useEffect(() => {
    if (searchParams.get('lista-espera') === '1') {
      setModalListaEsperaAberto(true);
    }
  }, [searchParams]);

  if (_hasHydrated && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <>
      <LandingHeader onAbrirListaEspera={() => setModalListaEsperaAberto(true)} />
      <ListaEsperaModal
        open={modalListaEsperaAberto}
        onClose={() => setModalListaEsperaAberto(false)}
      />
      <main className="min-h-screen bg-gradient-to-b from-base-100 to-base-200 overflow-hidden">
        {/* Hero Section */}
      <section className="relative px-4 pt-8 pb-16 lg:px-8 lg:pt-12 lg:pb-32 min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <FloatingCloud />
        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 backdrop-blur-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Consultoria em segurança de alimentos com IA</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ opacity: heroOpacity, y: heroY }}
              className="text-4xl md:text-5xl lg:text-7xl font-bold text-base-content mb-6 font-display leading-tight"
            >
              <span className="text-primary">ChekAI</span> — Auditorias, relatórios e checklists em{' '}
              <br />
              <span className="text-3xl md:text-4xl lg:text-5xl text-primary">Segurança de Alimentos</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-base-content/70 max-w-3xl mx-auto mb-4"
            >
              Organize visitas, registre achados com fotos, gere relatórios técnicos e PDFs —
              no computador ou no celular, com ou sem internet.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-xl md:text-2xl font-semibold text-primary mb-10 italic"
            >
              Fácil no check, inteligente no controle.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
            >
              <button
                type="button"
                onClick={() => setModalListaEsperaAberto(true)}
                className="btn btn-primary btn-lg gap-2 text-lg px-8 hover:scale-105 transition-transform"
              >
                Conhecer agora
                <ArrowRight className="w-5 h-5" />
              </button>
              <Link
                href="/login"
                className="btn btn-outline btn-lg text-lg px-8 hover:scale-105 transition-transform"
              >
                Entrar
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="card bg-base-100/80 backdrop-blur-sm border border-base-300 shadow-sm"
                >
                  <div className="card-body p-4 text-center">
                    <stat.icon className="w-8 h-8 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold text-primary">{stat.value}</div>
                    <div className="text-xs text-base-content/60">{stat.label}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <LandingVideoSection
        sectionId="demo"
        titulo="Veja o ChekAI em ação"
        subtitulo="Uma visão geral do painel web e do aplicativo mobile"
        embedUrl={process.env.NEXT_PUBLIC_LANDING_VIDEO_URL_DEMO ?? ''}
        placeholderHint="Vídeo em breve: demonstração geral do sistema."
        instrucaoEnv="Defina NEXT_PUBLIC_LANDING_VIDEO_URL_DEMO com a URL de incorporação (embed) do YouTube, Vimeo ou similar."
        className="bg-base-100"
      />
      <LandingVideoSection
        sectionId="demo-checklist-ia"
        titulo="Checklists com apoio de IA"
        subtitulo="Criação de templates com sugestões baseadas na legislação cadastrada"
        embedUrl={process.env.NEXT_PUBLIC_LANDING_VIDEO_URL_CHECKLIST_IA ?? ''}
        placeholderHint="Vídeo em breve: criação de checklist com IA."
        instrucaoEnv="Defina NEXT_PUBLIC_LANDING_VIDEO_URL_CHECKLIST_IA com a URL de incorporação (embed)."
        className="bg-base-200"
      />
      <LandingVideoSection
        sectionId="demo-app-campo"
        titulo="Aplicativo em campo"
        subtitulo="Auditorias, fotos e sincronização automática no aplicativo mobile"
        embedUrl={process.env.NEXT_PUBLIC_LANDING_VIDEO_URL_APP_CAMPO ?? ''}
        placeholderHint="Vídeo em breve: auditoria no app e sincronização."
        instrucaoEnv="Defina NEXT_PUBLIC_LANDING_VIDEO_URL_APP_CAMPO com a URL de incorporação (embed)."
        className="bg-base-100"
      />

      <section id="ecossistema" className="px-4 py-16 lg:px-8 bg-base-200 border-y border-base-300">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-base-content mb-3 font-display">
              Como o sistema funciona
            </h2>
            <p className="text-lg text-base-content/70 max-w-3xl mx-auto">
              Painel web para gestão, aplicativo mobile para campo e uma base de dados compartilhada
              com controle de acesso por perfil.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ecossistemaPilares.map((pilar, index) => (
              <motion.div
                key={pilar.titulo}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="card bg-base-100 border border-base-300 shadow-sm"
              >
                <div className="card-body">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                    <pilar.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="card-title text-lg">{pilar.titulo}</h3>
                  <p className="text-sm text-base-content/65 leading-relaxed">{pilar.texto}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 py-20 lg:px-8 bg-base-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-base-content mb-4 font-display"
            >
              Funcionalidades
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-base-content/70 max-w-3xl mx-auto"
            >
              Checklists, auditorias, relatórios técnicos, análise de fotos com IA,
              geração de PDF, gestão de equipe e funcionamento offline.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="card-body">
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="card-title text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-base-content/60 leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-4 py-20 lg:px-8 bg-gradient-to-br from-primary to-secondary">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 font-display">
              Por que usar o ChekAI?
            </h2>
            <p className="text-lg text-white/90 max-w-2xl mx-auto">
              O que muda na rotina da consultoria
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20"
              >
                <CheckCircle className="w-6 h-6 text-white flex-shrink-0" />
                <span className="text-white text-lg">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="px-4 py-20 lg:px-8 bg-base-100">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-base-content mb-4 font-display">
              O que nossos clientes dizem
            </h2>
            <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
              Feedback de profissionais que usam o ChekAI na rotina
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="card-body">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-base-content/80 mb-4 italic">"{testimonial.content}"</p>
                  <div>
                    <div className="font-semibold text-base-content">{testimonial.name}</div>
                    <div className="text-sm text-base-content/60">{testimonial.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Image Showcase Section */}
      <section className="px-4 py-20 lg:px-8 bg-base-200">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-base-content mb-4 font-display">
              Interface web e mobile
            </h2>
            <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
              Painel administrativo no computador e telas otimizadas para uso em campo no celular
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl overflow-hidden shadow-xl border border-base-300 bg-base-100"
            >
              <div className="aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                <div className="text-center">
                  <FileCheck className="w-16 h-16 text-primary/40 mx-auto mb-4" />
                  <p className="text-base-content/60">Checklists, normas e cadastros no painel web</p>
                  <p className="text-sm text-base-content/40 mt-2">Imagem sugerida: tela do painel 1200×800px</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl overflow-hidden shadow-xl border border-base-300 bg-base-100"
            >
              <div className="aspect-video bg-gradient-to-br from-secondary/10 to-primary/10 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-secondary/40 mx-auto mb-4" />
                  <p className="text-base-content/60">Relatórios, PDFs e indicadores para o cliente</p>
                  <p className="text-sm text-base-content/40 mt-2">Imagem sugerida: relatório ou dashboard 1200×800px</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="px-4 py-20 lg:px-8 bg-base-100">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-base-content mb-4 font-display">
              Perguntas Frequentes
            </h2>
            <p className="text-lg text-base-content/70">
              Tire suas dúvidas sobre o ChekAI
            </p>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="card bg-base-100 border border-base-300 shadow-sm"
              >
                <div
                  className="card-body p-6 cursor-pointer"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-base-content flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-primary" />
                      {faq.question}
                    </h3>
                    <ChevronDown
                      className={`w-5 h-5 text-base-content/60 transition-transform ${
                        openFaq === index ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                  {openFaq === index && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-base-content/70 mt-4 pt-4 border-t border-base-300"
                    >
                      {faq.answer}
                    </motion.p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 lg:px-8 bg-gradient-to-br from-primary to-secondary">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 font-display">
              Conheça o ChekAI
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Veja como o sistema pode se encaixar na rotina da sua consultoria.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                type="button"
                onClick={() => setModalListaEsperaAberto(true)}
                className="btn btn-lg bg-white text-primary hover:bg-base-200 text-lg px-8 gap-2 hover:scale-105 transition-transform"
              >
                Conhecer agora
                <ArrowRight className="w-5 h-5" />
              </button>
              <Link
                href="/login"
                className="btn btn-lg btn-outline border-white text-white hover:bg-white/10 text-lg px-8 hover:scale-105 transition-transform"
              >
                Entrar
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 lg:px-8 bg-base-100 border-t border-base-300">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
            <div className="lg:col-span-1">
              <div className="flex items-center justify-center md:justify-start mb-4">
                <Image
                  src="/images/logo-large.png"
                  alt="ChekAI"
                  width={200}
                  height={53}
                  className="h-auto w-full max-w-[200px]"
                />
              </div>
              <p className="text-sm text-base-content/60 text-center md:text-left">
                Sistema para consultoria em segurança de alimentos com inteligência artificial, legislação integrada
                e aplicativo mobile.
              </p>
              <p className="text-sm font-medium text-primary italic mt-2 text-center md:text-left">
                Fácil no check, inteligente no controle.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-base-content/60">
                <li>
                  <Link href="#ecossistema" className="hover:text-primary transition-colors">
                    Visão geral
                  </Link>
                </li>
                <li>
                  <Link href="#features" className="hover:text-primary transition-colors">
                    Funcionalidades
                  </Link>
                </li>
                <li>
                  <Link href="#demo" className="hover:text-primary transition-colors">
                    Demonstração
                  </Link>
                </li>
                <li>
                  <Link href="#demo-checklist-ia" className="hover:text-primary transition-colors">
                    Checklist com IA
                  </Link>
                </li>
                <li>
                  <Link href="#demo-app-campo" className="hover:text-primary transition-colors">
                    App no campo
                  </Link>
                </li>
                <li>
                  <Link href="#faq" className="hover:text-primary transition-colors">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Recursos</h4>
              <ul className="space-y-2 text-sm text-base-content/60">
                <li>
                  <Link href="/login" className="hover:text-primary transition-colors">
                    Entrar
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setModalListaEsperaAberto(true)}
                    className="hover:text-primary transition-colors text-left"
                  >
                    Conhecer agora
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-base-content/60">
                <li>Meta Consultoria</li>
                <li>
                  <a
                    href="https://instagram.com/chekai.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <Instagram className="w-4 h-4" />
                    @chekai.app
                  </a>
                </li>
                <li className="text-xs">© {new Date().getFullYear()} Todos os direitos reservados</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Jurídico</h4>
              <ul className="space-y-2 text-sm text-base-content/60">
                <li>
                  <Link href="/politica-privacidade" className="hover:text-primary transition-colors">
                    Política de Privacidade
                  </Link>
                </li>
                <li>
                  <Link href="/politica-cookies" className="hover:text-primary transition-colors">
                    Política de Cookies
                  </Link>
                </li>
                <li>
                  <Link href="/lgpd" className="hover:text-primary transition-colors">
                    LGPD
                  </Link>
                </li>
                <li>
                  <Link href="/termos-uso" className="hover:text-primary transition-colors">
                    Termos de Uso
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-base-300 pt-8 text-center text-sm text-base-content/60">
            <p>Desenvolvido com ❤️ pela equipe Meta Consultoria</p>
          </div>
        </div>
      </footer>
      <CookieConsent />
      </main>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
