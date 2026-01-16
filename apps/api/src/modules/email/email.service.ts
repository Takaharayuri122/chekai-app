import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Serviço responsável pelo envio de e-mails via SMTP.
 */
@Injectable()
export class EmailService {
  private transporter: Transporter;
  private readonly templatesPath: string;

  constructor(private readonly configService: ConfigService) {
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secureEnv = this.configService.get<string>('SMTP_SECURE');
    const secure = secureEnv === 'true' || secureEnv === '1';
    const isPort465 = port === 465;
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port,
      secure: secure || isPort465,
      requireTLS: !secure && !isPort465 && port === 587,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    this.templatesPath = this.resolveTemplatesPath();
  }

  /**
   * Resolve o caminho dos templates considerando desenvolvimento e produção.
   */
  private resolveTemplatesPath(): string {
    const distPath = path.join(__dirname, 'templates');
    if (fs.existsSync(distPath)) {
      return distPath;
    }
    const srcPath = path.join(__dirname, '..', '..', '..', 'src', 'modules', 'email', 'templates');
    if (fs.existsSync(srcPath)) {
      return srcPath;
    }
    throw new Error('Templates de e-mail não encontrados. Verifique se os arquivos foram copiados durante o build.');
  }

  /**
   * Envia um e-mail genérico.
   */
  async enviarEmail(destinatario: string, assunto: string, html: string): Promise<void> {
    const smtpFrom = this.configService.get<string>('SMTP_FROM');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const remetente = smtpFrom || smtpUser || '';
    await this.transporter.sendMail({
      from: remetente,
      to: destinatario,
      subject: assunto,
      html,
    });
  }

  /**
   * Envia e-mail de boas-vindas para um novo usuário.
   */
  async enviarEmailBoasVindas(destinatario: string, nome: string): Promise<void> {
    const assunto = 'Bem-vindo à Meta App!';
    const html = this.getTemplateBoasVindas(nome);
    await this.enviarEmail(destinatario, assunto, html);
  }

  /**
   * Envia e-mail com código OTP para login.
   */
  async enviarEmailOTP(destinatario: string, nome: string, codigoOTP: string): Promise<void> {
    const assunto = 'Código de acesso - Meta App';
    const html = this.getTemplateOTP(nome, codigoOTP);
    await this.enviarEmail(destinatario, assunto, html);
  }

  /**
   * Carrega um template HTML e substitui as variáveis.
   */
  private carregarTemplate(nomeArquivo: string, variaveis: Record<string, string>): string {
    const caminhoTemplate = path.join(this.templatesPath, nomeArquivo);
    let template = fs.readFileSync(caminhoTemplate, 'utf-8');
    Object.keys(variaveis).forEach((chave) => {
      const regex = new RegExp(`{{${chave}}}`, 'g');
      template = template.replace(regex, variaveis[chave]);
    });
    return template;
  }

  /**
   * Retorna o template HTML de boas-vindas.
   */
  private getTemplateBoasVindas(nome: string): string {
    return this.carregarTemplate('boas-vindas.html', { nome });
  }

  /**
   * Retorna o template HTML com código OTP.
   */
  private getTemplateOTP(nome: string, codigoOTP: string): string {
    return this.carregarTemplate('otp.html', { nome, codigoOTP });
  }
}

