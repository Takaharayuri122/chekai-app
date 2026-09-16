import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CheckinService } from './checkin.service';

@Injectable()
export class CheckinAutoCheckoutJob {
  private readonly logger = new Logger(CheckinAutoCheckoutJob.name);

  constructor(private readonly checkinService: CheckinService) {}

  @Cron('0 */15 * * * *')
  async encerrarExpirados(): Promise<void> {
    const quantidade = await this.checkinService.encerrarCheckinsExpirados();
    if (quantidade > 0) {
      this.logger.log(`${quantidade} check-in(s) encerrado(s) automaticamente após 12h.`);
    }
  }
}
