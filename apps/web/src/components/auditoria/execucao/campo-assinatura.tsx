'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { ehImagemDeAssinatura } from '@/lib/checklist/pontuacao';
import { pontoMedio, pontoNoQuadro, tamanhoDaExportacao, type Ponto } from './campo-assinatura.logic';

const COR_TINTA = '#1B2A4A';
const ALTURA_QUADRO = 180;

interface CampoAssinaturaProps {
  valor: string;
  somenteLeitura: boolean;
  onSalvar: (imagem: string) => void;
}

/**
 * Assinatura desenhada com o dedo ou o mouse. Salva a imagem PNG (fundo transparente)
 * como resposta da pergunta; com assinatura gravada, mostra a imagem e permite assinar de novo.
 */
export function CampoAssinatura({ valor, somenteLeitura, onSalvar }: CampoAssinaturaProps) {
  const assinada = ehImagemDeAssinatura(valor);
  const [assinando, setAssinando] = useState(!assinada);

  if (assinada && !assinando) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-border bg-card p-3">
          <img src={valor} alt="Assinatura registrada" className="mx-auto block h-28 max-w-full object-contain" />
        </div>
        {!somenteLeitura && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAssinando(true)}>
            <PenLine /> Assinar de novo
          </Button>
        )}
      </div>
    );
  }

  if (somenteLeitura) {
    return <p className="text-sm text-muted-foreground">Sem assinatura.</p>;
  }

  return (
    <QuadroAssinatura
      onCancelar={assinada ? () => setAssinando(false) : undefined}
      onSalvar={(imagem) => {
        onSalvar(imagem);
        setAssinando(false);
      }}
    />
  );
}

function QuadroAssinatura({ onSalvar, onCancelar }: { onSalvar: (imagem: string) => void; onCancelar?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracoRef = useRef<{ ultimo: Ponto; meio: Ponto } | null>(null);
  const [vazio, setVazio] = useState(true);

  // O quadro desenha na resolução da tela (nítido em celular) e acompanha a largura do painel
  const ajustarTamanho = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const proporcao = window.devicePixelRatio || 1;
    const largura = canvas.clientWidth;
    canvas.width = Math.round(largura * proporcao);
    canvas.height = Math.round(ALTURA_QUADRO * proporcao);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(proporcao, 0, 0, proporcao, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COR_TINTA;
    setVazio(true);
  }, []);

  useEffect(() => {
    ajustarTamanho();
    window.addEventListener('resize', ajustarTamanho);
    return () => window.removeEventListener('resize', ajustarTamanho);
  }, [ajustarTamanho]);

  const contexto = () => canvasRef.current?.getContext('2d') ?? null;

  const iniciar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = contexto();
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const p = pontoNoQuadro(e, canvas.getBoundingClientRect());
    tracoRef.current = { ultimo: p, meio: p };
    // Um toque sem arrastar vira um ponto
    ctx.beginPath();
    ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = COR_TINTA;
    ctx.fill();
    setVazio(false);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = contexto();
    const traco = tracoRef.current;
    if (!canvas || !ctx || !traco) return;
    const p = pontoNoQuadro(e, canvas.getBoundingClientRect());
    const meio = pontoMedio(traco.ultimo, p);
    ctx.beginPath();
    ctx.moveTo(traco.meio.x, traco.meio.y);
    ctx.quadraticCurveTo(traco.ultimo.x, traco.ultimo.y, meio.x, meio.y);
    ctx.stroke();
    tracoRef.current = { ultimo: p, meio };
  };

  const terminar = () => {
    tracoRef.current = null;
  };

  const limpar = () => {
    const canvas = canvasRef.current;
    const ctx = contexto();
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setVazio(true);
  };

  const salvar = () => {
    const canvas = canvasRef.current;
    if (!canvas || vazio) return;
    const { largura, altura } = tamanhoDaExportacao(canvas.clientWidth, ALTURA_QUADRO);
    const saida = document.createElement('canvas');
    saida.width = largura;
    saida.height = altura;
    saida.getContext('2d')?.drawImage(canvas, 0, 0, largura, altura);
    onSalvar(saida.toDataURL('image/png'));
  };

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-md border-2 border-dashed border-input bg-card">
        <canvas
          ref={canvasRef}
          aria-label="Quadro para assinar com o dedo ou o mouse"
          className="block w-full cursor-crosshair touch-none"
          style={{ height: ALTURA_QUADRO }}
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          onPointerLeave={terminar}
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-muted-foreground/40" />
        {vazio && (
          <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
            Assine aqui com o dedo ou o mouse
          </span>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancelar && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={limpar} disabled={vazio}>
          <Eraser /> Limpar
        </Button>
        <Button type="button" size="sm" onClick={salvar} disabled={vazio}>
          Salvar assinatura
        </Button>
      </div>
    </div>
  );
}
