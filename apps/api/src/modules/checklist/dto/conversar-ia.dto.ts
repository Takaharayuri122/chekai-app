import { IsArray, IsEnum, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum RoleMensagem {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export class MensagemChatDto {
  @ApiProperty({ enum: RoleMensagem })
  @IsEnum(RoleMensagem)
  role: RoleMensagem;

  @ApiProperty({ description: 'Conteúdo da mensagem' })
  @IsString()
  @IsNotEmpty()
  conteudo: string;
}

/**
 * DTO para conversa com IA na geração de checklist.
 */
export class ConversarIaDto {
  @ApiProperty({ type: [MensagemChatDto], description: 'Histórico de mensagens da conversa' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MensagemChatDto)
  mensagens: MensagemChatDto[];
}

export type EtapaConversaIa = 'coletando_informacoes' | 'gerando' | 'finalizado';


export interface RespostaConversaIa {
  resposta: string;
  etapa: EtapaConversaIa;
  checklistGerado?: { templateId: string };
}
