-- Batch 3: real, non-placeholder learning content for the remaining skills
-- that already have a career mapping (career_skills) but no learning_topics
-- row yet, so they were falling through to "Coming soon" on /skills and had
-- no "Learn" link on /roadmap. This batch closes out coverage for all 7
-- priority career paths (Data Analyst, Frontend Developer, Backend
-- Developer, Software Engineer, Product Manager, UI/UX Designer,
-- Cybersecurity Analyst) plus the Data Scientist skills that overlap with
-- them (pandas, business analytics tooling already covered by earlier
-- batches where shared).

INSERT INTO public.learning_topics
  (slug, skill_id, title, why_it_matters, difficulty, estimated_hours, objectives, common_mistakes, target_level)
SELECT v.slug, s.id, v.title, v.why, v.diff::public.difficulty_level, v.hours, v.objectives, v.mistakes, v.target::public.proficiency_level
FROM (VALUES
  (
    'power-bi-fundamentals',
    'power-bi',
    'Power BI Fundamentals',
    'Power BI is listed as a high-importance, high-demand tool for Data Analyst roles in this catalog — many analytics teams standardize on it for shareable, interactive dashboards rather than static spreadsheets.',
    'beginner',
    5,
    ARRAY[
      'Connect to and shape data with Power Query before building visuals',
      'Distinguish a data model''s fact and dimension tables',
      'Write basic DAX measures (SUM, CALCULATE, simple time intelligence)',
      'Choose appropriate visuals for a comparison, trend, or breakdown',
      'Build and use slicers for interactive filtering',
      'Publish and share a report responsibly'
    ],
    ARRAY[
      'Building visuals directly on ungoverned, unshaped data instead of cleaning it in Power Query first',
      'Writing a DAX measure that implicitly filters context incorrectly, producing a number that looks plausible but is wrong',
      'Using a flat, denormalized table instead of a proper star schema, making relationships and totals unreliable',
      'Cramming ten visuals onto one page with no clear hierarchy, so the “so what” gets lost'
    ],
    'intermediate'
  ),
  (
    'tableau-fundamentals',
    'tableau',
    'Tableau Fundamentals',
    'Tableau appears as a required BI tool for Data Analyst roles in this catalog alongside Power BI — many organizations standardize on one or the other, and both share the same underlying analytical thinking.',
    'beginner',
    5,
    ARRAY[
      'Understand dimensions vs measures and how Tableau treats them differently',
      'Build core chart types: bar, line, scatter, and a simple map',
      'Use filters, parameters, and calculated fields',
      'Build a dashboard that combines multiple views with actions',
      'Apply the right level of detail (LOD) thinking to avoid misleading aggregates'
    ],
    ARRAY[
      'Treating a field as a measure when it is really a categorical dimension (e.g. a zip code), producing meaningless sums',
      'Building a dashboard with unrelated views and no filter actions connecting them',
      'Ignoring aggregation level, so a chart silently sums a value that should have been averaged',
      'Over-designing color and clutter instead of highlighting the one comparison that matters'
    ],
    'intermediate'
  ),
  (
    'business-analytics-fundamentals',
    'business-analytics',
    'Business Analytics Fundamentals',
    'Business analytics — turning data into a recommendation a stakeholder can act on — is listed as a high-importance skill for Data Analyst roles in this catalog, distinct from the tooling (SQL, Excel, BI) used to get there.',
    'beginner',
    4,
    ARRAY[
      'Translate a vague business question into a measurable analytical question',
      'Choose the right metric for a business goal and know its blind spots',
      'Build and read a basic funnel or cohort view',
      'Distinguish a leading indicator from a lagging one',
      'Frame a finding as a recommendation, not just a chart'
    ],
    ARRAY[
      'Answering the literal question asked instead of the underlying business decision it is meant to inform',
      'Reporting a vanity metric (e.g. total signups) that looks good but does not move the actual goal',
      'Comparing cohorts of very different sizes or time windows without normalizing them',
      'Handing over a chart with no recommended action, leaving the stakeholder to do the interpretation'
    ],
    'intermediate'
  ),
  (
    'pandas-fundamentals',
    'pandas',
    'Pandas for Data Analysis',
    'Pandas is the standard Python library for tabular data work and is listed as a skill for both Data Analyst and Data Scientist roles in this catalog — it is how Python-based analysis actually happens once data leaves a spreadsheet.',
    'intermediate',
    6,
    ARRAY[
      'Load, inspect, and filter a DataFrame',
      'Handle missing data deliberately instead of silently dropping it',
      'Group and aggregate data with groupby',
      'Merge/join two DataFrames correctly, matching SQL join semantics',
      'Reshape data between wide and long formats'
    ],
    ARRAY[
      'Chained indexing (df[df.x > 1][''y''] = 2) that triggers a SettingWithCopyWarning and may silently fail to update the DataFrame',
      'Dropping all rows with any missing value (dropna()) without checking how much data that discards',
      'Using an inner join by default and silently losing unmatched rows without realizing it',
      'Assuming groupby preserves the original row order or index without resetting it'
    ],
    'intermediate'
  ),
  (
    'tailwind-fundamentals',
    'tailwind',
    'Tailwind CSS Fundamentals',
    'Tailwind CSS is listed as a skill for Frontend Developer roles in this catalog — it is the dominant utility-first styling approach in modern React/Next.js codebases, replacing large hand-written stylesheets.',
    'beginner',
    4,
    ARRAY[
      'Style elements with utility classes instead of hand-written CSS',
      'Use the spacing, color, and typography scale consistently instead of arbitrary values',
      'Build responsive layouts with breakpoint prefixes (sm:, md:, lg:)',
      'Use state variants (hover:, focus:, disabled:) for interactive styling',
      'Extract repeated utility patterns into reusable components instead of copy-pasting long class lists'
    ],
    ARRAY[
      'Reaching for arbitrary values (mt-[13px]) constantly instead of the design scale, undermining visual consistency',
      'Copy-pasting a long class string across dozens of elements instead of extracting a component',
      'Forgetting a focus: or disabled: state, leaving interactive elements with no visible feedback',
      'Fighting Tailwind by adding custom CSS overrides instead of composing existing utilities'
    ],
    'beginner'
  ),
  (
    'nextjs-fundamentals',
    'nextjs',
    'Next.js Fundamentals',
    'Next.js is listed as a skill for Frontend Developer roles in this catalog — it is the most common production framework built on React, adding routing, rendering strategy, and data-fetching conventions that plain React does not define.',
    'intermediate',
    6,
    ARRAY[
      'Understand file-based routing and route segments',
      'Explain the difference between server and client components',
      'Choose the right rendering strategy: static, server-rendered, or streamed',
      'Fetch data on the server and pass it down instead of fetching in the browser unnecessarily',
      'Handle loading and error states with the built-in conventions'
    ],
    ARRAY[
      'Marking every component "use client" out of habit, losing the performance benefits of server components',
      'Fetching data in a client component with useEffect when a server component could fetch it directly',
      'Not understanding when a page is statically generated vs rendered per-request, causing stale or unexpectedly slow pages',
      'Mixing routing conventions from older Next.js versions with the current app-router conventions'
    ],
    'intermediate'
  ),
  (
    'accessibility-fundamentals',
    'accessibility',
    'Web Accessibility (a11y) Fundamentals',
    'Accessibility is listed as a skill for both Frontend Developer and UI/UX Designer roles in this catalog — it is a legal requirement in many jurisdictions and directly affects how many real users can use a product at all.',
    'beginner',
    5,
    ARRAY[
      'Use semantic HTML elements instead of generic divs for interactive content',
      'Ensure sufficient color contrast and that color is never the only signal',
      'Make interactive elements keyboard-operable with visible focus states',
      'Write meaningful alt text and labels for non-text content and form fields',
      'Use ARIA roles only when semantic HTML cannot express the pattern'
    ],
    ARRAY[
      'Building a clickable div/span instead of a <button> or <a>, losing keyboard operability and screen-reader semantics for free',
      'Removing the default focus outline with CSS and never replacing it with a visible alternative',
      'Using color alone (red vs green) to indicate an error or status with no icon or text backup',
      'Adding ARIA attributes to "fix" accessibility without first checking if semantic HTML already solves it, often making things worse'
    ],
    'intermediate'
  ),
  (
    'nodejs-fundamentals',
    'nodejs',
    'Node.js Fundamentals',
    'Node.js is listed as a high-importance skill for Backend Developer roles in this catalog — it is the runtime behind most JavaScript-based APIs and services.',
    'beginner',
    6,
    ARRAY[
      'Understand the event loop and why Node is single-threaded but non-blocking',
      'Read and write files and handle streams for larger data',
      'Build a basic HTTP server/route handler and understand middleware',
      'Manage async control flow with async/await and handle rejected promises',
      'Understand npm, package.json, and semantic versioning basics'
    ],
    ARRAY[
      'Writing a CPU-heavy synchronous loop that blocks the single event loop thread for every other request',
      'Forgetting to handle a rejected promise, causing an unhandled rejection that can crash the process',
      'Reading an entire large file into memory instead of streaming it',
      'Committing node_modules or ignoring package-lock.json, causing inconsistent installs across environments'
    ],
    'intermediate'
  ),
  (
    'mongodb-fundamentals',
    'mongodb',
    'MongoDB Fundamentals',
    'MongoDB is listed as a nice-to-have skill for Backend Developer roles in this catalog — it is the most common document database choice when data does not fit a rigid relational schema.',
    'beginner',
    5,
    ARRAY[
      'Understand documents and collections vs rows and tables',
      'Design a schema that embeds vs references related data, and know the tradeoff',
      'Write basic CRUD queries and filters',
      'Use indexes to make common queries fast',
      'Understand when a document database is (and is not) the right fit vs a relational one'
    ],
    ARRAY[
      'Embedding data that grows unboundedly (e.g. every comment ever made) inside a single parent document, hitting document size limits',
      'Modeling MongoDB exactly like a relational database with many small referenced collections, losing the performance benefit of embedding',
      'Querying without an index on a frequently filtered field, causing full collection scans as data grows',
      'Choosing MongoDB for data that is inherently relational and transactional (e.g. financial ledgers) without a strong reason'
    ],
    'intermediate'
  ),
  (
    'java-fundamentals',
    'java',
    'Java Fundamentals',
    'Java is listed as a skill for Software Engineer roles in this catalog — it remains one of the most widely used languages for backend systems at scale, especially in enterprise environments.',
    'beginner',
    7,
    ARRAY[
      'Understand classes, objects, and the difference between an interface and a class',
      'Use core collections (List, Map, Set) and know when to reach for each',
      'Understand static vs instance members and fields',
      'Handle exceptions with try/catch and understand checked vs unchecked exceptions',
      'Understand basic generics for type-safe collections'
    ],
    ARRAY[
      'Using == to compare object contents (like Strings) instead of .equals(), comparing references instead of values',
      'Catching a broad Exception instead of the specific checked exception a method actually throws',
      'Making everything static out of convenience, losing the benefits of object-oriented design',
      'Choosing the wrong collection type (e.g. a List when uniqueness matters, or a Map when key lookup isn''t needed) for the access pattern'
    ],
    'intermediate'
  ),
  (
    'docker-fundamentals',
    'docker',
    'Docker Fundamentals',
    'Docker is listed as a skill for both Software Engineer and Backend Developer roles in this catalog — containerizing an app is now the standard way teams make "works on my machine" a solved problem.',
    'beginner',
    5,
    ARRAY[
      'Understand the difference between an image and a running container',
      'Write a basic Dockerfile that builds a small, correct image',
      'Use volumes for data that should persist beyond a container''s lifecycle',
      'Use Docker Compose to run an app alongside its dependencies (e.g. a database)',
      'Understand why smaller, layered images build and deploy faster'
    ],
    ARRAY[
      'Copying the entire project (including node_modules or .git) into the image instead of using a .dockerignore file',
      'Running a database inside a container with no volume, losing all data when the container is removed',
      'Building one giant image with every dependency instead of a multi-stage build that discards build-only tools',
      'Hardcoding secrets/credentials directly into the Dockerfile or image layers'
    ],
    'intermediate'
  ),
  (
    'ci-cd-fundamentals',
    'ci-cd',
    'CI/CD Fundamentals',
    'CI/CD is listed as a skill for Software Engineer roles in this catalog — automated testing and deployment pipelines are what let a team ship changes frequently without each release being a manual, risky event.',
    'beginner',
    5,
    ARRAY[
      'Explain what continuous integration and continuous delivery/deployment each mean',
      'Write a basic pipeline that runs tests and linting automatically on every push',
      'Understand build artifacts and environment-specific configuration',
      'Explain the purpose of a staging environment before production deploys',
      'Recognize what makes a pipeline flaky and how to reduce it'
    ],
    ARRAY[
      'Merging code without the pipeline passing, treating CI as advisory rather than a gate',
      'Hardcoding environment-specific values (URLs, keys) instead of using environment variables/secrets',
      'Skipping a staging environment and deploying straight to production for "small" changes',
      'Ignoring a flaky test instead of fixing or quarantining it, until the whole suite is distrusted'
    ],
    'intermediate'
  ),
  (
    'cloud-aws-fundamentals',
    'cloud-aws',
    'Cloud (AWS) Fundamentals',
    'AWS is listed as a skill for both Software Engineer and Backend Developer roles in this catalog — most production systems in this catalog''s target roles run on a major cloud provider, and AWS is the most common one requested.',
    'beginner',
    6,
    ARRAY[
      'Understand the core building blocks: compute (EC2/serverless), storage (S3), and managed databases (RDS)',
      'Understand IAM at a conceptual level: roles, policies, least privilege',
      'Explain the difference between a security group and a network ACL',
      'Understand regions and availability zones and why they matter for reliability',
      'Recognize basic cost drivers so a simple app does not accrue surprise charges'
    ],
    ARRAY[
      'Granting broad admin-level IAM permissions to a service instead of the specific least-privilege policy it needs',
      'Making an S3 bucket public by default instead of explicitly scoping access',
      'Running everything in a single availability zone, creating a single point of failure',
      'Leaving test resources (instances, databases) running indefinitely, accruing unnecessary cost'
    ],
    'intermediate'
  ),
  (
    'linux-fundamentals',
    'linux',
    'Linux & Shell Fundamentals',
    'Linux is listed as a high-importance skill for Cybersecurity Analyst roles in this catalog — most servers, security tools, and logs an analyst investigates live on Linux, and shell fluency is assumed daily tooling.',
    'beginner',
    6,
    ARRAY[
      'Navigate the filesystem and understand permissions (rwx, owner/group/other)',
      'Use core commands to search and filter text (grep, find, pipes)',
      'Understand processes: viewing, killing, and background jobs',
      'Read and follow logs in real time',
      'Write a simple shell script to automate a repeated task'
    ],
    ARRAY[
      'Running chmod 777 to "fix" a permissions error instead of setting the specific permission actually needed',
      'Using find with no scoping, running an expensive full-filesystem search for something in a known directory',
      'Killing a process with -9 by default instead of trying a graceful termination first',
      'Writing a shell script with no error handling, so it silently continues after a failed step'
    ],
    'intermediate'
  ),
  (
    'siem-fundamentals',
    'siem',
    'SIEM & Log Analysis Fundamentals',
    'SIEM and log analysis is listed as a high-importance skill for Cybersecurity Analyst roles in this catalog — it is the primary tool analysts use to detect and investigate suspicious activity across an environment.',
    'intermediate',
    5,
    ARRAY[
      'Explain what a SIEM aggregates and why centralized logging matters',
      'Write a basic search/query to filter events by time, source, and field',
      'Distinguish a true positive alert from a false positive and know how to reduce noise',
      'Build (or read) a simple correlation rule across multiple log sources',
      'Prioritize alerts using severity and asset context'
    ],
    ARRAY[
      'Tuning nothing and drowning in false positives until real alerts get missed in the noise',
      'Investigating a single log source in isolation when the attack pattern only becomes clear correlated across sources',
      'Treating every alert as equally urgent instead of triaging by severity and asset criticality',
      'Writing an overly broad correlation rule that fires constantly and gets ignored by the team'
    ],
    'intermediate'
  ),
  (
    'network-security-fundamentals',
    'network-security',
    'Network Security Fundamentals',
    'Network security is listed as a high-importance skill for Cybersecurity Analyst roles in this catalog — understanding networking is necessary but the job also requires knowing how to actually defend that traffic.',
    'intermediate',
    6,
    ARRAY[
      'Explain what a firewall does and the difference between stateful and stateless filtering',
      'Understand the purpose of network segmentation and why flat networks are riskier',
      'Explain the difference between an IDS and an IPS',
      'Understand VPNs at a conceptual level and what they do and do not protect against',
      'Recognize common network-based attacks: scanning, spoofing, man-in-the-middle'
    ],
    ARRAY[
      'Assuming a firewall alone fully secures a network, ignoring the need for monitoring and segmentation',
      'Running a completely flat network where a single compromised host can reach everything',
      'Confusing detection (IDS) with active blocking (IPS) and assuming logging alone stops an attack',
      'Assuming a VPN protects against every threat, when it only secures the transport, not endpoint compromise'
    ],
    'intermediate'
  ),
  (
    'ethical-hacking-fundamentals',
    'ethical-hacking',
    'Ethical Hacking / Penetration Testing Fundamentals',
    'Ethical hacking is listed as a skill for Cybersecurity Analyst roles in this catalog — understanding offensive techniques and mindset is what makes defensive monitoring effective; you cannot detect what you don''t understand as an attack.',
    'beginner',
    6,
    ARRAY[
      'Explain the standard penetration testing phases: recon, scanning, exploitation, reporting',
      'Understand the purpose and legal boundaries of authorized testing (scope, rules of engagement)',
      'Recognize common vulnerability classes at a conceptual level (e.g. injection, broken auth)',
      'Understand the difference between a vulnerability scan and a full penetration test',
      'Write a clear, actionable finding for a report (not just "it''s vulnerable")'
    ],
    ARRAY[
      'Testing systems without explicit written authorization and defined scope — this is illegal, not just risky',
      'Confusing an automated vulnerability scan with a full penetration test that validates real exploitability',
      'Writing a report that lists findings with no remediation guidance or business impact',
      'Focusing only on exploitation and skipping reconnaissance, missing context that changes the real risk'
    ],
    'intermediate'
  ),
  (
    'security-frameworks-fundamentals',
    'security-frameworks',
    'Security Frameworks & Compliance Fundamentals',
    'Security frameworks are listed as a skill for Cybersecurity Analyst roles in this catalog — analysts are frequently expected to map findings and controls to a recognized framework like NIST or ISO 27001, not just fix issues ad hoc.',
    'intermediate',
    5,
    ARRAY[
      'Explain what a security framework provides that ad hoc practices do not',
      'Understand the high-level structure of NIST CSF (identify, protect, detect, respond, recover)',
      'Understand what ISO 27001 certification actually attests to',
      'Distinguish a control from a policy and from a framework',
      'Map a real finding to the framework category it belongs to'
    ],
    ARRAY[
      'Treating framework compliance as equivalent to being secure, when it is a baseline, not a guarantee',
      'Confusing a policy document with an implemented, verified control',
      'Assuming one framework fits every industry/regulation without checking sector-specific requirements',
      'Chasing certification paperwork while skipping the actual operational practices the framework describes'
    ],
    'intermediate'
  ),
  (
    'product-strategy-fundamentals',
    'product-strategy',
    'Product Strategy Fundamentals',
    'Product strategy is listed as the single most critical, highest-demand skill for Product Manager roles in this catalog — it is what separates a PM who reacts to requests from one who decides what the product should become.',
    'intermediate',
    5,
    ARRAY[
      'Articulate a product vision distinct from a feature list',
      'Use a basic strategic framework (e.g. opportunity, target market, differentiation) to evaluate a direction',
      'Distinguish strategy from a roadmap: the "why" vs the "when"',
      'Identify the core assumption a strategy depends on and how you would validate it',
      'Say no to a plausible idea because it does not serve the strategy'
    ],
    ARRAY[
      'Confusing a list of planned features with an actual strategy that explains why they matter',
      'Chasing every competitor feature reactively instead of a differentiated position',
      'Presenting a strategy with no falsifiable assumption, so it can never be shown wrong until it''s too late',
      'Treating strategy as a one-time document instead of revisiting it as evidence comes in'
    ],
    'advanced'
  ),
  (
    'roadmapping-fundamentals',
    'roadmapping',
    'Product Roadmapping Fundamentals',
    'Roadmapping is listed as a high-importance, high-demand skill for Product Manager roles in this catalog — it is how strategy gets translated into a sequence stakeholders and engineering can actually plan around.',
    'intermediate',
    4,
    ARRAY[
      'Explain the difference between a roadmap and a project plan/Gantt chart',
      'Use a prioritization framework (e.g. RICE, value vs effort) to sequence work defensibly',
      'Communicate a roadmap using themes/outcomes rather than only feature names',
      'Handle a stakeholder request that doesn''t fit the current roadmap',
      'Revisit and re-sequence a roadmap when new evidence arrives without losing stakeholder trust'
    ],
    ARRAY[
      'Publishing a roadmap with hard dates as if it were a delivery guarantee, then losing credibility when it shifts',
      'Prioritizing by whoever asked most recently or loudest instead of a consistent framework',
      'Building a roadmap of only feature names, giving stakeholders no sense of the underlying outcome',
      'Never revisiting the roadmap after publishing it, even when strategy or evidence changes'
    ],
    'advanced'
  ),
  (
    'user-research-fundamentals',
    'user-research',
    'User Research Fundamentals',
    'User research is listed as a high-importance skill for both Product Manager and UI/UX Designer roles in this catalog — decisions made without talking to real users tend to optimize for the builder''s assumptions, not the user''s actual needs.',
    'beginner',
    5,
    ARRAY[
      'Choose the right research method for the question (generative vs evaluative)',
      'Write unbiased interview questions that don''t lead the participant',
      'Run a basic usability test and identify real friction vs a one-off comment',
      'Synthesize qualitative findings into themes instead of a list of quotes',
      'Recruit a sample that actually represents the target users'
    ],
    ARRAY[
      'Asking leading questions ("wouldn''t it be great if...") that produce agreeable, unreliable answers',
      'Treating one participant''s strong opinion as representative of all users without looking for a pattern',
      'Running only evaluative research (testing a solution) when the real question was still generative (what problem exists)',
      'Recruiting whoever is easiest to reach (colleagues, friends) instead of people who match the actual target user'
    ],
    'intermediate'
  ),
  (
    'agile-fundamentals',
    'agile',
    'Agile & Scrum Fundamentals',
    'Agile/Scrum is listed as a high-importance skill for Product Manager roles in this catalog — most engineering teams organize delivery around sprints, and a PM is expected to work fluently within that cadence.',
    'beginner',
    4,
    ARRAY[
      'Explain the core Scrum roles, events, and artifacts',
      'Write a clear user story with acceptance criteria',
      'Understand the purpose of a sprint retrospective beyond "venting"',
      'Distinguish velocity as a planning tool from velocity as a performance metric (a common misuse)',
      'Understand when Kanban''s continuous flow fits better than sprint-based Scrum'
    ],
    ARRAY[
      'Writing a vague user story with no acceptance criteria, so "done" is subjective',
      'Using team velocity to compare or rank individuals/teams instead of only for that team''s own planning',
      'Turning retrospectives into status updates instead of genuine process improvement discussions',
      'Forcing Scrum ceremonies onto a support/maintenance-style workflow where Kanban would fit better'
    ],
    'intermediate'
  ),
  (
    'stakeholder-management-fundamentals',
    'stakeholder-management',
    'Stakeholder Management Fundamentals',
    'Stakeholder management is listed as a critical-importance skill for Product Manager roles in this catalog — a PM has no direct authority over engineering or design, so influence and clear communication are the actual mechanism for getting things done.',
    'intermediate',
    4,
    ARRAY[
      'Map stakeholders by influence and interest to prioritize communication effort',
      'Communicate a decision (including a "no") with the reasoning, not just the outcome',
      'Handle conflicting stakeholder priorities without simply deferring to the loudest voice',
      'Set expectations proactively instead of only reacting to escalations',
      'Give and receive difficult feedback across a cross-functional team without direct authority'
    ],
    ARRAY[
      'Saying "no" to a stakeholder with no reasoning given, damaging trust even when the decision was right',
      'Spending equal time on every stakeholder instead of focusing on the ones with real influence and interest',
      'Avoiding a hard conversation until it becomes an escalation instead of surfacing it early',
      'Letting the most vocal stakeholder set priority by default instead of a consistent evaluation'
    ],
    'advanced'
  ),
  (
    'product-analytics-fundamentals',
    'product-analytics',
    'Product Analytics Fundamentals',
    'Product analytics is listed as a high-importance skill for Product Manager roles in this catalog — deciding what to build next without measuring what already shipped means repeating the same mistakes.',
    'intermediate',
    5,
    ARRAY[
      'Define a north star metric and the input metrics that drive it',
      'Build and read a basic funnel to find the real drop-off point',
      'Distinguish an activation metric from a retention metric',
      'Design a basic A/B test and know what makes a result trustworthy',
      'Avoid common metric traps: vanity metrics, Simpson''s paradox, survivorship bias'
    ],
    ARRAY[
      'Optimizing a vanity metric (e.g. total signups) that doesn''t connect to real retention or revenue',
      'Reading a funnel drop-off as "the problem" without segmenting to find which specific user group is actually dropping',
      'Calling an A/B test result significant with too small a sample or too short a runtime',
      'Looking only at aggregate retention and missing that it differs wildly by acquisition channel or segment'
    ],
    'advanced'
  ),
  (
    'ui-design-fundamentals',
    'ui-design',
    'UI Design Fundamentals',
    'UI design is listed as the single most critical, highest-demand skill for UI/UX Designer roles in this catalog — it is the visual craft layer that makes a usable interface also feel trustworthy and coherent.',
    'beginner',
    6,
    ARRAY[
      'Apply a type hierarchy and consistent spacing scale instead of ad hoc sizing',
      'Use color with intention: primary/secondary actions, state, and sufficient contrast',
      'Design consistent, reusable components instead of one-off variations',
      'Apply visual hierarchy so the most important action is unambiguous',
      'Design clear empty, loading, and error states, not just the "happy path"'
    ],
    ARRAY[
      'Using more than one or two accent colors with no consistent meaning, making the interface feel arbitrary',
      'Designing only the happy path and leaving empty/error/loading states as an afterthought for engineering to guess',
      'Inconsistent spacing/sizing across similar components, making the interface feel unpolished',
      'Making every element visually loud, so nothing actually stands out as the primary action'
    ],
    'intermediate'
  ),
  (
    'ux-design-fundamentals',
    'ux-design',
    'UX Design Fundamentals',
    'UX design is listed as a critical-importance skill for UI/UX Designer roles in this catalog — it is the reasoning behind an interface (information architecture, flow, feedback) that determines whether users can actually accomplish their goal.',
    'beginner',
    6,
    ARRAY[
      'Map a user flow before jumping into visual design',
      'Structure information architecture so users can predict where things live',
      'Apply core usability heuristics (feedback, consistency, error prevention)',
      'Design for error: prevention, clear messaging, and easy recovery',
      'Reduce a flow to the minimum necessary steps without removing needed context'
    ],
    ARRAY[
      'Designing screens before mapping the end-to-end flow, causing dead ends or missing states',
      'Organizing navigation around internal team structure instead of how users actually think about tasks',
      'Giving no feedback after a user action, leaving them unsure if it worked',
      'Adding steps to a flow "just in case" instead of only what''s needed to complete the task safely'
    ],
    'intermediate'
  ),
  (
    'prototyping-fundamentals',
    'prototyping',
    'Prototyping Fundamentals',
    'Prototyping is listed as a high-importance skill for UI/UX Designer roles in this catalog — a clickable prototype is what lets a design be tested with real users and reviewed by stakeholders before any code is written.',
    'beginner',
    4,
    ARRAY[
      'Choose the right prototype fidelity for the question you''re trying to answer',
      'Build a clickable, linked prototype covering the primary flow',
      'Use interactive components (variants, states) instead of static frames alone',
      'Prepare a prototype for a usability test with realistic content',
      'Know when a prototype is "good enough" to test vs needs more fidelity'
    ],
    ARRAY[
      'Jumping straight to a pixel-perfect high-fidelity prototype for an idea that hasn''t validated the concept yet',
      'Building a prototype with only the "happy path" linked, breaking the test the moment a user clicks somewhere unexpected',
      'Using placeholder Lorem Ipsum content that hides real content-length problems the real interface will face',
      'Treating a prototype as production-ready design, skipping the states (error, empty, edge case) real usage will hit'
    ],
    'intermediate'
  ),
  (
    'design-systems-fundamentals',
    'design-systems',
    'Design Systems Fundamentals',
    'Design systems are listed as a skill for both Frontend Developer and UI/UX Designer roles in this catalog — they are the shared source of truth that keeps a growing product visually and functionally consistent across many contributors.',
    'intermediate',
    5,
    ARRAY[
      'Explain what belongs in a design system (tokens, components, patterns) vs a one-off design',
      'Use design tokens (color, spacing, type) instead of hardcoded values',
      'Design and document a component with its variants and states',
      'Understand the governance question: who can add/change a shared component',
      'Recognize when a one-off design should become a system pattern instead'
    ],
    ARRAY[
      'Hardcoding a color or spacing value instead of referencing the shared token, causing drift over time',
      'Adding a new "one-off" component variant without checking if the pattern already exists in the system',
      'Documenting only the default state of a component and skipping hover/disabled/error states, so engineers guess',
      'Letting anyone change a shared component with no review process, causing inconsistent breaking changes'
    ],
    'intermediate'
  ),
  (
    'communication-fundamentals',
    'communication',
    'Workplace Communication Fundamentals',
    'Communication is listed as a critical or high-importance skill for Data Analyst and Product Manager roles in this catalog — technically correct work that can''t be explained clearly to a non-technical stakeholder often fails to create any impact.',
    'beginner',
    3,
    ARRAY[
      'Lead with the conclusion/recommendation before the supporting detail',
      'Adjust technical depth to the audience (executive vs practitioner)',
      'Give feedback that is specific and actionable, not just critical',
      'Write a concise status update that answers "what do you need from me?"',
      'Ask a clarifying question instead of guessing at ambiguous requirements'
    ],
    ARRAY[
      'Structuring a report chronologically (methodology first) instead of leading with the conclusion a busy stakeholder needs',
      'Using the same level of technical detail for an executive summary as for a peer review',
      'Giving vague feedback ("this doesn''t feel right") with no specific, actionable change requested',
      'Proceeding on an ambiguous requirement instead of asking one clarifying question up front'
    ],
    'intermediate'
  ),
  (
    'problem-solving-fundamentals',
    'problem-solving',
    'Analytical Problem Solving Fundamentals',
    'Problem solving is listed as a skill for both Data Analyst and Software Engineer roles in this catalog — tools and syntax can be looked up, but breaking an ambiguous problem into a solvable structure is the actual differentiator.',
    'beginner',
    4,
    ARRAY[
      'Break an ambiguous problem into smaller, testable sub-questions',
      'Form a hypothesis before diving into data or code, then check it',
      'Use a structured framework (e.g. root-cause "5 whys") instead of guessing at a fix',
      'Distinguish a symptom from the underlying root cause',
      'Know when to stop investigating and communicate a reasonable answer given the constraints'
    ],
    ARRAY[
      'Diving straight into data/code with no hypothesis, so the investigation has no clear stopping point',
      'Fixing the first visible symptom without checking if it''s the actual root cause, so the problem recurs',
      'Treating an ambiguous problem as fully solvable with more time, when a reasonable, bounded answer would do',
      'Skipping any structure at all and jumping between unrelated theories without ruling any of them out first'
    ],
    'intermediate'
  )
) AS v(slug, skill_slug, title, why, diff, hours, objectives, mistakes, target)
JOIN public.skills s ON s.slug = v.skill_slug
ON CONFLICT (slug) DO NOTHING;
