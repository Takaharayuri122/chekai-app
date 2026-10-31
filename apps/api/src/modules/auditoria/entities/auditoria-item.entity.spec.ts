import { getMetadataArgsStorage } from 'typeorm';
import { AuditoriaItem } from './auditoria-item.entity';

describe('AuditoriaItem - coluna resposta', () => {
  it('não limita o tamanho, pois guarda a imagem da assinatura e textos livres', () => {
    const coluna = getMetadataArgsStorage().columns.find(
      (c) => c.target === AuditoriaItem && c.propertyName === 'resposta',
    );
    expect(coluna?.options.type).toBe('text');
    expect(coluna?.options.length).toBeUndefined();
  });
});
