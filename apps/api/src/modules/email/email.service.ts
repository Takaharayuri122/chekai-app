import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

type EmailProvider = 'smtp' | 'sendgrid' | 'mailersend' | 'ethereal';

/**
 * Serviço responsável pelo envio de e-mails via SMTP, SendGrid ou Ethereal (dev).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: Transporter;
  private readonly templatesPath: string;
  private readonly provider: EmailProvider;
  private etherealReady: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {
    const configuredProvider = this.configService.get<string>('EMAIL_PROVIDER');
    const nodeEnv = this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV;
    const isDev = !nodeEnv || nodeEnv === 'development';
    this.provider = (configuredProvider as EmailProvider) || (isDev ? 'ethereal' : 'smtp');
    this.templatesPath = this.resolveTemplatesPath();
    if (this.provider === 'smtp') {
      this.initializeSmtp();
    } else if (this.provider === 'ethereal') {
      this.etherealReady = this.initializeEthereal();
    }
  }

  /**
   * Inicializa o transporter SMTP.
   */
  private initializeSmtp(): void {
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
  }

  /**
   * Inicializa o transporter Ethereal Mail para desenvolvimento.
   */
  private async initializeEthereal(): Promise<void> {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.logger.log(`Ethereal Mail configurado - Conta: ${testAccount.user}`);
    } catch (error) {
      this.logger.warn('Falha ao criar conta Ethereal. E-mails não serão enviados em dev.');
    }
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
    if (this.provider === 'mailersend') {
      await this.enviarEmailMailerSend(destinatario, assunto, html);
    } else if (this.provider === 'sendgrid') {
      await this.enviarEmailSendGrid(destinatario, assunto, html);
    } else if (this.provider === 'ethereal') {
      await this.enviarEmailEthereal(destinatario, assunto, html);
    } else {
      await this.enviarEmailSmtp(destinatario, assunto, html);
    }
  }

  /**
   * Envia e-mail via SMTP.
   */
  private async enviarEmailSmtp(destinatario: string, assunto: string, html: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('Transporter SMTP não inicializado.');
    }
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
   * Envia e-mail via Ethereal Mail (desenvolvimento) e loga a URL de preview.
   */
  private async enviarEmailEthereal(destinatario: string, assunto: string, html: string): Promise<void> {
    if (this.etherealReady) {
      await this.etherealReady;
    }
    if (!this.transporter) {
      this.logger.warn(`[Ethereal] E-mail não enviado (transporter indisponível): "${assunto}" -> ${destinatario}`);
      return;
    }
    try {
      const info = await this.transporter.sendMail({
        from: 'ChekAI <noreply@chekai.com>',
        to: destinatario,
        subject: assunto,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        this.logger.log(`Preview do e-mail: ${previewUrl}`);
      }
    } catch (error) {
      this.logger.warn(`[Ethereal] Falha ao enviar e-mail: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Envia e-mail via SendGrid Web API.
   */
  private async enviarEmailSendGrid(destinatario: string, assunto: string, html: string): Promise<void> {
    const sendgridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (!sendgridApiKey) {
      throw new Error('SENDGRID_API_KEY não configurada. Configure a variável de ambiente.');
    }
    const sendgridFrom = this.configService.get<string>('SENDGRID_FROM') || this.configService.get<string>('SMTP_FROM');
    if (!sendgridFrom) {
      throw new Error('SENDGRID_FROM ou SMTP_FROM não configurado. Configure o e-mail remetente.');
    }
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: destinatario }],
            },
          ],
          from: { email: sendgridFrom },
          subject: assunto,
          content: [
            {
              type: 'text/html',
              value: html,
            },
          ],
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Erro ao enviar e-mail via SendGrid: ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.errors && errorData.errors.length > 0) {
            errorMessage = `Erro ao enviar e-mail via SendGrid: ${errorData.errors.map((e: { message: string }) => e.message).join(', ')}`;
          }
        } catch {
          errorMessage = `Erro ao enviar e-mail via SendGrid: ${errorText || response.statusText}`;
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro desconhecido ao enviar e-mail via SendGrid');
    }
  }

  /**
   * Envia e-mail via MailerSend HTTP API.
   */
  private async enviarEmailMailerSend(destinatario: string, assunto: string, html: string): Promise<void> {
    const apiKey = this.configService.get<string>('MAILERSEND_API_KEY');
    if (!apiKey) {
      throw new Error('MAILERSEND_API_KEY não configurada. Configure a variável de ambiente.');
    }
    const fromEmail = this.configService.get<string>('MAILERSEND_FROM') || this.configService.get<string>('SMTP_FROM');
    if (!fromEmail) {
      throw new Error('MAILERSEND_FROM ou SMTP_FROM não configurado. Configure o e-mail remetente.');
    }
    const fromName = this.configService.get<string>('MAILERSEND_FROM_NAME') || 'ChekAI';
    try {
      const response = await fetch('https://api.mailersend.com/v1/email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: { email: fromEmail, name: fromName },
          to: [{ email: destinatario }],
          subject: assunto,
          html,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Erro ao enviar e-mail via MailerSend: ${response.status} ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = `Erro ao enviar e-mail via MailerSend: ${errorData.message}`;
          }
        } catch {
          errorMessage = `Erro ao enviar e-mail via MailerSend: ${errorText || response.statusText}`;
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro desconhecido ao enviar e-mail via MailerSend');
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
   * Envia e-mail de convite para acesso à plataforma.
   */
  async enviarEmailConvite(destinatario: string, nome: string, linkConvite: string): Promise<void> {
    const assunto = 'Convite de acesso – ChekAI';
    const html = this.carregarTemplate('convite.html', { nome, linkConvite });
    await this.enviarEmail(destinatario, assunto, html);
  }

  /**
   * Envia e-mail de confirmação para quem entrou na lista de espera.
   */
  async enviarEmailListaEspera(destinatario: string): Promise<void> {
    const assunto = 'Você está na lista de espera – ChekAI';
    const html = this.getTemplateListaEspera(destinatario);
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

  private getTemplateBoasVindas(nome: string): string {
    return this.carregarTemplate('boas-vindas.html', { nome });
  }

  private getTemplateOTP(nome: string, codigoOTP: string): string {
    return this.carregarTemplate('otp.html', { nome, codigoOTP });
  }

  private getTemplateListaEspera(email: string): string {
    return this.carregarTemplate('lista-espera.html', { email });
  }
}
