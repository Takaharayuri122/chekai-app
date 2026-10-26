import { getMetadataArgsStorage } from 'typeorm';
import { AuditoriaEnvioRelatorio } from './auditoria-envio-relatorio.entity';

describe('AuditoriaEnvioRelatorio', () => {
  it('mantém o histórico sem o usuário quando ele é excluído (ON DELETE SET NULL)', () => {
    const relacao = getMetadataArgsStorage().relations.find(
      (r) => r.target === AuditoriaEnvioRelatorio && r.propertyName === 'enviadoPor',
    );
    expect(relacao?.options.onDelete).toBe('SET NULL');
  });
});
