import nodemailer from "nodemailer";
import { env } from "#env";

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

export async function sendAlertEmail(to: string, subject: string, text: string) {
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
}
