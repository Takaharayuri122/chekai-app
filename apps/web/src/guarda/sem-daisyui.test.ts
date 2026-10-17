import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { encontrarClassesDaisy } from '../../scripts/daisyui/migrar-conteudo';

const RAIZ = path.resolve(__dirname, '..');

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === 'shadcn' ? [] : arquivos(caminho);
    return /\.tsx?$/.test(nome) && !nome.endsWith('.test.ts') ? [caminho] : [];
  });
}

describe('sem DaisyUI', () => {
  it.fails('nenhum arquivo em src/ usa classes DaisyUI', () => {
    const ocorrencias = arquivos(RAIZ)
      .map((arq) => ({ arq: path.relative(RAIZ, arq), classes: encontrarClassesDaisy(readFileSync(arq, 'utf8')) }))
      .filter((o) => o.classes.length > 0);
    expect(ocorrencias).toEqual([]);
  });
});
