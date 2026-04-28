import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  sendEmailMock(params: {
    toEmail?: string | null;
    toName: string;
    subject: string;
    message: string;
  }) {
    this.logger.log(
      `[EMAIL_MOCK] to=${params.toEmail ?? "sem-email"} name=${params.toName} subject="${params.subject}" message="${params.message}"`,
    );
  }

  sendWhatsappMockFuture(params: {
    toPhone?: string | null;
    toName: string;
    message: string;
  }) {
    // Preparado para futura integração real com WhatsApp provider.
    this.logger.log(
      `[WHATSAPP_MOCK_READY] to=${params.toPhone ?? "sem-telefone"} name=${params.toName} message="${params.message}"`,
    );
  }
}
