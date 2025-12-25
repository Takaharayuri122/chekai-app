'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ClipboardCheck,
  Camera,
  FileText,
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle,
} from 'lucide-react';

const features = [
  {
    icon: ClipboardCheck,
    title: 'Checklists Inteligentes',
    description: 'Templates baseados em RDC 216, 275 e outras legislações vigentes.',
  },
  {
    icon: Camera,
    title: 'Análise de Imagens',
    description: 'IA detecta não conformidades automaticamente a partir de fotos.',
  },
  {
    icon: FileText,
    title: 'Relatórios com IA',
    description: 'Textos técnicos e planos de ação gerados automaticamente.',
  },
  {
    icon: Shield,
    title: 'Base de Legislação',
    description: 'RAG com normas atualizadas para sugestões precisas.',
  },
];

const benefits = [
  'Reduza o tempo de auditorias em até 70%',
  'Elimine erros de interpretação da legislação',
  'Padronize relatórios e planos de ação',
  'Facilite a comunicação com clientes',
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-base-100 to-base-200">
      {/* Hero Section */}
      <section className="px-4 pt-12 pb-16 lg:px-8 lg:pt-20 lg:pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4" />
              Powered by DeepSeek & OpenAI
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl lg:text-6xl font-bold text-base-content mb-6"
            >
              Consultoria em{' '}
              <span className="text-primary">Segurança de Alimentos</span>
              <br />com Inteligência Artificial
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-base-content/70 max-w-2xl mx-auto mb-8"
            >
              Automatize auditorias, identifique não conformidades e gere relatórios 
              técnicos em minutos com o poder da IA.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/login" className="btn btn-primary btn-lg gap-2">
                Entrar
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/cadastro" className="btn btn-outline btn-lg">
                Criar conta gratuita
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16 lg:px-8 bg-base-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-base-content mb-4">
              Funcionalidades Principais
            </h2>
            <p className="text-base-content/70 max-w-xl mx-auto">
              Tudo que você precisa para realizar auditorias eficientes e gerar relatórios profissionais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 + 0.4 }}
                className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="card-body">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="card-title text-lg">{feature.title}</h3>
                  <p className="text-sm text-base-content/60">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-4 py-16 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="card bg-primary text-primary-content">
            <div className="card-body p-8 lg:p-12">
              <h2 className="text-2xl lg:text-3xl font-bold mb-8 text-center">
                Por que usar o Meta App?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + 0.6 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{benefit}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 text-center border-t border-base-300">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
            <ClipboardCheck className="w-4 h-4 text-primary-content" />
          </div>
          <span className="font-semibold text-base-content">Meta App</span>
        </div>
        <p className="text-sm text-base-content/60">
          POC - Evobit © {new Date().getFullYear()}
        </p>
      </footer>
    </main>
  );
}
