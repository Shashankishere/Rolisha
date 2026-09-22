-- CONTENT EXPANSION — Phase B (careers) + Phase C (skills)
--
-- Audited first (see chat): 8 careers / 50 skills / 77 career_skills existed
-- before this migration. GraphQL, GitHub Actions, Scrum, Unit Testing and
-- Security Monitoring are already covered as ALIASES of existing skills
-- (api-design, ci-cd, agile, testing, siem respectively — see the original
-- skills seed) so they are deliberately NOT re-added as separate rows here;
-- doing so would create a duplicate/meaningless relationship.
--
-- 29 new skills below fill the real gaps for the 19 new careers (cloud
-- providers beyond AWS, container/IaC tooling, the ML/GenAI stack, DBA,
-- QA automation, and BA/PM-specific skills). Every new career is wired to
-- a realistic, non-random set of existing + new skills — no career is left
-- without relevant skill_id relationships.

-- ============================================================
-- PHASE C — NEW SKILLS (29)
-- ============================================================
INSERT INTO public.skills (slug, name, category, aliases) VALUES
  ('authentication','Authentication & Authorization','Backend',ARRAY['auth','jwt','oauth','sso']),
  ('application-security','Application Security','Security',ARRAY['api security','appsec','owasp']),
  ('redis','Redis','Backend',ARRAY['caching','in-memory store']),
  ('database-design','Database Design','Backend',ARRAY['schema design','normalization','data modeling']),
  ('database-administration','Database Administration','Backend',ARRAY['dba','query optimization','indexing','backups']),
  ('cloud-azure','Cloud (Azure)','Engineering',ARRAY['azure','microsoft azure']),
  ('cloud-gcp','Cloud (GCP)','Engineering',ARRAY['gcp','google cloud','google cloud platform']),
  ('kubernetes','Kubernetes','Engineering',ARRAY['k8s','container orchestration']),
  ('terraform','Terraform','Engineering',ARRAY['hashicorp terraform','iac tooling']),
  ('monitoring-observability','Monitoring & Observability','Engineering',ARRAY['monitoring','logging','prometheus','grafana','datadog']),
  ('infrastructure-as-code','Infrastructure as Code','Engineering',ARRAY['iac','declarative infrastructure']),
  ('numpy','NumPy','Data',ARRAY['numerical python','array computing']),
  ('apache-spark','Apache Spark','Data',ARRAY['spark','pyspark','distributed data processing']),
  ('airflow','Apache Airflow','Data',ARRAY['airflow','data pipeline orchestration','dags']),
  ('nlp','Natural Language Processing','Data',ARRAY['nlp','text mining','language models']),
  ('computer-vision','Computer Vision','Data',ARRAY['cv','image recognition','object detection']),
  ('generative-ai','Generative AI','Data',ARRAY['genai','generative models']),
  ('llms','Large Language Models','Data',ARRAY['llm','gpt','foundation models']),
  ('rag','Retrieval-Augmented Generation','Data',ARRAY['rag','vector search','embeddings retrieval']),
  ('prompt-engineering','Prompt Engineering','Data',ARRAY['prompting','prompt design']),
  ('mlops','MLOps','Engineering',ARRAY['ml pipelines','model deployment','model monitoring']),
  ('cloud-security','Cloud Security','Security',ARRAY['cspm','cloud posture management']),
  ('identity-access-management','Identity & Access Management','Security',ARRAY['iam','least privilege','rbac']),
  ('test-automation','Test Automation','Engineering',ARRAY['playwright','cypress','e2e testing','selenium']),
  ('data-structures-algorithms','Data Structures & Algorithms','Programming',ARRAY['dsa','big-o','leetcode']),
  ('design-patterns','Design Patterns','Programming',ARRAY['gof patterns','software design patterns']),
  ('clean-code','Clean Code','Programming',ARRAY['code quality','refactoring','maintainability']),
  ('requirements-analysis','Requirements Analysis','Product',ARRAY['user stories','requirements gathering','specifications']),
  ('mobile-development','Mobile Development','Programming',ARRAY['ios','android','react native','cross-platform apps'])
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- PHASE B — NEW CAREERS (19)
-- ============================================================
INSERT INTO public.careers (slug, title, short_description, description, seo_title, seo_description, typical_salary_min, typical_salary_max) VALUES
  ('full-stack-developer','Full Stack Developer','Build both the interface and the service behind it.','Full Stack Developers work across the whole application: user interfaces, APIs, data models and deployment. The role blends frontend frameworks, backend services and enough infrastructure knowledge to ship a feature end to end.','Full Stack Developer Career Roadmap | RoleReady','See the skills full stack roles actually require and follow a 6-month roadmap from real job requirements.',65000,125000),
  ('mobile-app-developer','Mobile App Developer','Build native or cross-platform apps people carry in their pocket.','Mobile App Developers build and ship applications for iOS and Android, balancing UI polish, offline behaviour, performance and app-store constraints that don''t apply to the web.','Mobile App Developer Career Roadmap | RoleReady','Learn what mobile teams hire for and follow a 6-month roadmap to your first mobile developer role.',60000,120000),
  ('data-engineer','Data Engineer','Build the pipelines that make data usable.','Data Engineers design, build and operate the pipelines and warehouses that move raw data into a form analysts and models can use, with a focus on reliability, scale and data quality.','Data Engineer Career Roadmap | RoleReady','Understand exactly what data engineering roles require and get a personalised 6-month roadmap.',75000,135000),
  ('business-intelligence-analyst','Business Intelligence Analyst','Turn company data into dashboards leadership actually uses.','Business Intelligence Analysts build and maintain the reporting layer of a company — dashboards, data models and recurring analysis that inform decisions across teams.','Business Intelligence Analyst Career Roadmap | RoleReady','See the real skills BI teams hire for and follow a structured 6-month roadmap.',58000,105000),
  ('machine-learning-engineer','Machine Learning Engineer','Take models from notebook to production.','Machine Learning Engineers build, evaluate and deploy machine learning models as reliable production systems, sitting between data science and software engineering.','Machine Learning Engineer Career Roadmap | RoleReady','Build an ML engineering roadmap grounded in real job requirements, not generic advice.',90000,160000),
  ('ai-engineer','AI Engineer','Build applications powered by large language models.','AI Engineers build products on top of foundation models: RAG systems, agents and LLM-powered features, focusing on prompt design, retrieval and evaluation rather than training models from scratch.','AI Engineer Career Roadmap | RoleReady','See what AI engineering roles actually require and follow a practical 6-month roadmap.',85000,155000),
  ('devops-engineer','DevOps Engineer','Make shipping software fast, repeatable and safe.','DevOps Engineers build the CI/CD pipelines, infrastructure automation and deployment practices that let engineering teams ship reliably and often.','DevOps Engineer Career Roadmap | RoleReady','Understand what DevOps teams hire for and follow a structured 6-month roadmap.',75000,135000),
  ('cloud-engineer','Cloud Engineer','Design and operate infrastructure in the cloud.','Cloud Engineers design, provision and secure cloud infrastructure, working across compute, networking and storage services on one or more major cloud providers.','Cloud Engineer Career Roadmap | RoleReady','See the real cloud engineering skill requirements and follow a 6-month roadmap.',75000,140000),
  ('site-reliability-engineer','Site Reliability Engineer','Keep production systems fast, available and observable.','Site Reliability Engineers apply software engineering practices to operations: reliability targets, incident response, monitoring and automation that keeps systems up.','Site Reliability Engineer Career Roadmap | RoleReady','Understand what SRE teams require and follow a 6-month roadmap to job readiness.',85000,150000),
  ('solutions-architect','Solutions Architect','Design systems that meet both technical and business constraints.','Solutions Architects design end-to-end technical solutions, balancing scalability, cost, security and stakeholder requirements across teams.','Solutions Architect Career Roadmap | RoleReady','See what solutions architecture roles require and follow a 6-month roadmap.',95000,165000),
  ('cybersecurity-engineer','Cybersecurity Engineer','Design and build the defences, not just monitor them.','Cybersecurity Engineers design, implement and harden security controls across networks, applications and identity systems, going beyond the monitoring focus of an analyst role.','Cybersecurity Engineer Career Roadmap | RoleReady','See what security engineering teams hire for and follow a 6-month roadmap.',80000,145000),
  ('cloud-security-engineer','Cloud Security Engineer','Secure infrastructure that lives in the cloud.','Cloud Security Engineers secure cloud environments specifically: identity and access, network boundaries, posture management and compliance across cloud-native infrastructure.','Cloud Security Engineer Career Roadmap | RoleReady','Understand cloud security hiring requirements and follow a 6-month roadmap.',85000,150000),
  ('qa-engineer','QA Engineer','Make sure the product actually works before customers find out it doesn''t.','QA Engineers design test plans, execute manual and exploratory testing, and work with engineering to catch defects before release.','QA Engineer Career Roadmap | RoleReady','See what QA teams look for and follow a 6-month roadmap to your first QA role.',50000,90000),
  ('qa-automation-engineer','QA Automation Engineer','Write the tests that catch regressions automatically.','QA Automation Engineers build and maintain automated test suites — unit, integration and end-to-end — so teams can ship confidently without manually re-testing everything.','QA Automation Engineer Career Roadmap | RoleReady','Understand QA automation hiring requirements and follow a structured 6-month roadmap.',60000,110000),
  ('database-administrator','Database Administrator','Keep the data layer fast, available and safe.','Database Administrators design, tune, secure and back up production databases, focusing on performance, availability and data integrity.','Database Administrator Career Roadmap | RoleReady','See what DBA roles actually require and follow a 6-month roadmap.',65000,120000),
  ('technical-product-manager','Technical Product Manager','Own product decisions that require real technical depth.','Technical Product Managers combine product management with enough engineering fluency to work directly with technical teams on architecture-adjacent decisions.','Technical Product Manager Career Roadmap | RoleReady','Understand technical PM hiring requirements and follow a practical 6-month roadmap.',95000,160000),
  ('product-analyst','Product Analyst','Turn product usage data into decisions.','Product Analysts analyse how users interact with a product — funnels, retention, experiments — to inform what the product team builds next.','Product Analyst Career Roadmap | RoleReady','See what product analytics roles require and follow a 6-month roadmap.',65000,115000),
  ('business-analyst','Business Analyst','Turn business problems into clear requirements.','Business Analysts gather and document requirements, model processes and bridge the gap between business stakeholders and delivery teams.','Business Analyst Career Roadmap | RoleReady','Understand business analyst hiring requirements and follow a 6-month roadmap.',60000,105000),
  ('project-manager','Project Manager','Keep delivery on track across people, time and scope.','Project Managers plan, coordinate and track delivery across teams, managing scope, timelines, risk and stakeholder communication.','Project Manager Career Roadmap | RoleReady','See what project management roles require and follow a practical 6-month roadmap.',65000,115000)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- PHASE B — CAREER_SKILLS relationships for the 19 new careers
-- ============================================================
INSERT INTO public.career_skills (career_id, skill_id, importance, required_level, demand_percentage, sort_order)
SELECT c.id, s.id, v.importance::public.skill_importance, v.req::public.proficiency_level, v.demand, v.ord
FROM (VALUES
  -- Full Stack Developer
  ('full-stack-developer','javascript','critical','advanced',82,1),
  ('full-stack-developer','react','high','advanced',68,2),
  ('full-stack-developer','nodejs','high','advanced',64,3),
  ('full-stack-developer','typescript','high','intermediate',58,4),
  ('full-stack-developer','api-design','high','advanced',60,5),
  ('full-stack-developer','postgresql','high','intermediate',52,6),
  ('full-stack-developer','html-css','high','advanced',55,7),
  ('full-stack-developer','system-design','medium','intermediate',45,8),
  ('full-stack-developer','git','critical','advanced',75,9),
  ('full-stack-developer','docker','medium','intermediate',40,10),
  ('full-stack-developer','testing','medium','intermediate',38,11),

  -- Mobile App Developer
  ('mobile-app-developer','mobile-development','critical','advanced',78,1),
  ('mobile-app-developer','javascript','high','advanced',60,2),
  ('mobile-app-developer','react','high','intermediate',55,3),
  ('mobile-app-developer','typescript','medium','intermediate',48,4),
  ('mobile-app-developer','api-design','high','intermediate',50,5),
  ('mobile-app-developer','git','high','advanced',62,6),
  ('mobile-app-developer','testing','medium','intermediate',35,7),
  ('mobile-app-developer','ci-cd','medium','beginner',30,8),
  ('mobile-app-developer','system-design','medium','intermediate',32,9),

  -- Data Engineer
  ('data-engineer','python','critical','advanced',74,1),
  ('data-engineer','sql','critical','advanced',80,2),
  ('data-engineer','apache-spark','high','intermediate',55,3),
  ('data-engineer','airflow','high','intermediate',50,4),
  ('data-engineer','postgresql','high','advanced',58,5),
  ('data-engineer','cloud-aws','high','intermediate',52,6),
  ('data-engineer','system-design','medium','intermediate',42,7),
  ('data-engineer','docker','medium','intermediate',38,8),
  ('data-engineer','data-structures-algorithms','medium','intermediate',34,9),
  ('data-engineer','mongodb','nice_to_have','beginner',22,10),

  -- Business Intelligence Analyst
  ('business-intelligence-analyst','power-bi','critical','advanced',76,1),
  ('business-intelligence-analyst','sql','critical','advanced',74,2),
  ('business-intelligence-analyst','tableau','high','advanced',60,3),
  ('business-intelligence-analyst','data-visualization','high','advanced',58,4),
  ('business-intelligence-analyst','business-analytics','high','advanced',55,5),
  ('business-intelligence-analyst','excel','high','intermediate',50,6),
  ('business-intelligence-analyst','statistics','medium','intermediate',40,7),
  ('business-intelligence-analyst','communication','high','advanced',42,8),
  ('business-intelligence-analyst','stakeholder-management','medium','intermediate',30,9),

  -- Machine Learning Engineer
  ('machine-learning-engineer','python','critical','advanced',80,1),
  ('machine-learning-engineer','machine-learning','critical','advanced',78,2),
  ('machine-learning-engineer','deep-learning','high','advanced',62,3),
  ('machine-learning-engineer','mlops','high','intermediate',55,4),
  ('machine-learning-engineer','numpy','high','advanced',50,5),
  ('machine-learning-engineer','pandas','high','advanced',48,6),
  ('machine-learning-engineer','statistics','high','advanced',45,7),
  ('machine-learning-engineer','system-design','medium','intermediate',40,8),
  ('machine-learning-engineer','docker','medium','intermediate',38,9),
  ('machine-learning-engineer','cloud-aws','medium','intermediate',42,10),

  -- AI Engineer
  ('ai-engineer','python','critical','advanced',78,1),
  ('ai-engineer','llms','critical','advanced',65,2),
  ('ai-engineer','generative-ai','high','advanced',60,3),
  ('ai-engineer','rag','high','intermediate',52,4),
  ('ai-engineer','prompt-engineering','high','intermediate',48,5),
  ('ai-engineer','machine-learning','high','advanced',55,6),
  ('ai-engineer','nlp','medium','intermediate',40,7),
  ('ai-engineer','api-design','medium','intermediate',42,8),
  ('ai-engineer','mlops','medium','intermediate',38,9),
  ('ai-engineer','cloud-aws','medium','beginner',34,10),

  -- DevOps Engineer
  ('devops-engineer','linux','critical','advanced',70,1),
  ('devops-engineer','docker','critical','advanced',72,2),
  ('devops-engineer','ci-cd','critical','advanced',68,3),
  ('devops-engineer','kubernetes','high','advanced',60,4),
  ('devops-engineer','terraform','high','intermediate',55,5),
  ('devops-engineer','cloud-aws','high','advanced',58,6),
  ('devops-engineer','infrastructure-as-code','high','intermediate',50,7),
  ('devops-engineer','monitoring-observability','high','intermediate',46,8),
  ('devops-engineer','networking','medium','intermediate',38,9),
  ('devops-engineer','git','high','advanced',55,10),

  -- Cloud Engineer
  ('cloud-engineer','cloud-aws','critical','advanced',72,1),
  ('cloud-engineer','terraform','high','advanced',58,2),
  ('cloud-engineer','kubernetes','high','intermediate',50,3),
  ('cloud-engineer','docker','high','intermediate',52,4),
  ('cloud-engineer','infrastructure-as-code','high','intermediate',48,5),
  ('cloud-engineer','cloud-azure','medium','intermediate',45,6),
  ('cloud-engineer','cloud-gcp','medium','intermediate',35,7),
  ('cloud-engineer','networking','medium','intermediate',40,8),
  ('cloud-engineer','linux','medium','advanced',44,9),

  -- Site Reliability Engineer
  ('site-reliability-engineer','linux','critical','advanced',68,1),
  ('site-reliability-engineer','monitoring-observability','critical','advanced',62,2),
  ('site-reliability-engineer','kubernetes','high','advanced',60,3),
  ('site-reliability-engineer','incident-response','high','advanced',55,4),
  ('site-reliability-engineer','system-design','high','advanced',48,5),
  ('site-reliability-engineer','cloud-aws','high','intermediate',50,6),
  ('site-reliability-engineer','ci-cd','high','intermediate',46,7),
  ('site-reliability-engineer','terraform','medium','intermediate',40,8),
  ('site-reliability-engineer','networking','medium','intermediate',38,9),

  -- Solutions Architect
  ('solutions-architect','system-design','critical','advanced',75,1),
  ('solutions-architect','cloud-aws','high','advanced',60,2),
  ('solutions-architect','api-design','high','advanced',52,3),
  ('solutions-architect','stakeholder-management','high','advanced',45,4),
  ('solutions-architect','communication','high','advanced',44,5),
  ('solutions-architect','infrastructure-as-code','medium','intermediate',40,6),
  ('solutions-architect','cloud-azure','medium','intermediate',35,7),
  ('solutions-architect','security-frameworks','medium','intermediate',38,8),
  ('solutions-architect','docker','medium','intermediate',36,9),

  -- Cybersecurity Engineer
  ('cybersecurity-engineer','network-security','critical','advanced',70,1),
  ('cybersecurity-engineer','security-frameworks','high','advanced',58,2),
  ('cybersecurity-engineer','cloud-security','high','intermediate',52,3),
  ('cybersecurity-engineer','identity-access-management','high','intermediate',48,4),
  ('cybersecurity-engineer','networking','high','advanced',50,5),
  ('cybersecurity-engineer','ethical-hacking','medium','intermediate',42,6),
  ('cybersecurity-engineer','siem','medium','intermediate',40,7),
  ('cybersecurity-engineer','incident-response','medium','intermediate',38,8),
  ('cybersecurity-engineer','linux','medium','intermediate',35,9),

  -- Cloud Security Engineer
  ('cloud-security-engineer','cloud-security','critical','advanced',68,1),
  ('cloud-security-engineer','cloud-aws','high','advanced',58,2),
  ('cloud-security-engineer','identity-access-management','high','advanced',55,3),
  ('cloud-security-engineer','network-security','high','intermediate',48,4),
  ('cloud-security-engineer','security-frameworks','high','intermediate',46,5),
  ('cloud-security-engineer','terraform','medium','intermediate',38,6),
  ('cloud-security-engineer','kubernetes','medium','intermediate',35,7),
  ('cloud-security-engineer','incident-response','medium','intermediate',34,8),

  -- QA Engineer
  ('qa-engineer','testing','critical','advanced',70,1),
  ('qa-engineer','test-automation','high','advanced',58,2),
  ('qa-engineer','problem-solving','high','advanced',42,3),
  ('qa-engineer','git','high','intermediate',45,4),
  ('qa-engineer','sql','medium','intermediate',40,5),
  ('qa-engineer','api-design','medium','intermediate',38,6),
  ('qa-engineer','communication','medium','intermediate',32,7),

  -- QA Automation Engineer
  ('qa-automation-engineer','test-automation','critical','advanced',72,1),
  ('qa-automation-engineer','testing','high','advanced',52,2),
  ('qa-automation-engineer','javascript','high','advanced',55,3),
  ('qa-automation-engineer','python','high','intermediate',50,4),
  ('qa-automation-engineer','ci-cd','high','intermediate',48,5),
  ('qa-automation-engineer','api-design','high','intermediate',46,6),
  ('qa-automation-engineer','git','high','advanced',50,7),
  ('qa-automation-engineer','docker','medium','intermediate',35,8),

  -- Database Administrator
  ('database-administrator','database-administration','critical','advanced',68,1),
  ('database-administrator','postgresql','critical','advanced',72,2),
  ('database-administrator','sql','critical','advanced',74,3),
  ('database-administrator','database-design','high','advanced',55,4),
  ('database-administrator','linux','high','intermediate',48,5),
  ('database-administrator','cloud-aws','medium','intermediate',38,6),
  ('database-administrator','system-design','medium','intermediate',36,7),
  ('database-administrator','redis','nice_to_have','beginner',24,8),

  -- Technical Product Manager
  ('technical-product-manager','product-strategy','critical','advanced',65,1),
  ('technical-product-manager','roadmapping','high','advanced',55,2),
  ('technical-product-manager','stakeholder-management','high','advanced',52,3),
  ('technical-product-manager','agile','high','advanced',50,4),
  ('technical-product-manager','communication','high','advanced',48,5),
  ('technical-product-manager','product-analytics','high','intermediate',46,6),
  ('technical-product-manager','system-design','medium','intermediate',45,7),
  ('technical-product-manager','api-design','medium','intermediate',38,8),

  -- Product Analyst
  ('product-analyst','product-analytics','critical','advanced',68,1),
  ('product-analyst','sql','high','advanced',60,2),
  ('product-analyst','data-visualization','high','intermediate',50,3),
  ('product-analyst','statistics','medium','intermediate',42,4),
  ('product-analyst','communication','high','advanced',44,5),
  ('product-analyst','business-analytics','medium','intermediate',40,6),
  ('product-analyst','product-strategy','medium','intermediate',34,7),

  -- Business Analyst
  ('business-analyst','requirements-analysis','critical','advanced',68,1),
  ('business-analyst','business-analytics','high','advanced',58,2),
  ('business-analyst','stakeholder-management','high','advanced',55,3),
  ('business-analyst','communication','high','advanced',50,4),
  ('business-analyst','sql','high','intermediate',48,5),
  ('business-analyst','agile','medium','intermediate',40,6),
  ('business-analyst','data-visualization','medium','intermediate',36,7),

  -- Project Manager
  ('project-manager','agile','critical','advanced',68,1),
  ('project-manager','stakeholder-management','critical','advanced',65,2),
  ('project-manager','communication','critical','advanced',62,3),
  ('project-manager','roadmapping','high','advanced',52,4),
  ('project-manager','problem-solving','high','advanced',46,5),
  ('project-manager','requirements-analysis','medium','intermediate',42,6),
  ('project-manager','product-strategy','nice_to_have','beginner',28,7)
) AS v(career_slug, skill_slug, importance, req, demand, ord)
JOIN public.careers c ON c.slug = v.career_slug
JOIN public.skills s ON s.slug = v.skill_slug
ON CONFLICT (career_id, skill_id) DO NOTHING;
