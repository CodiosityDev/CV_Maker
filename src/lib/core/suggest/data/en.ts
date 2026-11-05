import type { SuggestionData } from '../types';
import { CITIES, DEGREES, INSTITUTIONS, PROVINCES } from './shared';

export const suggestionsEn: SuggestionData = {
	jobTitles: [
		{ title: 'Administrative Staff', category: 'admin' },
		{ title: 'Customer Service', category: 'customer' },
		{ title: 'Junior Data Analyst', category: 'data' },
		{ title: 'Accounting Staff', category: 'finance' },
		{ title: 'Digital Marketing', category: 'marketing' },
		{ title: 'Junior Software Engineer', category: 'it' },
		{ title: 'Web Developer', category: 'it' },
		{ title: 'Frontend Developer', category: 'it' },
		{ title: 'Backend Developer', category: 'it' },
		{ title: 'Mobile Developer', category: 'it' },
		{ title: 'IT Support', category: 'it' },
		{ title: 'QA Tester', category: 'it' },
		{ title: 'Network Engineer', category: 'it' },
		{ title: 'System Administrator', category: 'it' },
		{ title: 'Data Entry Clerk', category: 'data' },
		{ title: 'Business Intelligence Analyst', category: 'data' },
		{ title: 'Data Scientist', category: 'data' },
		{ title: 'UI/UX Designer', category: 'design' },
		{ title: 'Graphic Designer', category: 'design' },
		{ title: 'Content Creator', category: 'design' },
		{ title: 'Video Editor', category: 'design' },
		{ title: 'Social Media Specialist', category: 'marketing' },
		{ title: 'Content Writer', category: 'marketing' },
		{ title: 'Copywriter', category: 'marketing' },
		{ title: 'SEO Specialist', category: 'marketing' },
		{ title: 'Marketing Communications', category: 'marketing' },
		{ title: 'Finance Staff', category: 'finance' },
		{ title: 'Tax Staff', category: 'finance' },
		{ title: 'Junior Auditor', category: 'finance' },
		{ title: 'Bank Teller', category: 'finance' },
		{ title: 'Cashier', category: 'finance' },
		{ title: 'Credit Analyst', category: 'finance' },
		{ title: 'Secretary', category: 'admin' },
		{ title: 'Receptionist', category: 'admin' },
		{ title: 'Online Shop Admin', category: 'admin' },
		{ title: 'HR Staff', category: 'hr' },
		{ title: 'Recruiter', category: 'hr' },
		{ title: 'Personnel Staff', category: 'hr' },
		{ title: 'Sales Executive', category: 'sales' },
		{ title: 'Account Executive', category: 'sales' },
		{ title: 'Business Development', category: 'sales' },
		{ title: 'Sales Representative', category: 'sales' },
		{ title: 'Customer Success', category: 'customer' },
		{ title: 'Call Center Agent', category: 'customer' },
		{ title: 'Technician', category: 'engineering' },
		{ title: 'Drafter', category: 'engineering' },
		{ title: 'Quality Control', category: 'engineering' },
		{ title: 'Production Staff', category: 'engineering' },
		{ title: 'Civil Engineer', category: 'engineering' },
		{ title: 'Electrical Engineer', category: 'engineering' },
		{ title: 'Mechanical Engineer', category: 'engineering' },
		{ title: 'Teacher', category: 'education' },
		{ title: 'Tutor', category: 'education' },
		{ title: 'Teaching Assistant', category: 'education' },
		{ title: 'Nurse', category: 'health' },
		{ title: 'Pharmacist', category: 'health' },
		{ title: 'Laboratory Analyst', category: 'health' },
		{ title: 'Midwife', category: 'health' },
		{ title: 'Barista', category: 'hospitality' },
		{ title: 'Front Office', category: 'hospitality' },
		{ title: 'Logistics Staff', category: 'logistics' },
		{ title: 'Warehouse Admin', category: 'logistics' },
		{ title: 'Purchasing Staff', category: 'logistics' },
		{ title: 'Legal Staff', category: 'legal' },
		{ title: 'Paralegal', category: 'legal' },
		{ title: 'Operations Staff', category: 'operations' },
		{ title: 'Operations Admin', category: 'operations' },
		{ title: 'Agricultural Extension Officer', category: 'agriculture' },
		{ title: 'Plantation Staff', category: 'agriculture' },
		{ title: 'Agronomist', category: 'agriculture' },
		{ title: 'Journalist', category: 'media' },
		{ title: 'Reporter', category: 'media' },
		{ title: 'Public Relations Staff', category: 'media' },
		{ title: 'Government Staff', category: 'public' },
		{ title: 'Policy Analyst', category: 'public' },
		{ title: 'Government IT Officer', category: 'public' },
		{ title: 'Store Crew', category: 'retail' },
		{ title: 'Store Manager', category: 'retail' },
		{ title: 'Merchandiser', category: 'retail' },
		{ title: 'Sales Promoter', category: 'retail' },
		{ title: 'Junior Architect', category: 'construction' },
		{ title: 'Site Engineer', category: 'construction' },
		{ title: 'Estimator', category: 'construction' },
		{ title: 'Surveyor', category: 'construction' },
		{ title: 'HSE Staff', category: 'mining' },
		{ title: 'Geologist', category: 'mining' },
		{ title: 'Mining Engineer', category: 'mining' },
		{ title: 'Shipping Staff', category: 'transport' },
		{ title: 'Dispatcher', category: 'transport' },
		{ title: 'Airport Staff', category: 'transport' },
		{ title: 'Research Assistant', category: 'research' },
		{ title: 'Enumerator', category: 'research' },
		{ title: 'Event Organizer', category: 'event' },
		{ title: 'Event Coordinator', category: 'event' },
		{ title: 'Community Facilitator', category: 'social' },
		{ title: 'NGO Program Staff', category: 'social' },
		{ title: 'Social Worker', category: 'social' },
		{ title: 'Management Trainee', category: 'general' }
	],
	skillsByCategory: {
		it: {
			hard: [
				'JavaScript',
				'TypeScript',
				'Python',
				'Java',
				'PHP',
				'SQL',
				'HTML & CSS',
				'REST API',
				'Git',
				'Object-Oriented Programming',
				'Software Testing',
				'Computer Networking'
			],
			tools: ['Visual Studio Code', 'GitHub', 'Postman', 'Docker', 'Linux', 'Figma', 'Jira']
		},
		data: {
			hard: [
				'SQL',
				'Python',
				'Data Analysis',
				'Data Visualization',
				'Statistics',
				'Data Cleaning',
				'Advanced Excel (Pivot, VLOOKUP)',
				'Basic Machine Learning'
			],
			tools: [
				'Microsoft Excel',
				'Google Sheets',
				'Looker Studio',
				'Tableau',
				'Power BI',
				'Jupyter Notebook'
			]
		},
		design: {
			hard: [
				'Graphic Design',
				'UI Design',
				'UX Research',
				'Wireframing',
				'Prototyping',
				'Typography',
				'Branding',
				'Video Editing'
			],
			tools: [
				'Figma',
				'Adobe Photoshop',
				'Adobe Illustrator',
				'Adobe Premiere Pro',
				'Canva',
				'CapCut'
			]
		},
		marketing: {
			hard: [
				'Digital Marketing',
				'Social Media Marketing',
				'Copywriting',
				'SEO',
				'Content Planning',
				'Meta Ads',
				'Google Ads',
				'Campaign Analysis'
			],
			tools: ['Meta Business Suite', 'Google Analytics', 'Canva', 'CapCut', 'Google Sheets']
		},
		finance: {
			hard: [
				'Financial Accounting',
				'Financial Reporting',
				'Bank Reconciliation',
				'Indonesian Taxation (PPh & PPN)',
				'General Ledger',
				'Financial Analysis',
				'Budgeting'
			],
			tools: ['Microsoft Excel', 'Accurate', 'Zahir', 'MYOB', 'SAP', 'e-Faktur']
		},
		admin: {
			hard: [
				'Office Administration',
				'Document Filing',
				'Business Correspondence',
				'Data Entry',
				'Scheduling',
				'Minute Taking'
			],
			tools: ['Microsoft Word', 'Microsoft Excel', 'Google Workspace', 'Microsoft PowerPoint']
		},
		hr: {
			hard: [
				'Recruitment',
				'CV Screening',
				'Interviewing',
				'Personnel Administration',
				'Payroll',
				'Employee Onboarding',
				'Basic Labour Law'
			],
			tools: ['Microsoft Excel', 'Google Workspace', 'LinkedIn Recruiter', 'Talenta']
		},
		sales: {
			hard: [
				'B2B Sales',
				'B2C Sales',
				'Prospecting',
				'Price Negotiation',
				'Product Presentation',
				'Account Management',
				'Sales Targets'
			],
			tools: ['CRM', 'Microsoft Excel', 'Google Sheets', 'WhatsApp Business']
		},
		customer: {
			hard: [
				'Customer Service',
				'Complaint Handling',
				'Phone Support',
				'Live Chat Support',
				'Ticket Logging'
			],
			tools: ['Zendesk', 'Freshdesk', 'WhatsApp Business', 'Google Sheets']
		},
		engineering: {
			hard: [
				'Technical Drawing',
				'Quality Control',
				'Occupational Health and Safety',
				'Machine Maintenance',
				'Cost Estimation',
				'Project Management'
			],
			tools: ['AutoCAD', 'SolidWorks', 'SketchUp', 'MATLAB', 'Microsoft Project']
		},
		education: {
			hard: [
				'Lesson Planning',
				'Teaching Material Development',
				'Learning Assessment',
				'Classroom Management',
				'Tutoring'
			],
			tools: ['Google Classroom', 'Microsoft PowerPoint', 'Canva', 'Zoom']
		},
		health: {
			hard: [
				'Nursing Care',
				'Pharmaceutical Care',
				'Laboratory Testing',
				'Medical Records',
				'Patient Education',
				'First Aid'
			],
			tools: ['Hospital Information System', 'Microsoft Excel']
		},
		hospitality: {
			hard: [
				'Guest Service',
				'Reservations',
				'Food & Beverage Service',
				'Complaint Handling',
				'Cashiering'
			],
			tools: ['POS System', 'Opera PMS']
		},
		logistics: {
			hard: [
				'Inventory Management',
				'Procurement',
				'Shipping & Distribution',
				'Stock Taking',
				'Warehouse Administration'
			],
			tools: ['Microsoft Excel', 'SAP', 'Google Sheets']
		},
		legal: {
			hard: [
				'Contract Drafting',
				'Legal Research',
				'Legal Drafting',
				'Compliance',
				'Permit Administration'
			],
			tools: ['Microsoft Word', 'Microsoft Excel']
		},
		operations: {
			hard: [
				'Operations Management',
				'SOP Development',
				'Cross-team Coordination',
				'Daily Reporting',
				'Cost Control'
			],
			tools: ['Microsoft Excel', 'Google Sheets', 'ERP']
		},
		agriculture: {
			hard: [
				'Crop Cultivation',
				'Integrated Pest Management',
				'Soil Analysis',
				'Agricultural Extension',
				'Plantation Management',
				'Post-harvest Handling'
			],
			tools: ['Microsoft Excel', 'GIS (QGIS)']
		},
		media: {
			hard: [
				'News Writing',
				'Interviewing',
				'Field Reporting',
				'Press Releases',
				'Media Relations',
				'Copy Editing'
			],
			tools: ['Microsoft Word', 'Canva', 'Adobe Premiere Pro', 'WordPress']
		},
		public: {
			hard: [
				'Government Administration',
				'Public Service',
				'Report Writing',
				'Policy Analysis',
				'Records Management'
			],
			tools: ['Microsoft Office', 'Google Workspace']
		},
		retail: {
			hard: [
				'Retail Sales',
				'Visual Merchandising',
				'Stock Taking',
				'Cashiering',
				'Customer Service',
				'Sales Targets'
			],
			tools: ['POS System', 'Microsoft Excel']
		},
		construction: {
			hard: [
				'Working Drawings',
				'Bill of Quantities',
				'Site Supervision',
				'Construction Safety',
				'Structural Calculation',
				'Surveying and Mapping'
			],
			tools: ['AutoCAD', 'SketchUp', 'Revit', 'Microsoft Project', 'Microsoft Excel']
		},
		mining: {
			hard: [
				'Health, Safety and Environment (HSE)',
				'Geological Mapping',
				'Rock Analysis',
				'Mine Planning',
				'Environmental Management'
			],
			tools: ['ArcGIS', 'AutoCAD', 'Microsoft Excel']
		},
		transport: {
			hard: [
				'Fleet Scheduling',
				'Shipping Administration',
				'Shipment Tracking',
				'Passenger Service'
			],
			tools: ['Microsoft Excel', 'Google Sheets', 'Transportation Management System']
		},
		research: {
			hard: [
				'Research Methodology',
				'Field Data Collection',
				'Statistical Analysis',
				'Academic Writing',
				'Literature Review',
				'In-depth Interviews'
			],
			tools: ['SPSS', 'Microsoft Excel', 'NVivo', 'Mendeley', 'KoboToolbox']
		},
		event: {
			hard: [
				'Event Planning',
				'Vendor Management',
				'Rundown Preparation',
				'Event Budgeting',
				'Team Coordination'
			],
			tools: ['Google Workspace', 'Canva', 'Microsoft Excel']
		},
		social: {
			hard: [
				'Community Empowerment',
				'Discussion Facilitation',
				'Monitoring and Evaluation',
				'Proposal Writing',
				'Case Assistance'
			],
			tools: ['Microsoft Office', 'Google Workspace', 'KoboToolbox']
		},
		general: {
			hard: [
				'Microsoft Office',
				'Problem Analysis',
				'Project Management',
				'Research',
				'Report Writing'
			],
			tools: ['Microsoft Excel', 'Microsoft Word', 'Microsoft PowerPoint', 'Google Workspace']
		}
	},
	softSkills: [
		'Communication',
		'Teamwork',
		'Time Management',
		'Problem Solving',
		'Critical Thinking',
		'Leadership',
		'Adaptability',
		'Attention to Detail',
		'Initiative',
		'Negotiation',
		'Presentation',
		'Creativity',
		'Customer Service',
		'Working Under Pressure',
		'Organization'
	],
	majors: [
		'Informatics Engineering',
		'Information Systems',
		'Computer Science',
		'Management',
		'Accounting',
		'Communication Studies',
		'Law',
		'Psychology',
		'Electrical Engineering',
		'Civil Engineering',
		'Mechanical Engineering',
		'Industrial Engineering',
		'Chemical Engineering',
		'Environmental Engineering',
		'Architecture',
		'Development Economics',
		'Business Administration',
		'Public Administration',
		'Digital Business',
		'International Relations',
		'Visual Communication Design',
		'Interior Design',
		'Primary School Teacher Education',
		'English Education',
		'English Literature',
		'Indonesian Literature',
		'Medicine',
		'Nursing',
		'Pharmacy',
		'Public Health',
		'Nutrition',
		'Midwifery',
		'Agribusiness',
		'Agrotechnology',
		'Biology',
		'Chemistry',
		'Physics',
		'Mathematics',
		'Statistics',
		'Data Science',
		'Sociology',
		'Political Science',
		'Tourism',
		'Hospitality Management',
		'Information Management',
		'Computer and Network Engineering',
		'Software Engineering',
		'Office Administration'
	],
	institutions: INSTITUTIONS,
	degrees: DEGREES,
	orgRoles: [
		'Chairperson',
		'Vice Chairperson',
		'Secretary',
		'Treasurer',
		'Division Coordinator',
		'Head of Department',
		'Division Staff',
		'Member',
		'Event Chairperson',
		'Program Coordinator',
		'Public Relations Coordinator',
		'Publication and Documentation Coordinator',
		'Logistics Coordinator',
		'Catering Coordinator',
		'Fundraising Coordinator',
		'Volunteer'
	],
	cities: CITIES,
	provinces: PROVINCES,
	languages: [
		'Indonesian',
		'English',
		'Javanese',
		'Sundanese',
		'Mandarin Chinese',
		'Japanese',
		'Korean',
		'Arabic',
		'German',
		'French',
		'Dutch',
		'Spanish'
	],
	categoryKeywords: [
		['data', 'data'],
		['analyst', 'data'],
		['developer', 'it'],
		['programmer', 'it'],
		['software', 'it'],
		['software engineer', 'it'],
		[' it ', 'it'],
		['network', 'it'],
		['electrical', 'engineering'],
		['mechanical', 'engineering'],
		['civil', 'engineering'],
		['design', 'design'],
		['ui', 'design'],
		['ux', 'design'],
		['video', 'design'],
		['content', 'marketing'],
		['marketing', 'marketing'],
		['social media', 'marketing'],
		['seo', 'marketing'],
		['account', 'finance'],
		['finance', 'finance'],
		['tax', 'finance'],
		['audit', 'finance'],
		['bank', 'finance'],
		['admin', 'admin'],
		['secretary', 'admin'],
		[' hr ', 'hr'],
		['recruit', 'hr'],
		['personnel', 'hr'],
		['sales', 'sales'],
		['business development', 'sales'],
		['customer', 'customer'],
		['call center', 'customer'],
		['technician', 'engineering'],
		['production', 'engineering'],
		['quality', 'engineering'],
		['teacher', 'education'],
		['tutor', 'education'],
		['nurse', 'health'],
		['pharma', 'health'],
		['midwife', 'health'],
		['laboratory', 'health'],
		['hotel', 'hospitality'],
		['barista', 'hospitality'],
		['front office', 'hospitality'],
		['logistic', 'logistics'],
		['warehouse', 'logistics'],
		['purchasing', 'logistics'],
		['procurement', 'logistics'],
		['legal', 'legal'],
		['law', 'legal'],
		['operation', 'operations'],
		['agricultur', 'agriculture'],
		['plantation', 'agriculture'],
		['agronom', 'agriculture'],
		['journalist', 'media'],
		['reporter', 'media'],
		['public relations', 'media'],
		['government', 'public'],
		['civil servant', 'public'],
		['policy', 'public'],
		['store', 'retail'],
		['retail', 'retail'],
		['merchandis', 'retail'],
		['promoter', 'retail'],
		['architect', 'construction'],
		['site engineer', 'construction'],
		['construction', 'construction'],
		['estimator', 'construction'],
		['surveyor', 'construction'],
		['mining', 'mining'],
		['geolog', 'mining'],
		['hse', 'mining'],
		['shipping', 'transport'],
		['dispatcher', 'transport'],
		['airport', 'transport'],
		['transport', 'transport'],
		['research', 'research'],
		['enumerator', 'research'],
		['event', 'event'],
		['facilitator', 'social'],
		['ngo', 'social'],
		['social worker', 'social']
	]
};
