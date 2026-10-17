import * as crypto from 'crypto';
import { SegredoCripto } from './segredo.cripto';

jest.mock('crypto', () => {
  const atual = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    ...atual,
    randomInt: jest.fn(() => 100042),
  };
});

describe('SegredoCripto', () => {
  it('gera o OTP de seis dígitos com crypto.randomInt', () => {
    const mathRandom = jest.spyOn(Math, 'random');

    expect(new SegredoCripto().otp()).toBe('100042');
    expect(crypto.randomInt).toHaveBeenCalledWith(100000, 1000000);
    expect(mathRandom).not.toHaveBeenCalled();

    mathRandom.mockRestore();
  });
});
