-- CONTENT EXPANSION — Phase J/K (resources), final batch
--
-- Audited: 16 of the 29 new skills got resources in 20260906040000. This
-- batch covers the remaining 13: Authentication, Database Design, Database
-- Administration, Infrastructure as Code, Computer Vision, Generative AI,
-- LLMs, RAG, Prompt Engineering, Cloud Security, Identity & Access
-- Management, Clean Code, and Requirements Analysis. After this migration
-- every one of the 29 new skills has at least one real, individually
-- checked resource.
--
-- Every URL was checked via web search before being added:
-- - The Andrej Karpathy "Intro to Large Language Models" YouTube link was
--   confirmed via its video ID appearing in a real YouTube thumbnail path
--   (i.ytimg.com/vi/<id>/...) on a channel-archive page, not guessed.
-- - The OWASP Cheat Sheet Series pages (Authentication, Database Security,
--   Infrastructure as Code Security, Access Control) were confirmed to
--   exist as real, named entries on the project's own index page; the
--   Authentication one was additionally confirmed at its exact URL.
-- - LangChain's RAG tutorial, PyTorch's transfer-learning-for-vision
--   tutorial, Google Cloud Skills Boost's Generative AI course, AWS's
--   Well-Architected Security Pillar, promptingguide.ai, and
--   refactoring.guru were each confirmed live via search results
--   referencing the exact path used here.

INSERT INTO public.resources (title, provider, url, type, skill_id, is_free, description)
SELECT v.title, v.provider, v.url, v.rtype::public.resource_type, s.id, v.free, v.descr
FROM (VALUES
  ('OWASP Authentication Cheat Sheet','OWASP','https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html','documentation','authentication',true,'Practical, vendor-neutral guidance on implementing authentication securely: password storage, session management, and common pitfalls.'),
  ('OWASP Database Security Cheat Sheet','OWASP','https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html','documentation','database-design',true,'Guidance on securely configuring and using SQL and NoSQL databases, relevant to both schema design and administration.'),
  ('PostgreSQL: Backup and Restore','PostgreSQL','https://www.postgresql.org/docs/current/backup.html','documentation','database-administration',true,'Official PostgreSQL documentation on backup strategies, including SQL dump, file system level backup, and continuous archiving.'),
  ('OWASP Infrastructure as Code Security Cheat Sheet','OWASP','https://cheatsheetseries.owasp.org/cheatsheets/Infrastructure_as_Code_Security_Cheat_Sheet.html','documentation','infrastructure-as-code',true,'Security-focused guidance for writing and reviewing infrastructure-as-code configurations.'),
  ('Transfer Learning for Computer Vision Tutorial','PyTorch','https://docs.pytorch.org/tutorials/beginner/transfer_learning_tutorial.html','course','computer-vision',true,'Official PyTorch tutorial fine-tuning a pretrained CNN for a new image classification task.'),
  ('Introduction to Generative AI','Google Cloud','https://www.cloudskillsboost.google/course_templates/536','course','generative-ai',true,'Free 45-minute Google Cloud Skills Boost course explaining what generative AI is, how it works, and common model types.'),
  ('[1hr Talk] Intro to Large Language Models','Andrej Karpathy','https://www.youtube.com/watch?v=zjkBMFhNj_g','video','llms',true,'A widely-cited, general-audience introduction to how LLMs work, from a former OpenAI founding member and Tesla AI director.'),
  ('Build a Retrieval Augmented Generation (RAG) App','LangChain','https://python.langchain.com/docs/tutorials/rag/','documentation','rag',true,'Official LangChain tutorial building a RAG application end to end: loading, splitting, embedding, retrieving and generating.'),
  ('Prompt Engineering Guide','DAIR.AI','https://www.promptingguide.ai/','course','prompt-engineering',true,'A widely-used, comprehensive guide to prompt engineering techniques from basics through advanced methods.'),
  ('AWS Well-Architected Framework: Security Pillar','AWS','https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html','documentation','cloud-security',true,'Official AWS guidance on designing, delivering and maintaining secure cloud workloads.'),
  ('OWASP Access Control Cheat Sheet','OWASP','https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html','documentation','identity-access-management',true,'Guidance on designing and implementing authorization and access control correctly.'),
  ('Refactoring.Guru: Refactoring','Refactoring.Guru','https://refactoring.guru/refactoring','documentation','clean-code',true,'A catalog of code smells and the specific refactoring techniques used to fix them, illustrated with before/after code.'),
  ('IIBA: A Guide to the Business Analysis Body of Knowledge','IIBA','https://www.iiba.org/career-resources/a-business-analysis-professionals-foundation-for-success/babok/','documentation','requirements-analysis',true,'Overview from the International Institute of Business Analysis of the BABOK Guide, the industry-standard reference for business analysis practice.')
) AS v(title, provider, url, rtype, skill_slug, free, descr)
JOIN public.skills s ON s.slug = v.skill_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources existing
  WHERE existing.skill_id = s.id AND existing.url = v.url
);
