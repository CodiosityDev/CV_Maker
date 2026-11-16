/**
 * Word lists for spotting foreign (mostly English) terms in Indonesian CV text — PUEBI: foreign
 * terms are written in italics; proper names (companies, schools, products, technologies) are not.
 *
 * Curated for CV & cover-letter vocabulary, NOT a full English dictionary: a word that is also an
 * Indonesian word or an absorbed loanword with the same spelling (data, media, digital, senior,
 * admin, video, …) must never be in FOREIGN_WORDS. Put it in HOMOGRAPHS instead: those count as
 * foreign only next to another foreign word ("Data Analyst", but "analisis data" stays upright).
 * Technology and brand names (Excel, React, Swift, Canva, …) are deliberately left out.
 * All entries are lowercase.
 */

const list = (text: string): string[] => text.trim().split(/\s+/);

export const FOREIGN_WORDS: ReadonlySet<string> = new Set(
	list(`
	accelerator acceptance access account accountability accounting accounts achievement achievements
	acquisition active adaptability adaptive administrative ads advanced advertising advisor advisory
	affair affairs affiliate agent agile ambassador analysis analyst analysts analytical analytics
	animation app apps archiving art artificial artist assembly assessment assistant assistants
	associate assurance attention attitude automation availability available award awardee awards
	awareness bachelor back back-end backend backlink backlog balancing banking barista basic batch
	beauty beginner benchmark benchmarking best beverage big billing board bookkeeping booking
	bootcamp brainstorm brainstorming brand branding brief briefing broker budget budgeting
	builder building business buyer calling campaign campaigns campus candidate capital capstone
	care career cash cashier casting ceremony certificate certificates certification certifications
	certified chain chairman chairperson challenge champion channel chapter chat chatbot check-in
	checklist chef city civil cleaning client clients closing cloud club clubs coach coaching code
	coding cold collaboration collaborative collection collector college color commerce committee
	communication communications community competition compliance computing conference
	conflict consultant consulting consumer consumers container content contents continuous
	contributor control conversion cook coordinator copy copywriter copywriting cost courier course
	courses coverage creative creativity creator creators credit critical cross-selling culture
	cum curriculum customer customers cyber dashboard dashboards database databases deadline
	deadlines deal deals dean debt debugging decision deck deep degree delivery department
	deployment design designer designers desk detail-oriented developer developers development
	devops discount discussion display distribution division documentation download drafter
	drafting driver dropship dropshipper dubbing e-commerce e-mail ecommerce editing education
	efficiency electrical email emotional empathy employee end end-to-end end-user endorsement
	engagement engine engineer engineering engineers enterprise entry environment equity ethic
	ethics event events excellence exchange executive executives experience expert expertise
	export fashion fast feedback fellow fellowship finalist finance financial fintech flexibility
	flow focus follow follow-up followers food forecasting framework frameworks freelance
	freelancer freight fresh front front-end frontend full full-stack full-time fullstack fulltime
	funding fundraising funnel game gamer games gaming gathering  generative graduate
	graduates graphic grading growth guest guide guideline guidelines hacking hackathon handling
	handover hard hardware head headline health healthcare help helpdesk high homepage honors
	honours hospitality host hosting housekeeping human hybrid ideation identity illustration
	impact implementation import improvement inbound incubator influencer initiative insight
	insights install installation insurance intelligence interface intermediate intern
	internship interview interviewer inventory investment invoice invoicing jobdesc jobdesk job
	jobs journal junior-level keyword keywords kitchen knowledge  laboratory landing language
	laude lead leader leaders leadership leading leads lean learner learning lecturer ledger
	lending  library license licensed lifestyle magna summa lighting line liaison live logistic
	logistics loyalty machine maintenance make-up makeup management manager managers managing
	mapping market marketer marketing marketplace  mastering mechanical meeting meetings
	member members mentee mentoring merchandiser merchandising microservices milestone milestones
	mindset mining  mixing mobile mockup mockups modeling modelling moodboard motion
	motivated multitask multitasking natural negotiation network networking newsletter office
	officer officers offline omnichannel onboarding online onsite operational operations
	optimization optimizing organizational organizer organizing outbound outsource outsourcing
	overtime owner ownership packaging packing page paid part part-time partner partners
	partnership partnerships parttime payable payroll people performance  photographer
	photography picking pipeline pitch pitching pixel plan planner planning plant podcast
	portfolio positioning posting practicum presentation presentations pressure pricing print
	printing problem processing procurement product production productivity products professional
	proficient profile programmer programming project projects promotion prospecting prototyping
	public publication publishing purchasing quality query queries ranking reach receivable
	receptionist recruiter recruitment reels relations relationship remote repair report reporting
	reports requirement requirements research researcher reseller resolution resource resources
	responsibility responsive retail retention retouching revenue review reviewer rider risk
	roadmap runner runner-up safety sale sales scalability schedule scheduling scholar scholarship
	school science scientist scraping script scripting scriptwriter scrum search secretary
	security self self-motivated seller selling semifinalist service services setting settings
	setup shift shipping shooting sigma site skill skills skillset social soft software solving
	sound speaker speaking specialist specification sprint staff stakeholder stakeholders startup
	start-up stock storage store storyboard storytelling strategic streamer streaming student
	students  summit supply support survey system systems talent task tasks tax taxation
	teaching team teams teamwork tech technical technician technology telemarketing telesales
	teller test tester testing thinking ticketing time timeline tool toolkit tools tour tracking
	trader trading traffic trainee trainer training travel treasurer treasury troubleshooting
	tutoring under understanding university update upgrade upload upselling usability user users
	vitae valedictorian venture videographer videography vision visualization voice volunteer
	volunteering waiter waitress warehouse wealth web webinar website websites winner wireframe
	wireframes wireframing work worker workflow workflows working workshop workshops writer
	writing
`)
);

/**
 * Same spelling in Indonesian (or an absorbed loanword): foreign only when next to a foreign word.
 * "Senior Software Engineer" → all italic; "data penjualan" → upright.
 */
export const HOMOGRAPHS: ReadonlySet<string> = new Set(
	list(`
	admin administrator animator area audio audit auditor blog contract data detail digital editor
	film final formal global internal general internet interpersonal junior lab legal level manual margin master media
	mentor minor model moderator monitor normal operator personal platform profit promo proposal radio senior server
	seminar sponsor studio supervisor target total tutor video virtual visual
`)
);

/** Little English words: foreign only BETWEEN two foreign words ("Head of Marketing"). */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set(
	list('a an and as at by for from in of on or the to up with &')
);

/**
 * Words of a brand or organisation: a run of Capitalised Words containing one of these is a proper
 * name and stays upright ("Google Developer Student Clubs", "Microsoft Office Specialist").
 */
export const BRAND_WORDS: ReadonlySet<string> = new Set(
	list(`
	adobe alibaba amazon android apple aws azure bangkit binar bukalapak canva cisco coursera dicoding
	facebook figma gojek google grab huawei ibm instagram linkedin meta microsoft netflix notion
	oracle pertamina revou salesforce samsung shopee skilvul telkom tiktok tokopedia traveloka udemy
	whatsapp youtube zoom
`)
);

/** Indonesian prefixes written with a hyphen before a foreign word (PUEBI): "di-follow up". */
export const ID_PREFIX = /^(di|ter|ke|se|ber|me|mem|men|meng|pe|pem|pen|peng)-(.+)$/i;
