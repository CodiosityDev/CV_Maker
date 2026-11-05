import type { Guidance } from './types';

export const guidance: Guidance = {
	stepTips: {
		type: [
			'Applying through online portals or large companies? Choose an ATS CV.',
			'A Creative CV suits design/creative roles or sending your CV directly to a recruiter.'
		],
		target: [
			'Write the role you are aiming for, e.g. "Junior Data Analyst" or "Administrative Staff".',
			'Match the CV language to the job post. English job post → English CV.'
		],
		personal: [
			'Use a professional email, ideally with your name (e.g. first.last@email.com).',
			'City and province are enough. You do not need your full address.'
		],
		education: [
			'As a fresh graduate, education is a key section. Show your major and graduation year clearly.',
			'Include your GPA if it is 3.00 or higher, or if the job post asks for it.',
			'Add relevant courses, your thesis or scholarships that fit the role.'
		],
		experience: [
			'Internships, part-time jobs and freelance work all count as experience.',
			'No work experience yet? That is fine. Skip this step and highlight activities or projects.'
		],
		organizations: [
			'Student organisations and event committees show teamwork and leadership.',
			'Describe your role and what you achieved, not just the activity name.'
		],
		projects: [
			'Coursework, thesis, competitions or personal projects can prove your skills.',
			'Add a link (GitHub, portfolio, public drive) if you have one.'
		],
		skills: [
			'Separate technical skills (e.g. Excel, SQL) from soft skills (e.g. communication).',
			'Choose skills that match the job post. Fewer but relevant is better.'
		],
		summary: [
			'Write the summary last so it can sum up your CV.',
			'2–4 sentences: who you are, your key skills and the role you want.'
		],
		review: [
			'Double-check spelling, phone number and email.',
			'As a fresh graduate, try to keep your CV to one page.'
		],
		done: [
			'Also save a backup (JSON) so you can reopen your CV if browser data is erased.',
			'Make a copy of your CV for each type of role so you can tailor it.'
		]
	},
	fieldTips: {
		headline:
			'One short line about you, e.g. "Accounting Fresh Graduate" or "Computer Science Graduate | Web Developer".',
		email: 'Avoid nicknames or random numbers in your email. First impressions matter.',
		phone: 'Use an active number connected to WhatsApp. The format is tidied automatically.',
		links: 'LinkedIn, portfolio or GitHub. Make sure the link is publicly accessible.',
		gpa: 'Write it like 3.65. The scale is usually 4.00.',
		bullets:
			'Start with an action verb and add numbers where you can. Example: "Managed 3 social media accounts with 5,000+ followers".',
		summary: 'Avoid empty clichés like "hard worker". Show it with real experience instead.',
		skills: 'One skill per entry. Use the same terms as the job post.',
		photo:
			'Use a formal photo with a plain background. Photos are only used in Creative CVs and processed on your device.'
	},
	exampleBullets: {
		internship: [
			'Helped the finance team reconcile 200+ invoices per month using Microsoft Excel',
			'Prepared weekly sales reports and presented them to the supervisor',
			'Developed a search feature for an internal application using Laravel'
		],
		organization: [
			'Led a 10-person division to deliver 5 programmes during one term',
			'Wrote an event proposal that secured IDR 15 million in sponsorship',
			'Managed the organisation’s social media and grew followers by 40%'
		],
		committee: [
			'Coordinated a national seminar for 500 participants as Head of Programme',
			'Contacted and confirmed 6 guest speakers according to the event schedule',
			'Managed logistics and catering for a 3-day event within budget'
		],
		project: [
			'Built a web-based point-of-sale app for a small business using React and Firebase',
			'Analysed survey data from 300 respondents using SPSS for my thesis',
			'Designed the visual identity for a campus event, including logo, posters and merchandise'
		],
		parttime: [
			'Served an average of 80 customers per day with high satisfaction ratings',
			'Tutored 5 junior high school students in mathematics and helped improve their grades'
		],
		volunteer: [
			'Taught basic literacy to 20 children in a village volunteer programme for 2 months',
			'Helped distribute aid to 150 families affected by flooding'
		]
	},
	actionVerbs: [
		'Managed',
		'Led',
		'Prepared',
		'Developed',
		'Designed',
		'Analysed',
		'Coordinated',
		'Improved',
		'Built',
		'Presented',
		'Optimised',
		'Trained',
		'Evaluated',
		'Completed',
		'Implemented',
		'Documented'
	],
	summaryExamples: [
		{
			field: 'it',
			label: 'Information Technology',
			text: '[Major] graduate with [internship/project] experience in [web development/data analysis]. Skilled in [skill 1], [skill 2] and [skill 3]. Looking for a [role] position to help build useful digital products.'
		},
		{
			field: 'accounting',
			label: 'Accounting & Finance',
			text: 'Accounting graduate with a GPA of [GPA], detail-oriented and comfortable working with numbers. Experienced in [financial reporting/reconciliation] through [internship/organisation]. Proficient in Microsoft Excel and [accounting software], ready to contribute as a [role].'
		},
		{
			field: 'engineering',
			label: 'Engineering',
			text: '[Engineering major] graduate with [internship/project] experience in [field]. Familiar with [software/tools] and [standards/methods]. Eager to grow as a [role].'
		},
		{
			field: 'marketing',
			label: 'Marketing & Communications',
			text: '[Major] graduate who actively managed [social media/events] during university. Created content and campaigns that [result, e.g. increased engagement by 30%]. Looking for a [role] position to help brands grow.'
		},
		{
			field: 'design',
			label: 'Design & Creative',
			text: '[Major] graduate who enjoys designing clear [UI/visual identities/content]. Experienced in [projects/freelance] using [Figma/Adobe]. Ready to contribute as a [role].'
		},
		{
			field: 'health',
			label: 'Health',
			text: '[Diploma/Bachelor] graduate in [Nursing/Pharmacy/Public Health] with clinical placement at [hospital/community health centre]. Experienced in [key skill, e.g. nursing care/patient education] and following SOPs. Ready to contribute as a [role] with careful, empathetic care.'
		},
		{
			field: 'education',
			label: 'Education',
			text: "[Education major] graduate with [teaching practice/tutoring] experience over [duration]. Used to preparing lesson materials and adapting to students' needs. Ready to contribute as a [role]."
		},
		{
			field: 'admin',
			label: 'Administration & Office',
			text: 'Detail-oriented [degree] [major] graduate who keeps documents organised. Experienced in [filing/data entry/correspondence] through [internship/organisation] and proficient in Microsoft Office. Ready to support daily operations as a [role].'
		},
		{
			field: 'hr',
			label: 'Human Resources',
			text: '[Psychology/HR Management] graduate with [internship/committee] experience in [recruitment/personnel administration]. Comfortable communicating with many people and handling confidential data. Ready to contribute as a [role].'
		},
		{
			field: 'sales',
			label: 'Sales & Customer Service',
			text: '[Major] graduate who enjoys meeting and helping people. Experienced in [sales/customer service] through [part-time work/organisation], e.g. [serving 80 customers a day]. Ready to hit targets as a [role].'
		},
		{
			field: 'hospitality',
			label: 'Hospitality & Tourism',
			text: '[Hospitality/Tourism] graduate with [internship at a hotel/restaurant] in [front office/F&B]. Friendly with guests and used to shift work. Ready to contribute as a [role].'
		},
		{
			field: 'legal',
			label: 'Law',
			text: 'Law graduate with an interest in [civil/corporate/labour law]. Experienced in [legal research/document drafting] through [an internship at a law firm/legal aid institute]. Ready to contribute as a [role].'
		},
		{
			field: 'agriculture',
			label: 'Agriculture',
			text: '[Agrotechnology/Agribusiness] graduate with [research/internship] experience in [cultivation/plantations]. Comfortable with field work and careful data recording. Ready to contribute as a [role].'
		},
		{
			field: 'general',
			label: 'General',
			text: '[Degree] [major] graduate from [university], active in [organisations/activities]. Skilled in [key skill], used to teamwork and meeting deadlines. Eager to learn and contribute as a [role].'
		}
	],
	cvTypes: {
		ats: {
			title: 'ATS CV',
			points: [
				'One clean column that applicant tracking systems (ATS) can read',
				'No photo and no decorative elements',
				'The safest choice for job portals and large companies'
			]
		},
		creative: {
			title: 'Creative CV',
			points: [
				'Visual layout with colour and an optional photo',
				'Suits creative roles or sending directly to a recruiter',
				'Less suited to portals that use an ATS'
			]
		},
		changeLater: 'You can change your CV type and template at any time.'
	}
};
