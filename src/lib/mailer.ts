import { Resend } from "resend";

// Envio de e-mail via API HTTPS do Resend, em vez de SMTP. Escolhido porque
// muitas plataformas de hospedagem (ex: Railway, nos planos gratuitos/hobby)
// bloqueiam portas SMTP de saída (25/465/587) para prevenir spam, o que fazia
// o envio via SMTP travar em timeout. A API do Resend funciona por HTTPS
// normal, então não depende dessas portas.
let resendClient: Resend | null = null;
let isConfigured = false;

function getClient(): Resend | null {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  resendClient = new Resend(apiKey);
  isConfigured = true;
  return resendClient;
}

export function isMailerConfigured(): boolean {
  getClient();
  return isConfigured;
}

interface SendMailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envia um e-mail via Resend. Lança erro se o serviço não estiver configurado
 * ou se o envio falhar (deixa o chamador decidir como reportar isso ao usuário).
 */
export async function sendMail({ to, subject, html }: SendMailParams): Promise<void> {
  const client = getClient();
  if (!client) {
    throw new Error("Serviço de e-mail não configurado no servidor.");
  }

  const fromName = process.env.MAIL_FROM_NAME || "Sistema de Pedidos";
  // onboarding@resend.dev é o domínio de teste do Resend: só entrega e-mails
  // para o endereço cadastrado na própria conta Resend. Para enviar a
  // clientes/fábricas reais, configure MAIL_FROM_EMAIL com um endereço de um
  // domínio verificado na conta (Resend > Domains).
  const fromAddress = process.env.MAIL_FROM_EMAIL || "onboarding@resend.dev";

  const { error } = await client.emails.send({
    from: `${fromName} <${fromAddress}>`,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message || "Falha ao enviar e-mail via Resend.");
  }
}
