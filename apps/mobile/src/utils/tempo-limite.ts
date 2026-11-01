export class TempoLimiteError extends Error {
  constructor(ms: number) {
    super(`Tempo limite de ${ms}ms excedido`);
    this.name = 'TempoLimiteError';
  }
}

/** Rejeita com TempoLimiteError se a promessa não resolver em `ms`. */
export function comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TempoLimiteError(ms)), ms);
    promessa.then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (erro) => {
        clearTimeout(timer);
        reject(erro);
      },
    );
  });
}
