import { comTempoLimite, TempoLimiteError } from '../../utils/tempo-limite';

describe('comTempoLimite', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolve antes do limite', async () => {
    const r = comTempoLimite(Promise.resolve('ok'), 1000);
    await expect(r).resolves.toBe('ok');
  });

  it('rejeita com TempoLimiteError ao estourar', async () => {
    const r = comTempoLimite(new Promise<string>(() => {}), 1000);
    const assercao = expect(r).rejects.toBeInstanceOf(TempoLimiteError);
    jest.advanceTimersByTime(1000);
    await assercao;
  });
});
