import type { Email } from "./index";

/** E-mails transactionnels via l'API Resend. Expéditeur : EMAIL_FROM (domaine vérifié chez Resend). */
export const resendEmail: Email = {
  async send(message) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "RushXP <noreply@rushxp.re>", to: [message.to], subject: message.subject, text: message.text }),
    });
    const json = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) throw new Error(`Resend : ${json.message ?? res.status}`);
    return { id: json.id ?? "" };
  },
};
