/**
 * Account emails (verification, password reset) over SMTP — e.g. a mailbox created in Hestia
 * (noreply@codiosity.com). Plain text only: no tracking pixels, no remote images, no HTML.
 * Links carry the token in the URL FRAGMENT (#token=…), which browsers never send to a server,
 * so it does not end up in access logs or Referer headers.
 */
import nodemailer from 'nodemailer';

export interface Mailer {
	send(message: { to: string; subject: string; text: string }): Promise<void>;
}

export interface MailSettings {
	host: string;
	port: number;
	/** true = implicit TLS (port 465); false = STARTTLS (port 587, required). */
	secure: boolean;
	user: string;
	password: string;
	/** e.g. "CV Maker <noreply@codiosity.com>" */
	from: string;
}

export function smtpMailer(settings: MailSettings): Mailer {
	const transport = nodemailer.createTransport({
		host: settings.host,
		port: settings.port,
		secure: settings.secure,
		requireTLS: !settings.secure,
		auth: { user: settings.user, pass: settings.password },
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 20_000
	});
	return {
		async send(message) {
			await transport.sendMail({ from: settings.from, ...message });
		}
	};
}

type Locale = 'id' | 'en';

const TEXT = {
	verify: {
		id: {
			subject: 'Konfirmasi email akun CV Maker',
			body: (link: string) =>
				`Halo,\n\nKlik tautan ini untuk mengonfirmasi email akun CV Maker kamu:\n${link}\n\nTautan berlaku 24 jam. Jika kamu tidak membuat akun, abaikan email ini.\n\nCV Maker oleh Codiosity`
		},
		en: {
			subject: 'Confirm your CV Maker email',
			body: (link: string) =>
				`Hello,\n\nOpen this link to confirm the email of your CV Maker account:\n${link}\n\nThe link is valid for 24 hours. If you did not create an account, ignore this email.\n\nCV Maker by Codiosity`
		}
	},
	reset: {
		id: {
			subject: 'Atur ulang kata sandi CV Maker',
			body: (link: string) =>
				`Halo,\n\nKlik tautan ini untuk membuat kata sandi baru:\n${link}\n\nTautan berlaku 1 jam dan hanya bisa dipakai sekali. Jika kamu tidak memintanya, abaikan email ini — kata sandimu tidak berubah.\n\nCV Maker oleh Codiosity`
		},
		en: {
			subject: 'Reset your CV Maker password',
			body: (link: string) =>
				`Hello,\n\nOpen this link to choose a new password:\n${link}\n\nThe link is valid for 1 hour and works once. If you did not ask for it, ignore this email — your password has not changed.\n\nCV Maker by Codiosity`
		}
	}
} as const;

export function accountEmail(
	kind: 'verify' | 'reset',
	locale: Locale,
	link: string
): { subject: string; text: string } {
	const text = TEXT[kind][locale];
	return { subject: text.subject, text: text.body(link) };
}
