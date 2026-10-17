import { randomBytes, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { SegredoPorta } from './oauth.types';

@Injectable()
export class SegredoCripto extends SegredoPorta {
  otp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  opaco(): string {
    return randomBytes(32).toString('base64url');
  }

  uuid(): string {
    return randomUUID();
  }
}
