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
    const smtpConfig = {
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
        minVersion: 'TLSv1.2',
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      pool: false,
      logger: process.env.NODE_ENV === 'development',
      debug: process.env.NODE_ENV === 'development',
      ignoreTLS: false,
    };
    this.transporter = nodemailer.createTransport(smtpConfig as nodemailer.TransportOptions);
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
    try {
      await this.transporter.sendMail({
        from: remetente,
        to: destinatario,
        subject: assunto,
        html,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('Connection timeout')) {
          throw new Error('Timeout ao conectar com o servidor de e-mail. Verifique as configurações SMTP e a conectividade de rede.');
        }
        if (error.message.includes('ECONNREFUSED')) {
          throw new Error('Não foi possível conectar ao servidor SMTP. Verifique o host e a porta configurados.');
        }
        if (error.message.includes('EAUTH')) {
          throw new Error('Falha na autenticação SMTP. Verifique o usuário e senha configurados.');
        }
      }
      throw error;
    }
  }

  /**
   * Envia e-mail de boas-vindas para um novo usuário.
   */
  async enviarEmailBoasVindas(destinatario: string, nome: string): Promise<void> {
    const assunto = 'Bem-vindo à ChekAI!';
    const html = this.getTemplateBoasVindas(nome);
    await this.enviarEmail(destinatario, assunto, html);
  }

  /**
   * Envia e-mail com código OTP para login.
   */
  async enviarEmailOTP(destinatario: string, nome: string, codigoOTP: string): Promise<void> {
    const assunto = 'Código de acesso - ChekAI';
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

