'use client';

import { motion } from 'framer-motion';
import {
  ClipboardCheck,
  Camera,
  FileText,
  Shield,
  Users,
  MapPin,
  Zap,
  CheckCircle,
  Brain,
  Search,
  Award,
  TrendingUp,
  BarChart3,
  Lock,
  FileSearch,
  AlertTriangle,
  CheckSquare,
  BookOpen,
  Target,
  Lightbulb,
} from 'lucide-react';

interface FloatingItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  x: number;
  y: number;
  delay: number;
  size: 'sm' | 'md' | 'lg';
}

const items: FloatingItem[] = [
  { icon: ClipboardCheck, label: 'Checklist', x: 8, y: 15, delay: 0, size: 'lg' },
  { icon: Camera, label: 'Análise de Imagens', x: 88, y: 12, delay: 0.2, size: 'md' },
  { icon: Brain, label: 'IA', x: 12, y: 8, delay: 0.4, size: 'lg' },
  { icon: Shield, label: 'Segurança', x: 18, y: 65, delay: 0.1, size: 'md' },
  { icon: FileText, label: 'Relatórios', x: 82, y: 58, delay: 0.3, size: 'md' },
  { icon: Search, label: 'Busca Inteligente', x: 45, y: 75, delay: 0.5, size: 'sm' },
  { icon: Users, label: 'Gestão', x: 5, y: 42, delay: 0.15, size: 'sm' },
  { icon: MapPin, label: 'Geolocalização', x: 92, y: 38, delay: 0.25, size: 'sm' },
  { icon: Zap, label: 'Automação', x: 50, y: 48, delay: 0.35, size: 'md' },
  { icon: CheckCircle, label: 'Conformidade', x: 28, y: 82, delay: 0.45, size: 'sm' },
  { icon: Award, label: 'Qualidade', x: 78, y: 78, delay: 0.55, size: 'sm' },
  { icon: BarChart3, label: 'Analytics', x: 38, y: 32, delay: 0.2, size: 'sm' },
  { icon: Lock, label: 'Segurança', x: 68, y: 28, delay: 0.3, size: 'sm' },
  { icon: FileSearch, label: 'Auditoria', x: 22, y: 52, delay: 0.4, size: 'md' },
  { icon: AlertTriangle, label: 'Não Conformidades', x: 95, y: 55, delay: 0.5, size: 'sm' },
  { icon: CheckSquare, label: 'Checklist', x: 3, y: 68, delay: 0.1, size: 'sm' },
  { icon: BookOpen, label: 'Legislação', x: 62, y: 62, delay: 0.35, size: 'md' },
  { icon: Target, label: 'Precisão', x: 32, y: 22, delay: 0.25, size: 'sm' },
  { icon: Lightbulb, label: 'Sugestões', x: 52, y: 88, delay: 0.45, size: 'sm' },
  { icon: TrendingUp, label: 'Crescimento', x: 72, y: 92, delay: 0.55, size: 'sm' },
];

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
};

const iconSizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function FloatingCloud() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((item, index) => {
        const Icon = item.icon;
        const floatDuration = 4 + (index % 3) * 0.5;
        const floatDistance = 20 + (index % 2) * 10;
        const horizontalDrift = Math.sin(index) * 8;
        
        return (
          <motion.div
            key={`${item.label}-${index}`}
            className="absolute flex flex-col items-center justify-center gap-1.5"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0.3, 0.5, 0.3],
              scale: [0.9, 1.05, 0.9],
              y: [0, -floatDistance, 0],
              x: [0, horizontalDrift, 0],
              rotate: [0, 3, -3, 0],
            }}
            transition={{
              duration: floatDuration,
              delay: item.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <motion.div
              className={`${sizeClasses[item.size]} bg-primary/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-primary/20 shadow-sm hover:bg-primary/20 transition-colors`}
              whileHover={{ scale: 1.2 }}
            >
              <Icon className={`${iconSizeClasses[item.size]} text-primary`} />
            </motion.div>
            <motion.span
              className={`${sizeClasses[item.size].split(' ')[2]} text-base-content/60 font-medium whitespace-nowrap hidden lg:block drop-shadow-sm`}
              animate={{
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: floatDuration,
                delay: item.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {item.label}
            </motion.span>
          </motion.div>
        );
      })}
    </div>
  );
}
