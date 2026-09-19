
INSERT INTO public.skills (slug, name, category, aliases) VALUES
('sql','SQL','Data',ARRAY['structured query language','sql server','t-sql','mysql','postgresql query','plsql']),
('excel','Excel','Data',ARRAY['microsoft excel','ms excel','spreadsheets','google sheets']),
('python','Python','Programming',ARRAY['python3','py']),
('statistics','Statistics','Data',ARRAY['stats','statistical analysis','probability']),
('power-bi','Power BI','Data',ARRAY['microsoft power bi','powerbi','power-bi']),
('tableau','Tableau','Data',ARRAY['tableau desktop']),
('data-visualization','Data Visualization','Data',ARRAY['dataviz','charting','visualisation']),
('business-analytics','Business Analytics','Data',ARRAY['business intelligence','bi','business analysis']),
('pandas','Pandas','Data',ARRAY['python pandas']),
('machine-learning','Machine Learning','Data',ARRAY['ml','supervised learning','scikit-learn']),
('deep-learning','Deep Learning','Data',ARRAY['neural networks','pytorch','tensorflow']),
('r-language','R','Data',ARRAY['r programming','rstudio']),
('javascript','JavaScript','Programming',ARRAY['js','es6','ecmascript']),
('typescript','TypeScript','Programming',ARRAY['ts']),
('react','React','Frontend',ARRAY['reactjs','react.js']),
('html-css','HTML & CSS','Frontend',ARRAY['html','css','html5','css3']),
('tailwind','Tailwind CSS','Frontend',ARRAY['tailwindcss']),
('nextjs','Next.js','Frontend',ARRAY['next js','nextjs']),
('accessibility','Web Accessibility','Frontend',ARRAY['a11y','wcag']),
('nodejs','Node.js','Backend',ARRAY['node','nodejs','node js']),
('api-design','API Design','Backend',ARRAY['rest api','restful','graphql','api development']),
('postgresql','PostgreSQL','Backend',ARRAY['postgres','psql']),
('mongodb','MongoDB','Backend',ARRAY['mongo','nosql']),
('system-design','System Design','Backend',ARRAY['architecture','distributed systems','scalability']),
('java','Java','Programming',ARRAY['core java','java se']),
('git','Git & Version Control','Engineering',ARRAY['git','github','version control']),
('docker','Docker','Engineering',ARRAY['containers','containerization']),
('ci-cd','CI/CD','Engineering',ARRAY['continuous integration','github actions','jenkins']),
('testing','Automated Testing','Engineering',ARRAY['unit testing','jest','pytest','qa']),
('cloud-aws','Cloud (AWS)','Engineering',ARRAY['aws','amazon web services','ec2','s3']),
('linux','Linux','Engineering',ARRAY['unix','bash','shell scripting']),
('networking','Networking','Security',ARRAY['tcp/ip','network fundamentals','dns']),
('network-security','Network Security','Security',ARRAY['firewalls','ids','ips']),
('siem','SIEM & Log Analysis','Security',ARRAY['splunk','security monitoring','log analysis']),
('incident-response','Incident Response','Security',ARRAY['ir','threat response','forensics']),
('ethical-hacking','Ethical Hacking','Security',ARRAY['penetration testing','pentesting','offensive security']),
('security-frameworks','Security Frameworks','Security',ARRAY['nist','iso 27001','compliance']),
('product-strategy','Product Strategy','Product',ARRAY['product vision','strategy']),
('roadmapping','Roadmapping','Product',ARRAY['product roadmap','prioritization']),
('user-research','User Research','Design',ARRAY['ux research','customer interviews','usability testing']),
('agile','Agile & Scrum','Product',ARRAY['scrum','kanban','agile methodology']),
('stakeholder-management','Stakeholder Management','Product',ARRAY['stakeholder communication']),
('product-analytics','Product Analytics','Product',ARRAY['amplitude','mixpanel','funnel analysis']),
('figma','Figma','Design',ARRAY['figma design','sketch']),
('ui-design','UI Design','Design',ARRAY['visual design','interface design']),
('ux-design','UX Design','Design',ARRAY['user experience','interaction design']),
('prototyping','Prototyping','Design',ARRAY['wireframing','mockups']),
('design-systems','Design Systems','Design',ARRAY['component library','style guide']),
('communication','Communication','Soft Skills',ARRAY['presentation','storytelling']),
('problem-solving','Problem Solving','Soft Skills',ARRAY['analytical thinking','critical thinking'])
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.careers (slug, title, short_description, description, seo_title, seo_description, typical_salary_min, typical_salary_max) VALUES
('data-analyst','Data Analyst','Turn raw data into decisions with SQL, spreadsheets and BI dashboards.','Data Analysts collect, clean and interpret data to help organisations make better decisions. The role blends SQL, spreadsheet fluency, statistics and business-intelligence tooling with clear communication.','Data Analyst Career Roadmap | RoleReady','Learn exactly what employers ask for in Data Analyst roles and follow a 6-month roadmap built from real job requirements.',55000,95000),
('software-engineer','Software Engineer','Design, build and ship reliable software systems end to end.','Software Engineers build and maintain applications and services. The role emphasises programming fundamentals, data structures, system design, testing and collaborative version control.','Software Engineer Career Roadmap | RoleReady','See the skills software engineering roles actually require and get a personalised 6-month learning roadmap.',70000,130000),
('frontend-developer','Frontend Developer','Build fast, accessible user interfaces for the web.','Frontend Developers translate design into performant, accessible interfaces using HTML, CSS, JavaScript and modern component frameworks.','Frontend Developer Career Roadmap | RoleReady','Compare your skills against real frontend job requirements and build a 6-month roadmap to job readiness.',60000,115000),
('backend-developer','Backend Developer','Build APIs, data models and the services behind the product.','Backend Developers design APIs, model data and operate services in production, focusing on correctness, security and scale.','Backend Developer Career Roadmap | RoleReady','Find the exact backend skills employers request and follow a structured 6-month roadmap.',65000,125000),
('data-scientist','Data Scientist','Model data, run experiments and ship predictions.','Data Scientists combine statistics, programming and machine learning to answer questions and build predictive systems.','Data Scientist Career Roadmap | RoleReady','Build a data science roadmap grounded in real job requirements, not generic advice.',80000,145000),
('cybersecurity-analyst','Cybersecurity Analyst','Detect, investigate and respond to security threats.','Cybersecurity Analysts monitor systems, investigate alerts and harden infrastructure against attacks using networking, SIEM and incident-response skills.','Cybersecurity Analyst Career Roadmap | RoleReady','See what security teams hire for and get a 6-month roadmap toward your first analyst role.',70000,120000),
('product-manager','Product Manager','Decide what to build, why, and in what order.','Product Managers own outcomes: discovery, prioritisation, delivery and measurement across engineering, design and business stakeholders.','Product Manager Career Roadmap | RoleReady','Understand the skills product roles require and follow a practical 6-month roadmap.',85000,150000),
('ui-ux-designer','UI/UX Designer','Research, design and validate product experiences.','UI/UX Designers research user needs, prototype solutions and craft interfaces backed by design systems and usability testing.','UI/UX Designer Career Roadmap | RoleReady','Compare your design skills with real UI/UX job requirements and get a 6-month roadmap.',55000,105000)
ON CONFLICT (slug) DO NOTHING;

-- CAREER SKILLS
INSERT INTO public.career_skills (career_id, skill_id, importance, required_level, demand_percentage, sort_order)
SELECT c.id, s.id, v.importance::public.skill_importance, v.req::public.proficiency_level, v.demand, v.ord
FROM (VALUES
('data-analyst','sql','critical','advanced',84,1),
('data-analyst','excel','high','advanced',76,2),
('data-analyst','power-bi','high','intermediate',61,3),
('data-analyst','python','medium','intermediate',48,4),
('data-analyst','tableau','medium','intermediate',35,5),
('data-analyst','statistics','high','intermediate',52,6),
('data-analyst','data-visualization','high','advanced',58,7),
('data-analyst','business-analytics','high','intermediate',44,8),
('data-analyst','communication','high','advanced',40,9),
('data-analyst','problem-solving','medium','advanced',33,10),
('data-analyst','pandas','medium','intermediate',29,11),
('data-analyst','postgresql','nice_to_have','beginner',18,12),
('software-engineer','python','high','advanced',62,1),
('software-engineer','javascript','high','advanced',66,2),
('software-engineer','git','critical','advanced',81,3),
('software-engineer','system-design','high','intermediate',47,4),
('software-engineer','api-design','high','advanced',59,5),
('software-engineer','testing','high','intermediate',52,6),
('software-engineer','postgresql','medium','intermediate',44,7),
('software-engineer','docker','medium','intermediate',41,8),
('software-engineer','ci-cd','medium','intermediate',38,9),
('software-engineer','cloud-aws','medium','beginner',43,10),
('software-engineer','java','medium','intermediate',35,11),
('software-engineer','problem-solving','high','advanced',49,12),
('frontend-developer','html-css','critical','advanced',88,1),
('frontend-developer','javascript','critical','advanced',85,2),
('frontend-developer','react','high','advanced',72,3),
('frontend-developer','typescript','high','intermediate',64,4),
('frontend-developer','accessibility','high','intermediate',37,5),
('frontend-developer','tailwind','medium','intermediate',31,6),
('frontend-developer','git','high','intermediate',70,7),
('frontend-developer','testing','medium','intermediate',34,8),
('frontend-developer','nextjs','medium','intermediate',33,9),
('frontend-developer','design-systems','medium','beginner',26,10),
('backend-developer','api-design','critical','advanced',80,1),
('backend-developer','nodejs','high','advanced',55,2),
('backend-developer','postgresql','high','advanced',63,3),
('backend-developer','sql','high','advanced',68,4),
('backend-developer','system-design','high','intermediate',51,5),
('backend-developer','docker','high','intermediate',46,6),
('backend-developer','cloud-aws','medium','intermediate',45,7),
('backend-developer','testing','high','intermediate',48,8),
('backend-developer','git','high','advanced',74,9),
('backend-developer','mongodb','nice_to_have','beginner',22,10),
('data-scientist','python','critical','advanced',86,1),
('data-scientist','statistics','critical','advanced',78,2),
('data-scientist','machine-learning','critical','advanced',74,3),
('data-scientist','pandas','high','advanced',61,4),
('data-scientist','sql','high','intermediate',66,5),
('data-scientist','data-visualization','high','intermediate',49,6),
('data-scientist','deep-learning','medium','intermediate',38,7),
('data-scientist','r-language','nice_to_have','beginner',21,8),
('data-scientist','communication','high','intermediate',42,9),
('cybersecurity-analyst','networking','critical','advanced',79,1),
('cybersecurity-analyst','linux','high','intermediate',58,2),
('cybersecurity-analyst','siem','high','intermediate',54,3),
('cybersecurity-analyst','incident-response','critical','intermediate',62,4),
('cybersecurity-analyst','network-security','high','advanced',67,5),
('cybersecurity-analyst','ethical-hacking','medium','beginner',35,6),
('cybersecurity-analyst','security-frameworks','medium','intermediate',44,7),
('cybersecurity-analyst','python','medium','beginner',31,8),
('product-manager','product-strategy','critical','advanced',72,1),
('product-manager','roadmapping','high','advanced',65,2),
('product-manager','user-research','high','intermediate',53,3),
('product-manager','product-analytics','high','intermediate',58,4),
('product-manager','agile','high','advanced',61,5),
('product-manager','stakeholder-management','critical','advanced',69,6),
('product-manager','sql','medium','beginner',34,7),
('product-manager','communication','critical','advanced',77,8),
('ui-ux-designer','figma','critical','advanced',82,1),
('ui-ux-designer','ui-design','critical','advanced',76,2),
('ui-ux-designer','ux-design','critical','advanced',74,3),
('ui-ux-designer','user-research','high','intermediate',57,4),
('ui-ux-designer','prototyping','high','advanced',63,5),
('ui-ux-designer','design-systems','high','intermediate',48,6),
('ui-ux-designer','accessibility','medium','intermediate',36,7),
('ui-ux-designer','html-css','nice_to_have','beginner',24,8)
) AS v(career_slug, skill_slug, importance, req, demand, ord)
JOIN public.careers c ON c.slug = v.career_slug
JOIN public.skills s ON s.slug = v.skill_slug
ON CONFLICT (career_id, skill_id) DO NOTHING;

-- DEMO JOB SOURCE + JOBS
INSERT INTO public.job_sources (slug, name, adapter, is_enabled, is_demo, notes)
VALUES ('demo-sample','Demo sample set','demo', true, true, 'Illustrative postings shipped with the product. Not real, current job postings.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.jobs (source_id, external_id, title, company, location, country, work_mode, salary_min, salary_max, salary_currency, description, experience_years_min, education_requirement, career_id, source_url, posted_at, is_demo)
SELECT src.id, v.ext, v.title, v.company, v.loc, v.country, v.mode::public.work_mode, v.smin, v.smax, 'USD', v.descr, v.exp, 'bachelors'::public.education_level, c.id, NULL, now() - (v.days || ' days')::interval, true
FROM (VALUES
('demo-da-1','Junior Data Analyst','Demo Company A','Austin, TX','US','hybrid',58000,72000,'Sample posting used to demonstrate skill matching. Requires SQL, Excel and dashboarding.',0,'data-analyst',4),
('demo-da-2','Business Data Analyst','Demo Company B','Remote','US','remote',70000,88000,'Sample posting. Focus on SQL, Power BI and stakeholder reporting.',2,'data-analyst',9),
('demo-da-3','Marketing Analyst','Demo Company C','Chicago, IL','US','onsite',62000,78000,'Sample posting. Excel modelling, campaign analytics and visualization.',1,'data-analyst',14),
('demo-se-1','Software Engineer I','Demo Company D','Remote','US','remote',85000,110000,'Sample posting. Python or JavaScript, testing and code review culture.',0,'software-engineer',6),
('demo-fe-1','Frontend Developer','Demo Company E','Berlin','DE','hybrid',60000,80000,'Sample posting. React, TypeScript and accessible UI work.',2,'frontend-developer',3),
('demo-be-1','Backend Engineer','Demo Company F','Remote','US','remote',95000,125000,'Sample posting. Node.js APIs, PostgreSQL and containerised deploys.',3,'backend-developer',7),
('demo-ds-1','Data Scientist','Demo Company G','Bengaluru','IN','hybrid',90000,130000,'Sample posting. Python, statistics and applied machine learning.',2,'data-scientist',11),
('demo-cy-1','SOC Analyst (Tier 1)','Demo Company H','Remote','US','remote',68000,85000,'Sample posting. SIEM monitoring, triage and incident response.',0,'cybersecurity-analyst',5),
('demo-pm-1','Associate Product Manager','Demo Company I','London','GB','hybrid',70000,95000,'Sample posting. Discovery, roadmapping and analytics.',1,'product-manager',8),
('demo-ux-1','Product Designer','Demo Company J','Remote','US','remote',75000,100000,'Sample posting. Figma, design systems and usability testing.',2,'ui-ux-designer',10)
) AS v(ext, title, company, loc, country, mode, smin, smax, descr, exp, career_slug, days)
JOIN public.job_sources src ON src.slug = 'demo-sample'
JOIN public.careers c ON c.slug = v.career_slug
ON CONFLICT (source_id, external_id) WHERE external_id IS NOT NULL DO NOTHING;

INSERT INTO public.job_skills (job_id, skill_id, is_required)
SELECT j.id, cs.skill_id, cs.importance IN ('critical','high')
FROM public.jobs j
JOIN public.career_skills cs ON cs.career_id = j.career_id AND cs.sort_order <= 6
ON CONFLICT (job_id, skill_id) DO NOTHING;

-- RESOURCES (real, stable URLs only)
INSERT INTO public.resources (title, provider, url, type, skill_id, is_free, description)
SELECT v.title, v.provider, v.url, v.rtype::public.resource_type, s.id, v.free, v.descr
FROM (VALUES
('PostgreSQL Tutorial','PostgreSQL','https://www.postgresql.org/docs/current/tutorial.html','documentation','sql',true,'Official hands-on SQL tutorial.'),
('SQL Practice Problems','Kaggle','https://www.kaggle.com/learn/intro-to-sql','course','sql',true,'Short interactive SQL course.'),
('Excel help & learning','Microsoft','https://support.microsoft.com/en-us/excel','documentation','excel',true,'Official Excel documentation and how-tos.'),
('Power BI learning paths','Microsoft Learn','https://learn.microsoft.com/en-us/training/powerplatform/power-bi','course','power-bi',true,'Free structured Power BI training.'),
('Python Tutorial','Python.org','https://docs.python.org/3/tutorial/','documentation','python',true,'The official Python tutorial.'),
('pandas User Guide','pandas','https://pandas.pydata.org/docs/user_guide/index.html','documentation','pandas',true,'Reference guide for data wrangling in pandas.'),
('Seeing Theory','Brown University','https://seeing-theory.brown.edu/','practice','statistics',true,'Visual introduction to probability and statistics.'),
('Tableau Free Training Videos','Tableau','https://www.tableau.com/learn/training/','video','tableau',true,'Vendor training library.'),
('MDN JavaScript Guide','MDN','https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide','documentation','javascript',true,'Comprehensive JavaScript reference.'),
('MDN Learn HTML & CSS','MDN','https://developer.mozilla.org/en-US/docs/Learn','course','html-css',true,'Structured web fundamentals curriculum.'),
('React Docs','React','https://react.dev/learn','documentation','react',true,'Modern React learning path.'),
('TypeScript Handbook','Microsoft','https://www.typescriptlang.org/docs/handbook/intro.html','documentation','typescript',true,'Official TypeScript handbook.'),
('Tailwind CSS Docs','Tailwind Labs','https://tailwindcss.com/docs','documentation','tailwind',true,'Utility-first CSS reference.'),
('Next.js Learn','Vercel','https://nextjs.org/learn','course','nextjs',true,'Official Next.js course.'),
('WCAG Quick Reference','W3C','https://www.w3.org/WAI/WCAG22/quickref/','documentation','accessibility',true,'Accessibility success criteria reference.'),
('Node.js Guides','OpenJS Foundation','https://nodejs.org/en/learn','documentation','nodejs',true,'Official Node.js learning guides.'),
('PostgreSQL Documentation','PostgreSQL','https://www.postgresql.org/docs/current/','documentation','postgresql',true,'Complete Postgres reference.'),
('MongoDB Manual','MongoDB','https://www.mongodb.com/docs/manual/','documentation','mongodb',true,'Official MongoDB documentation.'),
('Pro Git','Git SCM','https://git-scm.com/book/en/v2','book','git',true,'The free Pro Git book.'),
('Docker Get Started','Docker','https://docs.docker.com/get-started/','documentation','docker',true,'Container fundamentals.'),
('GitHub Actions Docs','GitHub','https://docs.github.com/en/actions','documentation','ci-cd',true,'CI/CD pipelines with Actions.'),
('AWS Skill Builder','AWS','https://skillbuilder.aws/','course','cloud-aws',true,'Free foundational cloud courses.'),
('The Linux Command Line','William Shotts','https://linuxcommand.org/tlcl.php','book','linux',true,'Free book on the Linux shell.'),
('Computer Networking Course','Cisco Networking Academy','https://www.netacad.com/','course','networking',true,'Networking fundamentals training.'),
('NIST Cybersecurity Framework','NIST','https://www.nist.gov/cyberframework','documentation','security-frameworks',true,'Reference security framework.'),
('OWASP Top Ten','OWASP','https://owasp.org/www-project-top-ten/','documentation','network-security',true,'Most critical web security risks.'),
('TryHackMe','TryHackMe','https://tryhackme.com/','practice','ethical-hacking',true,'Hands-on security labs.'),
('Figma Learn','Figma','https://help.figma.com/hc/en-us','documentation','figma',true,'Official Figma help centre.'),
('Nielsen Norman Group Articles','NN/g','https://www.nngroup.com/articles/','documentation','ux-design',true,'Evidence-based UX research articles.'),
('Material Design Guidelines','Google','https://m3.material.io/','documentation','design-systems',true,'A reference design system.'),
('Scrum Guide','Scrum.org','https://scrumguides.org/','documentation','agile',true,'The canonical Scrum definition.'),
('scikit-learn User Guide','scikit-learn','https://scikit-learn.org/stable/user_guide.html','documentation','machine-learning',true,'Practical machine learning reference.'),
('PyTorch Tutorials','PyTorch','https://pytorch.org/tutorials/','documentation','deep-learning',true,'Deep learning tutorials.'),
('Data Visualisation Catalogue','Severino Ribecca','https://datavizcatalogue.com/','documentation','data-visualization',true,'Chart selection reference.')
) AS v(title, provider, url, rtype, skill_slug, free, descr)
JOIN public.skills s ON s.slug = v.skill_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources existing
  WHERE existing.skill_id = s.id AND existing.url = v.url
);

-- PROJECT TEMPLATES
INSERT INTO public.projects (slug, title, summary, difficulty, estimated_hours, career_id, skills, dataset_suggestion, requirements, expected_output, readme_outline, resume_bullet)
SELECT v.slug, v.title, v.summary, v.diff::public.difficulty_level, v.hours, c.id, v.skills, v.dataset, v.reqs, v.output, v.readme, v.bullet
FROM (VALUES
('sales-performance-dashboard','Sales Performance Dashboard','Turn a raw CSV of transactions into an executive-ready dashboard.','beginner',15,'data-analyst',ARRAY['Excel','Data Visualization','Business Analytics'],'Any public retail transactions dataset (e.g. Kaggle retail sales).',ARRAY['Clean and de-duplicate the raw export','Build a pivot-table summary by region and month','Add KPI cards for revenue, margin and growth','Publish a one-page dashboard with filters'],'A single-page interactive dashboard plus a short written summary of findings.',ARRAY['Problem statement','Data source and caveats','Cleaning steps','Dashboard walkthrough','Key findings'],'Built an executive sales dashboard from a raw 50k-row transaction export, cutting manual reporting time.'),
('customer-churn-analysis','Customer Churn Analysis Dashboard','Analyse churn drivers with SQL and present them visually.','intermediate',15,'data-analyst',ARRAY['SQL','Excel','Power BI','Statistics'],'Telco customer churn dataset (public).',ARRAY['Model the data in SQL with reusable views','Calculate churn rate by cohort and segment','Test whether differences are statistically meaningful','Build a Power BI report with drill-through'],'A churn report identifying the top three drivers with supporting evidence.',ARRAY['Business question','Data model','SQL queries','Statistical checks','Recommendations'],'Identified top three churn drivers from a customer dataset using SQL cohort analysis and a Power BI report.'),
('personal-portfolio-site','Accessible Portfolio Website','Ship a fast, accessible personal site with a component-based architecture.','beginner',12,'frontend-developer',ARRAY['HTML & CSS','JavaScript','React','Web Accessibility'],NULL,ARRAY['Responsive layout across three breakpoints','Keyboard-navigable navigation and forms','Lighthouse accessibility score above 95','Deployed with a custom domain or subdomain'],'A deployed portfolio site with source on GitHub.',ARRAY['Overview','Stack','Accessibility notes','Performance results','Local setup'],'Designed and shipped an accessible React portfolio scoring 95+ on Lighthouse accessibility.'),
('rest-api-service','Task API with Auth','Build a production-shaped REST API with authentication and tests.','intermediate',20,'backend-developer',ARRAY['Node.js','API Design','PostgreSQL','Automated Testing'],NULL,ARRAY['CRUD endpoints with validation','Token-based authentication and authorisation','Postgres schema with migrations','Integration test suite in CI'],'A documented API with an OpenAPI spec and passing CI pipeline.',ARRAY['API overview','Auth model','Schema','Running tests','Deployment'],'Built and tested an authenticated REST API on Node.js and PostgreSQL with CI-enforced integration tests.'),
('ml-prediction-model','Predictive Model End-to-End','Train, evaluate and explain a supervised model.','advanced',25,'data-scientist',ARRAY['Python','Pandas','Machine Learning','Statistics'],'Any public tabular dataset with a clear target variable.',ARRAY['Exploratory analysis and leakage checks','Baseline plus two candidate models','Cross-validated evaluation with the right metric','Model explanation with feature importance'],'A reproducible notebook plus a short model card.',ARRAY['Problem framing','Data','Modelling approach','Evaluation','Limitations'],'Trained and evaluated a cross-validated prediction model, documenting performance and limitations in a model card.'),
('security-log-triage','SIEM Log Triage Lab','Investigate simulated security events and write an incident report.','intermediate',14,'cybersecurity-analyst',ARRAY['SIEM & Log Analysis','Incident Response','Networking'],'Public sample security log sets from open lab environments.',ARRAY['Ingest sample logs into a SIEM or log tool','Write detection queries for three attack patterns','Triage alerts and classify severity','Produce an incident report with timeline'],'An incident report with timeline, evidence and remediation steps.',ARRAY['Scenario','Detections used','Timeline','Findings','Remediation'],'Investigated simulated intrusion logs and produced a full incident report with detection queries and remediation steps.'),
('product-discovery-case','Product Discovery Case Study','Run a discovery cycle from problem to prioritised roadmap.','intermediate',12,'product-manager',ARRAY['User Research','Product Strategy','Roadmapping','Product Analytics'],NULL,ARRAY['Five user interviews with a written synthesis','Opportunity solution tree','Prioritised roadmap with rationale','Success metrics per initiative'],'A case study deck covering research, decisions and metrics.',ARRAY['Context','Research method','Insights','Prioritisation','Metrics'],'Ran a five-interview discovery cycle and translated insights into a prioritised, metric-backed product roadmap.'),
('ux-redesign-case','UX Redesign Case Study','Redesign a real flow and validate it with users.','beginner',14,'ui-ux-designer',ARRAY['Figma','UX Design','UI Design','Prototyping'],NULL,ARRAY['Heuristic audit of the current flow','Wireframes and a high-fidelity prototype','Usability test with five participants','Before/after metrics or task-success comparison'],'A Figma prototype plus a written case study.',ARRAY['Problem','Audit','Design decisions','Testing','Outcome'],'Redesigned a checkout flow and validated it with five usability tests, improving task completion in testing.')
) AS v(slug, title, summary, diff, hours, career_slug, skills, dataset, reqs, output, readme, bullet)
JOIN public.careers c ON c.slug = v.career_slug
ON CONFLICT (slug) DO NOTHING;

-- ASSESSMENTS
INSERT INTO public.assessments (slug, title, skill_id, difficulty, description)
SELECT v.slug, v.title, s.id, v.diff::public.difficulty_level, v.descr
FROM (VALUES
('sql-basics','SQL Fundamentals','sql','beginner','Five questions covering SELECT, JOIN, GROUP BY and filtering.'),
('excel-basics','Excel Essentials','excel','beginner','Five questions on formulas, lookups and pivot tables.'),
('statistics-basics','Statistics Foundations','statistics','beginner','Five questions on distributions, averages and significance.'),
('power-bi-basics','Power BI Basics','power-bi','beginner','Five questions on models, DAX and visuals.')
) AS v(slug, title, skill_slug, diff, descr)
JOIN public.skills s ON s.slug = v.skill_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assessment_questions (assessment_id, prompt, options, correct_index, explanation, sort_order)
SELECT a.id, v.prompt, v.opts, v.correct, v.expl, v.ord
FROM (VALUES
('sql-basics','Which clause filters rows BEFORE aggregation?',ARRAY['HAVING','WHERE','ORDER BY','LIMIT'],1,'WHERE filters rows before grouping; HAVING filters after aggregation.',1),
('sql-basics','Which join returns all rows from the left table regardless of matches?',ARRAY['INNER JOIN','LEFT JOIN','CROSS JOIN','SELF JOIN'],1,'LEFT JOIN keeps every left-side row, filling unmatched right columns with NULL.',2),
('sql-basics','What does COUNT(*) count?',ARRAY['Only non-null values in the first column','All rows in the group','Distinct rows','Only indexed rows'],1,'COUNT(*) counts every row, including rows with NULLs.',3),
('sql-basics','Which is used to remove duplicate rows from a result set?',ARRAY['DISTINCT','UNIQUE','GROUP','DEDUPE'],0,'SELECT DISTINCT removes duplicate result rows.',4),
('sql-basics','A window function differs from GROUP BY because it:',ARRAY['Cannot use aggregates','Returns one row per group','Keeps individual rows while adding aggregate values','Only works on dates'],2,'Window functions compute across a partition without collapsing rows.',5),
('excel-basics','Which function looks up a value and can search left or right?',ARRAY['VLOOKUP','XLOOKUP','HLOOKUP','LOOKUPX'],1,'XLOOKUP searches in any direction and returns a default when not found.',1),
('excel-basics','A PivotTable is primarily used to:',ARRAY['Format cells','Summarise and cross-tabulate data','Write macros','Protect a workbook'],1,'PivotTables aggregate and cross-tabulate large tables quickly.',2),
('excel-basics','$A$1 in a formula is a:',ARRAY['Relative reference','Absolute reference','Named range','Array formula'],1,'Dollar signs lock the row and column when copying a formula.',3),
('excel-basics','Power Query is used for:',ARRAY['Charting','Repeatable data import and transformation','Printing','Conditional formatting'],1,'Power Query records transformation steps you can refresh.',4),
('excel-basics','Which counts cells meeting one condition?',ARRAY['SUMIF','COUNTIF','COUNTA','IFS'],1,'COUNTIF counts cells that satisfy a single criterion.',5),
('statistics-basics','The median is preferred over the mean when data is:',ARRAY['Normally distributed','Skewed or has outliers','Categorical','Very small'],1,'The median resists distortion from extreme values.',1),
('statistics-basics','A p-value of 0.03 at alpha 0.05 means:',ARRAY['The result is significant at that threshold','The hypothesis is proven','There is a 3% chance the effect is real','The sample is too small'],0,'It is below the threshold, so you reject the null at alpha 0.05.',2),
('statistics-basics','Standard deviation measures:',ARRAY['Central tendency','Spread around the mean','Correlation','Sample size'],1,'It quantifies dispersion around the mean.',3),
('statistics-basics','Correlation does not imply:',ARRAY['Association','Causation','Covariance','A linear trend'],1,'Correlated variables may share a confounder.',4),
('statistics-basics','A/B tests need a control group primarily to:',ARRAY['Increase sample size','Provide a baseline for comparison','Reduce cost','Speed up results'],1,'Without a baseline you cannot attribute change to the treatment.',5),
('power-bi-basics','A measure in Power BI is:',ARRAY['A stored column','A calculation evaluated at query time','A visual type','A data source'],1,'Measures are computed dynamically based on filter context.',1),
('power-bi-basics','A star schema typically has:',ARRAY['Many-to-many links only','One fact table with dimension tables','No relationships','Only calculated columns'],1,'Fact tables hold events; dimensions describe them.',2),
('power-bi-basics','DAX CALCULATE is used to:',ARRAY['Rename columns','Modify filter context of an expression','Load data','Create visuals'],1,'CALCULATE evaluates an expression under modified filters.',3),
('power-bi-basics','Which is best for showing part-to-whole across few categories?',ARRAY['Scatter plot','Donut or stacked bar','Line chart','Gauge'],1,'Part-to-whole comparisons suit donut or stacked bar charts.',4),
('power-bi-basics','Row-level security in Power BI controls:',ARRAY['Which rows a user can see','Report themes','Refresh frequency','Export formats'],0,'RLS filters the model per user role.',5)
) AS v(assessment_slug, prompt, opts, correct, expl, ord)
JOIN public.assessments a ON a.slug = v.assessment_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.assessment_questions existing
  WHERE existing.assessment_id = a.id AND existing.sort_order = v.ord
);
