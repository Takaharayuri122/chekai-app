'use client';

import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

interface LandingVideoSectionProps {
  sectionId: string;
  titulo: string;
  subtitulo: string;
  embedUrl: string;
  placeholderHint: string;
  instrucaoEnv: string;
  className?: string;
}

export function LandingVideoSection({
  sectionId,
  titulo,
  subtitulo,
  embedUrl,
  placeholderHint,
  instrucaoEnv,
  className = 'bg-base-100',
}: LandingVideoSectionProps) {
  const hasVideo = embedUrl.trim().length > 0;
  return (
    <section id={sectionId} className={`px-4 py-20 lg:px-8 relative ${className}`}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-base-content mb-4 font-display"
          >
            {titulo}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-base-content/70 max-w-2xl mx-auto"
          >
            {subtitulo}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="relative rounded-2xl overflow-hidden shadow-2xl border border-base-300 bg-base-200"
        >
          {hasVideo ? (
            <div className="relative aspect-video w-full">
              <iframe
                title={titulo}
                src={embedUrl.trim()}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
              <div className="text-center px-4">
                <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="w-12 h-12 text-primary" />
                </div>
                <p className="text-base-content/60">{placeholderHint}</p>
                <p className="text-sm text-base-content/40 mt-2">{instrucaoEnv}</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
