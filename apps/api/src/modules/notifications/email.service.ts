import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

export class EmailService {
  private transporter = (() => {
    if (env.EMAIL_PROVIDER !== "smtp" || !env.SMTP_HOST) return null;

    const options: {
      host: string;
      port: number;
      secure?: boolean;
      auth?: { user: string; pass: string };
    } = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465
    };

    if (env.SMTP_USER && env.SMTP_PASS) {
      options.auth = { user: env.SMTP_USER, pass: env.SMTP_PASS };
    }

    return nodemailer.createTransport(options);
  })();

  async sendProcessingFailure(to: string, fileName: string, reason: string) {
    if (!this.transporter || !env.SMTP_FROM) {
      logger.debug({ fileName }, "Email provider disabled; skipping failure notification");
      return;
    }

    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: "Certificate extraction failed",
      text: `Processing failed for ${fileName}.\n\nReason: ${reason}`
    });
  }
}

export const emailService = new EmailService();
