/**
 * The words printed ON the cover letter, in the LETTER's language (like render/labels.ts for the CV).
 * Formal Indonesian follows the usual "surat lamaran kerja" layout; English follows a standard
 * business letter. Kept free of filler words the wordiness check flags ("merupakan", "di mana",
 * "sangat", "untuk dapat", "dengan baik"): text written from the CV must rate as concise.
 */
import type { LetterAttachment, LetterSource, Locale } from '../schema/types';

export interface LetterPhrases {
	/** "Kepada Yth." line above the recipient; '' in English. */
	to: string;
	defaultRecipient: string;
	/** Last recipient line when there is no address. */
	noAddress: string;
	salutation: (recipient: string) => string;
	closing: string;
	attachmentLabel: string;
	subjectLabel: string;
	attachmentCount: (count: number) => string;
	subject: (position: string) => string;
	opening: (
		source: LetterSource | undefined,
		detail: string,
		position: string,
		company: string
	) => string;
	identityIntro: string;
	identity: {
		name: string;
		birth: string;
		education: string;
		address: string;
		phone: string;
		email: string;
	};
	attachmentsIntro: string;
	attachments: Record<LetterAttachment, string>;
	immediate: string;
	relocate: (company: string) => string;
	contact: (phone: string, email: string) => string;
	closingParagraph: (company: string) => string;
	/** Lists: "a, b, dan c". */
	and: string;
	education: {
		graduate: (degree: string, institution: string) => string;
		student: (degree: string, institution: string) => string;
		gpa: (label: string, value: string) => string;
	};
	experience: (role: string, company: string, internship: boolean) => string;
	organization: (role: string, name: string) => string;
	project: (name: string, verbPhrase: string) => string;
	/** Sentence after an experience/organisation: "Di sana, saya " + a bullet that starts with a verb. */
	detail: (verbPhrase: string) => string;
	certification: (name: string, issuer: string) => string;
	award: (title: string, issuer: string) => string;
	skills: Record<'hard' | 'tools' | 'soft', (items: string) => string>;
	motivationExamples: (company: string, position: string, skill: string) => string[];
	email: { subject: (position: string, name: string) => string; attached: string };
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

const listId = (items: readonly string[]) =>
	items.length <= 1
		? (items[0] ?? '')
		: `${items.slice(0, -1).join(', ')}${items.length > 2 ? ',' : ''} dan ${items[items.length - 1]}`;

export const LETTER_PHRASES: Record<Locale, LetterPhrases> = {
	id: {
		to: 'Kepada Yth.',
		defaultRecipient: 'Bapak/Ibu Pimpinan HRD',
		noAddress: 'di Tempat',
		salutation: () => 'Dengan hormat,',
		closing: 'Hormat saya,',
		attachmentLabel: 'Lampiran',
		subjectLabel: 'Perihal',
		attachmentCount: (count) => (count ? `${count} berkas` : '-'),
		subject: (position) => `Lamaran Pekerjaan sebagai ${position}`,
		opening: (source, detail, position, company) => {
			const apply = `saya bermaksud melamar posisi ${position} di ${company}.`;
			switch (source) {
				case 'jobPortal':
					return `Berdasarkan informasi lowongan pekerjaan yang saya peroleh melalui ${detail || 'portal lowongan kerja'}, ${apply}`;
				case 'companySite':
					return `Berdasarkan informasi lowongan pekerjaan pada situs web resmi ${company}, saya bermaksud melamar posisi ${position}.`;
				case 'socialMedia':
					return `Berdasarkan informasi lowongan pekerjaan yang saya peroleh melalui media sosial ${detail || company}, ${apply}`;
				case 'campus':
					return `Berdasarkan informasi lowongan pekerjaan dari ${detail || 'pusat karier kampus'}, ${apply}`;
				case 'referral':
					return `Atas rekomendasi ${detail || 'rekan saya'}, ${apply}`;
				case 'jobFair':
					return `Berdasarkan informasi lowongan pekerjaan pada ${detail || 'bursa kerja'}, ${apply}`;
				default:
					return `Melalui surat ini, ${apply}`;
			}
		},
		identityIntro: 'Berikut data diri saya:',
		identity: {
			name: 'Nama',
			birth: 'Tempat, tanggal lahir',
			education: 'Pendidikan terakhir',
			address: 'Alamat',
			phone: 'Telepon',
			email: 'Email'
		},
		attachmentsIntro: 'Sebagai bahan pertimbangan, bersama surat ini saya lampirkan:',
		attachments: {
			cv: 'Curriculum Vitae (CV)',
			diploma: 'Salinan ijazah terakhir',
			transcript: 'Salinan transkrip nilai',
			idCard: 'Salinan KTP',
			photo: 'Pas foto terbaru',
			certificates: 'Salinan sertifikat pendukung',
			portfolio: 'Portofolio',
			skck: 'Surat Keterangan Catatan Kepolisian (SKCK)',
			health: 'Surat keterangan sehat',
			reference: 'Surat rekomendasi'
		},
		immediate: 'Saya siap mulai bekerja secepatnya.',
		relocate: (company) => `Saya bersedia ditempatkan di seluruh wilayah kerja ${company}.`,
		contact: (phone, email) =>
			phone && email
				? `Saya dapat dihubungi melalui telepon ${phone} atau email ${email}.`
				: phone
					? `Saya dapat dihubungi melalui telepon ${phone}.`
					: `Saya dapat dihubungi melalui email ${email}.`,
		closingParagraph: () =>
			'Saya berharap diberi kesempatan wawancara agar dapat menjelaskan potensi saya lebih lanjut. Atas perhatian Bapak/Ibu, saya ucapkan terima kasih.',
		and: 'dan',
		education: {
			graduate: (degree, institution) =>
				`Saya adalah lulusan ${degree}${institution ? ` dari ${institution}` : ''}`,
			student: (degree, institution) =>
				`Saya adalah mahasiswa tingkat akhir ${degree}${institution ? ` di ${institution}` : ''}`,
			gpa: (label, value) => ` dengan ${label} ${value}`
		},
		experience: (role, company, internship) =>
			internship
				? `Saya pernah magang sebagai ${role}${company ? ` di ${company}` : ''}`
				: `Saya memiliki pengalaman sebagai ${role}${company ? ` di ${company}` : ''}`,
		organization: (role, name) => `Saya juga aktif sebagai ${role}${name ? ` di ${name}` : ''}`,
		project: (name, verbPhrase) =>
			verbPhrase ? `Dalam proyek ${name}, saya ${verbPhrase}.` : `Saya mengerjakan proyek ${name}.`,
		detail: (verbPhrase) => `Di sana, saya ${verbPhrase}.`,
		certification: (name, issuer) =>
			`Saya telah menyelesaikan sertifikasi ${name}${issuer ? ` dari ${issuer}` : ''}.`,
		award: (title, issuer) => `Saya meraih ${title}${issuer ? ` dari ${issuer}` : ''}.`,
		skills: {
			hard: (items) => `Saya menguasai ${items}.`,
			tools: (items) => `Saya terbiasa menggunakan ${items}.`,
			soft: (items) => `Saya memiliki kemampuan ${items}.`
		},
		motivationExamples: (company, position, skill) => [
			`Saya tertarik bergabung dengan ${company} karena ingin berkembang sebagai ${position} di perusahaan yang terus berinovasi.`,
			skill
				? `Saya ingin menerapkan kemampuan ${skill} yang saya miliki untuk mendukung tim ${company}.`
				: `Saya ingin menerapkan ilmu yang saya pelajari untuk mendukung tim ${company}.`,
			`Saya tertarik dengan budaya kerja ${company} yang mendorong karyawannya untuk terus belajar.`
		],
		email: {
			subject: (position, name) =>
				['Lamaran Pekerjaan', position, name].filter(Boolean).join(' – '),
			attached: 'CV dan berkas pendukung saya lampirkan pada email ini.'
		}
	},
	en: {
		to: '',
		defaultRecipient: 'Hiring Manager',
		noAddress: '',
		salutation: (recipient) => `Dear ${recipient},`,
		closing: 'Sincerely,',
		attachmentLabel: 'Enclosures',
		subjectLabel: 'Re',
		attachmentCount: (count) => (count ? String(count) : '-'),
		subject: (position) => `Application for ${position}`,
		opening: (source, detail, position, company) => {
			const apply = `I am writing to apply for the ${position} position at ${company}`;
			switch (source) {
				case 'jobPortal':
					return `${apply}, which I found on ${detail || 'a job portal'}.`;
				case 'companySite':
					return `${apply}, as advertised on your company website.`;
				case 'socialMedia':
					return `${apply}, which I saw on ${detail || 'social media'}.`;
				case 'campus':
					return `${apply}, which I learned about through ${detail || 'my university career centre'}.`;
				case 'referral':
					return `${detail || 'A colleague'} recommended that I apply for the ${position} position at ${company}.`;
				case 'jobFair':
					return `${apply}, which I learned about at ${detail || 'a job fair'}.`;
				default:
					return `${apply}.`;
			}
		},
		identityIntro: 'My personal details:',
		identity: {
			name: 'Name',
			birth: 'Place, date of birth',
			education: 'Education',
			address: 'Address',
			phone: 'Phone',
			email: 'Email'
		},
		attachmentsIntro: 'Please find enclosed:',
		attachments: {
			cv: 'Curriculum Vitae (CV)',
			diploma: 'Copy of my diploma',
			transcript: 'Academic transcript',
			idCard: 'Copy of my ID card',
			photo: 'Recent photograph',
			certificates: 'Supporting certificates',
			portfolio: 'Portfolio',
			skck: 'Police clearance certificate (SKCK)',
			health: 'Health certificate',
			reference: 'Letter of recommendation'
		},
		immediate: 'I am available to start immediately.',
		relocate: () => 'I am willing to relocate.',
		contact: (phone, email) =>
			phone && email
				? `I can be reached at ${phone} or ${email}.`
				: `I can be reached at ${phone || email}.`,
		closingParagraph: (company) =>
			`I would welcome the opportunity to discuss how I can contribute to ${company}. Thank you for your time and consideration.`,
		and: 'and',
		education: {
			graduate: (degree, institution) =>
				`I hold ${article(degree)} ${degree}${institution ? ` from ${institution}` : ''}`,
			student: (degree, institution) =>
				`I am a final-year student pursuing ${article(degree)} ${degree}${institution ? ` at ${institution}` : ''}`,
			gpa: (label, value) => ` with a ${label} of ${value}`
		},
		experience: (role, company, internship) =>
			internship
				? `I completed an internship as ${role}${company ? ` at ${company}` : ''}`
				: `I have worked as ${role}${company ? ` at ${company}` : ''}`,
		organization: (role, name) => `I also served as ${role}${name ? ` at ${name}` : ''}`,
		project: (name, verbPhrase) =>
			verbPhrase ? `In the ${name} project, I ${verbPhrase}.` : `I worked on the ${name} project.`,
		detail: (verbPhrase) => `There, I ${verbPhrase}.`,
		certification: (name, issuer) =>
			`I have completed the ${name} certification${issuer ? ` from ${issuer}` : ''}.`,
		award: (title, issuer) => `I received ${title}${issuer ? ` from ${issuer}` : ''}.`,
		skills: {
			hard: (items) => `I am proficient in ${items}.`,
			tools: (items) => `I am experienced with ${items}.`,
			soft: (items) => `My strengths include ${items}.`
		},
		motivationExamples: (company, position, skill) => [
			`I am excited to join ${company} and grow as ${position} in a company that keeps innovating.`,
			skill
				? `I want to apply my ${skill} skills to support the ${company} team.`
				: `I want to apply what I have learned to support the ${company} team.`,
			`I admire the learning culture at ${company} and want to contribute to it.`
		],
		email: {
			subject: (position, name) => ['Application', position, name].filter(Boolean).join(' – '),
			attached: 'My CV and supporting documents are attached to this email.'
		}
	}
};

/** "a, b, dan c" / "a, b, and c". */
export function joinList(items: readonly string[], locale: Locale): string {
	if (locale === 'id') return listId(items);
	if (items.length <= 1) return items[0] ?? '';
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
