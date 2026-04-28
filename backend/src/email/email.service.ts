import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>("SMTP_HOST");
    const user = config.get<string>("SMTP_USER");
    const pass = config.get<string>("SMTP_PASS");
    this.fromAddress =
      config.get<string>("SMTP_FROM") ??
      "Escala Lagoinha <noreply@lagoinha.com>";

    if (!host || !user || !pass) {
      this.logger.warn(
        "SMTP não configurado — emails serão registrados apenas no console.",
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: config.get<number>("SMTP_PORT", 587),
      secure: config.get<string>("SMTP_SECURE") === "true",
      auth: { user, pass },
    });
  }

  // ─── Envio genérico ─────────────────────────────────────────────────────────
  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[EMAIL MOCK] Para: ${options.to} | Assunto: ${options.subject}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      this.logger.log(
        `Email enviado para ${options.to} — "${options.subject}"`,
      );
    } catch (err) {
      this.logger.error(`Falha ao enviar email para ${options.to}`, err);
    }
  }

  // ─── Templates ──────────────────────────────────────────────────────────────

  async sendCadastroPendenteVoluntario(
    to: string,
    nome: string,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject: "Cadastro recebido — aguardando aprovação",
      html: this.template({
        titulo: "Cadastro recebido!",
        corpo: `
          <p>Olá, <strong>${this.escape(nome)}</strong>!</p>
          <p>Seu cadastro no sistema <strong>Escala Lagoinha</strong> foi recebido com sucesso.</p>
          <p>Aguarde a aprovação do líder responsável pelo seu ministério. Você receberá um email assim que sua conta for analisada.</p>
          <p style="color:#94a3b8;font-size:13px;">Se você não solicitou este cadastro, ignore este email.</p>
        `,
      }),
    });
  }

  async sendCadastroAprovado(to: string, nome: string): Promise<void> {
    await this.sendMail({
      to,
      subject: "Conta aprovada — bem-vindo(a)!",
      html: this.template({
        titulo: "Conta aprovada! 🎉",
        corpo: `
          <p>Olá, <strong>${this.escape(nome)}</strong>!</p>
          <p>Sua conta no <strong>Escala Lagoinha</strong> foi <strong style="color:#34d399">aprovada</strong>!</p>
          <p>Você já pode fazer login e visualizar suas escalas, notificações e solicitar trocas.</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${this.appUrl()}/login"
               style="background:#5eead4;color:#0f172a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Acessar o sistema
            </a>
          </div>
        `,
      }),
    });
  }

  async sendCadastroRecusado(to: string, nome: string): Promise<void> {
    await this.sendMail({
      to,
      subject: "Cadastro não aprovado",
      html: this.template({
        titulo: "Cadastro não aprovado",
        corpo: `
          <p>Olá, <strong>${this.escape(nome)}</strong>!</p>
          <p>Infelizmente seu cadastro no <strong>Escala Lagoinha</strong> não foi aprovado pelo líder responsável.</p>
          <p>Em caso de dúvidas, entre em contato diretamente com o líder do ministério.</p>
        `,
      }),
    });
  }

  async sendNovoVoluntarioPendente(
    to: string,
    adminNome: string,
    voluntarioNome: string,
    voluntarioEmail: string,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject: `Novo voluntário aguardando aprovação: ${voluntarioNome}`,
      html: this.template({
        titulo: "Novo voluntário cadastrado",
        corpo: `
          <p>Olá, <strong>${this.escape(adminNome)}</strong>!</p>
          <p>Um novo voluntário se cadastrou e aguarda sua aprovação:</p>
          <table style="margin:16px 0;border-collapse:collapse;width:100%">
            <tr><td style="padding:8px;color:#94a3b8">Nome:</td><td style="padding:8px;color:#f1f5f9"><strong>${this.escape(voluntarioNome)}</strong></td></tr>
            <tr><td style="padding:8px;color:#94a3b8">Email:</td><td style="padding:8px;color:#f1f5f9">${this.escape(voluntarioEmail)}</td></tr>
          </table>
          <div style="text-align:center;margin:24px 0">
            <a href="${this.appUrl()}/aprovacao-voluntarios"
               style="background:#5eead4;color:#0f172a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Revisar cadastros
            </a>
          </div>
        `,
      }),
    });
  }

  async sendRecuperacaoSenha(
    to: string,
    nome: string,
    token: string,
  ): Promise<void> {
    const link = `${this.appUrl()}/redefinir-senha?token=${token}`;
    await this.sendMail({
      to,
      subject: "Recuperação de senha",
      html: this.template({
        titulo: "Redefinir sua senha",
        corpo: `
          <p>Olá, <strong>${this.escape(nome)}</strong>!</p>
          <p>Recebemos uma solicitação de redefinição de senha para sua conta no <strong>Escala Lagoinha</strong>.</p>
          <p>Clique no botão abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${link}"
               style="background:#5eead4;color:#0f172a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Redefinir senha
            </a>
          </div>
          <p style="color:#94a3b8;font-size:13px;">Se você não solicitou isso, ignore este email — sua senha não será alterada.</p>
          <p style="color:#64748b;font-size:12px;word-break:break-all">Ou copie este link: ${link}</p>
        `,
      }),
    });
  }

  async sendEscalaCriada(params: {
    to: string;
    nome: string;
    eventName: string;
    eventDateTimeLabel: string;
  }): Promise<void> {
    await this.sendMail({
      to: params.to,
      subject: `Nova escala: ${params.eventName}`,
      html: this.template({
        titulo: "Você foi escalado(a)",
        corpo: `
          <p>Olá, <strong>${this.escape(params.nome)}</strong>!</p>
          <p>Uma nova escala foi criada para você:</p>
          <p><strong>${this.escape(params.eventName)}</strong><br/>${this.escape(params.eventDateTimeLabel)}</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${this.appUrl()}/minhas-escalas"
               style="background:#5eead4;color:#0f172a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Ver minhas escalas
            </a>
          </div>
        `,
      }),
    });
  }

  async sendLembreteEscala(params: {
    to: string;
    nome: string;
    eventName: string;
    eventDateTimeLabel: string;
  }): Promise<void> {
    await this.sendMail({
      to: params.to,
      subject: `Lembrete de escala: ${params.eventName}`,
      html: this.template({
        titulo: "Lembrete de escala",
        corpo: `
          <p>Olá, <strong>${this.escape(params.nome)}</strong>!</p>
          <p>Este é um lembrete da sua escala:</p>
          <p><strong>${this.escape(params.eventName)}</strong><br/>${this.escape(params.eventDateTimeLabel)}</p>
          <p>Desejamos um excelente serviço! 🙌</p>
        `,
      }),
    });
  }

  async sendSolicitacaoTrocaRecebida(params: {
    to: string;
    nome: string;
    requesterName: string;
    eventName: string;
  }): Promise<void> {
    await this.sendMail({
      to: params.to,
      subject: `Solicitação de troca recebida (${params.eventName})`,
      html: this.template({
        titulo: "Nova solicitação de troca",
        corpo: `
          <p>Olá, <strong>${this.escape(params.nome)}</strong>!</p>
          <p><strong>${this.escape(params.requesterName)}</strong> solicitou uma troca de escala com você no evento <strong>${this.escape(params.eventName)}</strong>.</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${this.appUrl()}/trocas/recebidas"
               style="background:#5eead4;color:#0f172a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Avaliar solicitação
            </a>
          </div>
        `,
      }),
    });
  }

  async sendTrocaAprovada(params: {
    to: string;
    nome: string;
    requestedVolunteerName: string;
  }): Promise<void> {
    await this.sendMail({
      to: params.to,
      subject: "Troca aprovada",
      html: this.template({
        titulo: "Sua troca foi aprovada",
        corpo: `
          <p>Olá, <strong>${this.escape(params.nome)}</strong>!</p>
          <p>A sua solicitação de troca foi aprovada por <strong>${this.escape(params.requestedVolunteerName)}</strong>.</p>
          <p>Confira suas escalas atualizadas no sistema.</p>
        `,
      }),
    });
  }

  async sendTrocaRecusada(params: {
    to: string;
    nome: string;
    requestedVolunteerName: string;
  }): Promise<void> {
    await this.sendMail({
      to: params.to,
      subject: "Troca recusada",
      html: this.template({
        titulo: "Sua troca foi recusada",
        corpo: `
          <p>Olá, <strong>${this.escape(params.nome)}</strong>!</p>
          <p><strong>${this.escape(params.requestedVolunteerName)}</strong> recusou a sua solicitação de troca.</p>
          <p>Você pode criar uma nova solicitação com outro voluntário.</p>
        `,
      }),
    });
  }

  async sendNovoLiderCriado(params: {
    to: string;
    masterAdminNome: string;
    leaderNome: string;
    leaderEmail: string;
    churchName?: string;
  }): Promise<void> {
    await this.sendMail({
      to: params.to,
      subject: `Novo líder criado: ${params.leaderNome}`,
      html: this.template({
        titulo: "Novo líder criado",
        corpo: `
          <p>Olá, <strong>${this.escape(params.masterAdminNome)}</strong>!</p>
          <p>Um novo líder foi criado na unidade <strong>${this.escape(params.churchName ?? "sua igreja")}</strong>:</p>
          <p><strong>${this.escape(params.leaderNome)}</strong><br/>${this.escape(params.leaderEmail)}</p>
        `,
      }),
    });
  }

  async sendConviteCadastro(params: {
    to: string;
    nome: string;
    inviteUrl: string;
    churchName: string;
  }): Promise<void> {
    await this.sendMail({
      to: params.to,
      subject: `Convite de cadastro — ${params.churchName}`,
      html: this.template({
        titulo: "Convite para cadastro",
        corpo: `
          <p>Olá, <strong>${this.escape(params.nome)}</strong>!</p>
          <p>Seu link de convite para cadastro na igreja <strong>${this.escape(params.churchName)}</strong> foi gerado:</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${params.inviteUrl}"
               style="background:#5eead4;color:#0f172a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Abrir convite
            </a>
          </div>
          <p style="color:#64748b;font-size:12px;word-break:break-all">Link direto: ${params.inviteUrl}</p>
        `,
      }),
    });
  }

  async sendGenericNotification(params: {
    to: string;
    nome: string;
    title: string;
    message: string;
    ctaUrl?: string;
    ctaLabel?: string;
  }): Promise<void> {
    const cta =
      params.ctaUrl && params.ctaLabel
        ? `<div style="text-align:center;margin:24px 0">
            <a href="${params.ctaUrl}"
               style="background:#5eead4;color:#0f172a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              ${this.escape(params.ctaLabel)}
            </a>
          </div>`
        : "";

    await this.sendMail({
      to: params.to,
      subject: params.title,
      html: this.template({
        titulo: params.title,
        corpo: `
          <p>Olá, <strong>${this.escape(params.nome)}</strong>!</p>
          <p>${this.escape(params.message)}</p>
          ${cta}
        `,
      }),
    });
  }

  // ─── Template base ───────────────────────────────────────────────────────────
  private template({
    titulo,
    corpo,
  }: {
    titulo: string;
    corpo: string;
  }): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#1e293b;border-radius:12px;border:1px solid rgba(255,255,255,0.08);overflow:hidden">
        <tr>
          <td style="background:linear-gradient(135deg,#5eead4,#0891b2);padding:28px 32px;text-align:center">
            <span style="color:#0f172a;font-size:20px;font-weight:700;letter-spacing:-0.5px">⛪ Escala Lagoinha</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 16px;color:#f1f5f9;font-size:22px;font-weight:700">${titulo}</h1>
            <div style="color:#cbd5e1;font-size:15px;line-height:1.7">${corpo}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center">
            <p style="margin:0;color:#475569;font-size:12px">© ${new Date().getFullYear()} Escala Lagoinha. Este é um email automático.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private escape(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private appUrl(): string {
    return this.config.get<string>("APP_URL") ?? "http://localhost:5173";
  }
}
