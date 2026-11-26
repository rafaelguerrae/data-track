import nodemailer from "nodemailer";
import { env } from "#env";

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  // Sem isso o padrão é esperar minutos: com a porta SMTP bloqueada, a rota HTTP ficaria pendurada.
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

export async function sendEmail(to: string, subject: string, text: string) {
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
}

export const sendAlertEmail = sendEmail;
