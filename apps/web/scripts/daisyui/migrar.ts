import { readFileSync, writeFileSync } from 'node:fs';
import { migrarConteudo } from './migrar-conteudo';

const arquivos = process.argv.slice(2);
let alterados = 0;
for (const arquivo of arquivos) {
  const original = readFileSync(arquivo, 'utf8');
  const migrado = migrarConteudo(original);
  if (migrado !== original) {
    writeFileSync(arquivo, migrado);
    alterados += 1;
    console.log(`migrado: ${arquivo}`);
  }
}
console.log(`${alterados} de ${arquivos.length} arquivo(s) alterado(s).`);
