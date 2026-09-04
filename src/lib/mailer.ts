// Envio de e-mail via API HTTPS do Brevo (antigo Sendinblue), em vez de SMTP.
// Escolhido porque muitas plataformas de hospedagem (ex: Railway, nos planos
// gratuitos/hobby) bloqueiam portas SMTP de saída (25/465/587) para prevenir
// spam, o que fazia o envio via SMTP travar em timeout. A API do Brevo
// funciona por HTTPS normal, então não depende dessas portas, e seu plano
// gratuito permite verificar um único e-mail remetente (sem precisar de
// domínio próprio) e enviar para qualquer destinatário.
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function isConfigured(): boolean {
  return !!process.env.BREVO_API_KEY;
}

export function isMailerConfigured(): boolean {
  return isConfigured();
}

interface SendMailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envia um e-mail via Brevo. Lança erro se o serviço não estiver configurado
 * ou se o envio falhar (deixa o chamador decidir como reportar isso ao usuário).
 */
export async function sendMail({ to, subject, html }: SendMailParams): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("Serviço de e-mail não configurado no servidor.");
  }

  const fromName = process.env.MAIL_FROM_NAME || "Sistema de Pedidos";
  // Precisa ser um e-mail verificado como "sender" na conta Brevo
  // (Settings > Senders, Domains & Dedicated IPs > Senders).
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("MAIL_FROM_EMAIL não configurado no servidor.");
  }

  // Timeout curto para não travar a requisição por minutos caso a API do
  // Brevo fique inacessível por algum motivo (mesma lição aprendida com o
  // travamento do SMTP antes desta migração).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Tempo limite excedido ao conectar com o serviço de e-mail.");
    }
    throw new Error(error?.message || "Falha de rede ao enviar e-mail via Brevo.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let message = `Falha ao enviar e-mail via Brevo (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // Corpo de erro não era JSON válido; mantém a mensagem genérica.
    }
    throw new Error(message);
  }
}
