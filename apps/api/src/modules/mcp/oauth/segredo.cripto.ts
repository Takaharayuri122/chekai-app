import { randomBytes, randomInt, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { SegredoPorta } from './oauth.types';

@Injectable()
export class SegredoCripto extends SegredoPorta {
  otp(): string {
    return randomInt(100000, 1000000).toString();
  }

  opaco(): string {
    return randomBytes(32).toString('base64url');
  }

  uuid(): string {
    return randomUUID();
  }
}
