import nodemailer, { Transporter } from "nodemailer";

let transporter: Transporter | null = null;
let isConfigured = false;

/**
 * Cria (uma única vez) o transporter SMTP a partir das variáveis de ambiente.
 * Se as credenciais não estiverem configuradas, o envio de e-mail fica
 * desabilitado e as rotas que dependem disso devem responder com erro claro
 * em vez de falhar silenciosamente.
 */
function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // 465 usa SSL direto; 587/25 usam STARTTLS
    auth: {
      user: SMTP_USER,
      // Senhas de app do Gmail costumam vir copiadas com espaços (ex: "abcd
      // efgh ijkl mnop"); removê-los evita falha de autenticação silenciosa.
      pass: SMTP_PASS.replace(/\s+/g, ""),
    },
    // Sem esses limites, uma conexão bloqueada (ex: porta SMTP indisponível
    // na plataforma de hospedagem) trava a requisição por minutos até o
    // timeout padrão do sistema operacional. Falhar rápido aqui garante que
    // o usuário recebe uma resposta de erro em segundos, não em minutos.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
  isConfigured = true;

  return transporter;
}

export function isMailerConfigured(): boolean {
  getTransporter();
  return isConfigured;
}

interface SendMailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envia um e-mail via SMTP. Lança erro se o serviço não estiver configurado
 * ou se o envio falhar (deixa o chamador decidir como reportar isso ao usuário).
 */
export async function sendMail({ to, subject, html }: SendMailParams): Promise<void> {
  const client = getTransporter();
  if (!client) {
    throw new Error("Serviço de e-mail não configurado no servidor.");
  }

  const fromName = process.env.SMTP_FROM_NAME || "Sistema de Pedidos";
  const fromAddress = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  await client.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    html,
  });
}
