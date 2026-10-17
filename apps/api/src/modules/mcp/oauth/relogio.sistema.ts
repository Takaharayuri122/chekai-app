import { Injectable } from '@nestjs/common';
import { RelogioPorta } from './oauth.types';

@Injectable()
export class RelogioSistema extends RelogioPorta {
  agora(): Date {
    return new Date();
  }
}
