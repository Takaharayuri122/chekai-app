'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ClipboardCheck,
  Camera,
  FileText,
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle,
  Users,
  MapPin,
  Zap,
  TrendingUp,
  Clock,
  Award,
  BarChart3,
  Star,
  ChevronDown,
  Play,
  FileCheck,
  HelpCircle,
  FileDown,
  Upload,
  Smartphone,
  Coins,
  Instagram,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { CookieConsent } from '@/components/ui/cookie-consent';
import { LandingHeader } from '@/components/layout/landing-header';
import { FloatingCloud } from '@/components/ui/floating-cloud';
import { ListaEsperaModal } from '@/components/ui/lista-espera-modal';

const features = [
  {
    icon: ClipboardCheck,
    title: 'Checklists Inteligentes',
    description: 'Templates prontos baseados em RDC 216, 275 e outras legislações. Personalize conforme sua necessidade.',
  },
  {
    icon: Camera,
    title: 'Análise Automática de Imagens',
    description: 'Fotografe durante a auditoria e receba análise automática de não conformidades com sugestões de correção.',
  },
  {
    icon: FileText,
    title: 'Relatórios Automáticos',
    description: 'Gere textos técnicos, planos de ação e relatórios completos automaticamente, baseados na legislação vigente.',
  },
  {
    icon: Shield,
    title: 'Base de Legislação Inteligente',
    description: 'Acesso rápido a normas atualizadas com busca inteligente que encontra exatamente o que você precisa.',
  },
  {
    icon: Users,
    title: 'Gestão de Clientes',
    description: 'Organize clientes e unidades em um só lugar. Controle histórico completo de auditorias.',
  },
  {
    icon: MapPin,
    title: 'Geolocalização',
    description: 'Registre automaticamente a localização de início e fim de cada auditoria para rastreabilidade.',
  },
  {
    icon: Zap,
    title: 'Sugestões Inteligentes',
    description: 'Receba sugestões automáticas de referências legais, descrições técnicas e ações corretivas.',
  },
  {
    icon: CheckCircle,
    title: 'Controle Total',
    description: 'Acompanhe status, pontuações e histórico. Reabra auditorias para correções quando necessário.',
  },
  {
    icon: FileDown,
    title: 'Exportação em PDF',
    description: 'Gere relatórios profissionais em PDF prontos para enviar aos clientes. Histórico de evolução incluído.',
  },
  {
    icon: Upload,
    title: 'Importação de Checklists',
    description: 'Importe seus checklists existentes a partir de planilhas Excel. Migre facilmente para o ChekAI.',
  },
  {
    icon: Smartphone,
    title: 'Funciona Offline',
    description: 'PWA instalável no celular. Realize auditorias em campo sem internet e sincronize quando voltar.',
  },
  {
    icon: Coins,
    title: 'Sistema de Créditos',
    description: 'Controle o uso de IA com créditos. Gestores distribuam créditos para sua equipe de auditores.',
  },
];

const benefits = [
  'Reduza o tempo de auditorias em até 70%',
  'Elimine erros de interpretação da legislação',
  'Padronize relatórios e planos de ação automaticamente',
  'Facilite a comunicação com clientes com relatórios profissionais',
  'Aumente a produtividade da sua equipe',
  'Mantenha histórico completo e organizado',
];

const stats = [
  { value: '70%', label: 'Redução de tempo', icon: Clock },
  { value: '100%', label: 'Conformidade legal', icon: Shield },
  { value: '24/7', label: 'Disponibilidade', icon: Zap },
  { value: '99%', label: 'Precisão na análise', icon: Award },
];

const testimonials = [
  {
    name: 'Maria Silva',
    role: 'Consultora em Segurança de Alimentos',
    content: 'O ChekAI transformou completamente minha forma de trabalhar. Agora consigo finalizar auditorias em muito menos tempo e com muito mais qualidade.',
    rating: 5,
  },
  {
    name: 'João Santos',
    role: 'Auditor Certificado',
    content: 'A análise automática de imagens é incrível! Identifica não conformidades que eu poderia passar despercebidas. Recomendo muito!',
    rating: 5,
  },
  {
    name: 'Ana Costa',
    role: 'Coordenadora de Qualidade',
    content: 'Os relatórios gerados são profissionais e completos. Meus clientes ficam impressionados com a qualidade e rapidez.',
    rating: 5,
  },
];

const faqs = [
  {
    question: 'Como funciona a análise automática de imagens?',
    answer: 'Nossa IA analisa fotos tiradas durante a auditoria e identifica automaticamente não conformidades, sugerindo correções baseadas na legislação vigente.',
  },
  {
    question: 'Quais legislações estão disponíveis?',
    answer: 'Trabalhamos com RDC 216, RDC 275, Portaria 3214/78 e outras normas relevantes para segurança de alimentos. A base é constantemente atualizada.',
  },
  {
    question: 'Posso personalizar os templates de checklist?',
    answer: 'Sim! Você pode criar seus próprios templates ou adaptar os existentes conforme suas necessidades específicas.',
  },
  {
    question: 'Os dados são seguros?',
    answer: 'Sim, utilizamos criptografia de ponta a ponta e seguimos todas as normas de proteção de dados (LGPD). Seus dados estão completamente seguros.',
  },
  {
    question: 'Preciso de treinamento para usar?',
    answer: 'Não! A interface é intuitiva e fácil de usar. Oferecemos também tutoriais e suporte completo para você começar rapidamente.',
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
              <span>Sistema para Consultorias com IA</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ opacity: heroOpacity, y: heroY }}
              className="text-4xl md:text-5xl lg:text-7xl font-bold text-base-content mb-6 font-display leading-tight"
            >
              <span className="text-primary">ChekAI</span> - Sistema Completo para Consultorias em{' '}
              <br />
              <span className="text-3xl md:text-4xl lg:text-5xl text-primary">Segurança de Alimentos</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-base-content/70 max-w-3xl mx-auto mb-4"
            >
              Plataforma para consultorias automatizarem auditorias, identificarem não conformidades
              e gerarem relatórios técnicos profissionais em minutos. Entregue muito mais valor aos seus clientes.
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

      {/* Demo Section */}
      <section id="demo" className="px-4 py-20 lg:px-8 bg-base-100 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-base-content mb-4 font-display"
            >
              Veja o ChekAI em ação
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-base-content/70 max-w-2xl mx-auto"
            >
              Interface intuitiva e poderosa que transforma sua forma de trabalhar
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="relative rounded-2xl overflow-hidden shadow-2xl border border-base-300 bg-base-200"
          >
            <div className="aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="w-12 h-12 text-primary" />
                </div>
                <p className="text-base-content/60">
                  [Placeholder para screenshot/vídeo do dashboard]
                </p>
                <p className="text-sm text-base-content/40 mt-2">
                  Adicione uma imagem 1920x1080px aqui
                </p>
              </div>
            </div>
          </motion.div>
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
              Principais Funcionalidades
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-base-content/70 max-w-2xl mx-auto"
            >
              Tecnologia avançada que transforma a forma como <br /> você realiza auditorias e gera relatórios.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              Benefícios reais que fazem a diferença no seu dia a dia
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
              Confira o feedback de quem já usa o ChekAI em suas auditorias
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
              Interface Moderna e Intuitiva
            </h2>
            <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
              Design pensado para facilitar seu trabalho
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
                  <p className="text-base-content/60">[Placeholder para imagem do checklist]</p>
                  <p className="text-sm text-base-content/40 mt-2">Adicione uma imagem 1200x800px</p>
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
                  <p className="text-base-content/60">[Placeholder para imagem de relatórios]</p>
                  <p className="text-sm text-base-content/40 mt-2">Adicione uma imagem 1200x800px</p>
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
              Pronto para transformar suas auditorias?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Comece hoje mesmo e veja a diferença que a inteligência artificial pode fazer no seu trabalho.
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
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
                Sistema para consultorias em segurança de alimentos com inteligência artificial.
              </p>
              <p className="text-sm font-medium text-primary italic mt-2 text-center md:text-left">
                Fácil no check, inteligente no controle.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-base-content/60">
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
