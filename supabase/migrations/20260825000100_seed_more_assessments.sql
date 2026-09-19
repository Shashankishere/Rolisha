-- Extends the assessment catalog beyond the four Data Analyst quizzes seeded
-- in 20260824000000_seed_assessments.sql. Without this, every career other
-- than Data Analyst saw the same four SQL/Excel/Statistics/Power BI quizzes
-- regardless of their target role — assessments must be scoped to the
-- skills the user's selected career actually requires (see
-- career_skills). These four cover skills shared by Frontend Developer,
-- Backend Developer and Software Engineer.

INSERT INTO public.assessments (slug, title, skill_id, difficulty, description)
SELECT v.slug, v.title, s.id, v.diff::public.difficulty_level, v.descr
FROM (VALUES
  ('javascript-basics','JavaScript Fundamentals','javascript','beginner','Five questions covering variables, functions, arrays and async basics.'),
  ('html-css-basics','HTML & CSS Essentials','html-css','beginner','Five questions on semantic markup, the box model, flexbox and specificity.'),
  ('api-design-basics','API Design Fundamentals','api-design','beginner','Five questions on REST conventions, status codes and request/response design.'),
  ('git-basics','Git & Version Control','git','beginner','Five questions on commits, branches, merges and resolving conflicts.')
) AS v(slug, title, skill_slug, diff, descr)
JOIN public.skills s ON s.slug = v.skill_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assessment_questions (assessment_id, prompt, options, correct_index, explanation, sort_order)
SELECT a.id, v.prompt, v.opts, v.correct, v.expl, v.ord
FROM (VALUES
  ('javascript-basics','Which keyword declares a block-scoped variable that can be reassigned?',ARRAY['var','let','const','function'],1,'let is block-scoped and reassignable; const is block-scoped but not reassignable.',1),
  ('javascript-basics','What does Array.prototype.map return?',ARRAY['The original array mutated in place','A new array of the same length','A single accumulated value','A boolean'],1,'map produces a new array by transforming each element; it does not mutate the original.',2),
  ('javascript-basics','What does the "this" keyword refer to inside a regular function called as obj.method()?',ARRAY['The global object always','obj','undefined always','The function itself'],1,'When called as a method, "this" binds to the object the method was called on.',3),
  ('javascript-basics','What does `await` do inside an async function?',ARRAY['Pauses execution until the Promise settles','Runs the code synchronously on a separate thread','Cancels the Promise','Converts a callback to a Promise automatically'],0,'await pauses the async function until the awaited Promise resolves or rejects.',4),
  ('javascript-basics','Which method safely checks if an array includes a value?',ARRAY['array.has(x)','array.includes(x)','array.contains(x)','array.exists(x)'],1,'Array.prototype.includes checks membership and returns a boolean.',5),
  ('html-css-basics','Which CSS property controls the space between an element''s border and its content?',ARRAY['margin','padding','gap','inset'],1,'Padding is the space inside the border, between border and content.',1),
  ('html-css-basics','In Flexbox, which property aligns items along the main axis?',ARRAY['align-items','justify-content','flex-wrap','align-self'],1,'justify-content controls alignment along the main axis; align-items controls the cross axis.',2),
  ('html-css-basics','Which HTML element is the correct semantic choice for primary page navigation?',ARRAY['<div class="nav">','<nav>','<section>','<header>'],1,'The <nav> element is the semantic landmark for navigation links.',3),
  ('html-css-basics','Between a class selector and an ID selector, which has higher specificity?',ARRAY['Class selector','ID selector','They are equal','Neither — order in the file decides'],1,'ID selectors have higher specificity than class selectors in CSS.',4),
  ('html-css-basics','Which attribute makes an <img> accessible to screen readers when it conveys information?',ARRAY['title','alt','longdesc','aria-hidden'],1,'The alt attribute provides the text alternative screen readers announce.',5),
  ('api-design-basics','Which HTTP status code indicates a resource was created successfully?',ARRAY['200','201','204','301'],1,'201 Created is the conventional response for a successful POST that creates a resource.',1),
  ('api-design-basics','In REST, which HTTP method is expected to be idempotent and safe (no side effects)?',ARRAY['POST','PATCH','GET','DELETE'],2,'GET is defined as safe and idempotent — it should not change server state.',2),
  ('api-design-basics','A 401 response means:',ARRAY['The resource does not exist','The request was malformed','The client is not authenticated','The server had an internal error'],2,'401 Unauthorized means the request lacks valid authentication credentials.',3),
  ('api-design-basics','What is the main benefit of versioning an API (e.g. /v1/)?',ARRAY['It makes requests faster','It lets you change the API without breaking existing clients','It is required by HTTP','It replaces the need for authentication'],1,'Versioning lets you evolve an API while existing integrations keep working against the old version.',4),
  ('api-design-basics','Which status code range generally indicates a client error?',ARRAY['2xx','3xx','4xx','5xx'],2,'4xx codes indicate the client made a request that could not be fulfilled as sent.',5),
  ('git-basics','Which command creates a new branch and switches to it in one step?',ARRAY['git branch new-branch','git checkout -b new-branch','git switch new-branch','git merge new-branch'],1,'git checkout -b (or git switch -c) creates and switches to a new branch.',1),
  ('git-basics','What does `git merge` do that `git rebase` does not?',ARRAY['Combines branches without rewriting commit history','Deletes the source branch','Squashes all commits into one','Requires a remote repository'],0,'Merge preserves history by adding a merge commit; rebase rewrites commit history onto a new base.',2),
  ('git-basics','What is a merge conflict?',ARRAY['A network error during push','Overlapping changes Git cannot automatically reconcile','A missing commit message','A branch with no commits'],1,'A conflict happens when the same lines were changed differently on both sides being merged.',3),
  ('git-basics','Which command stages changes for the next commit?',ARRAY['git commit','git add','git push','git fetch'],1,'git add stages changes into the index ahead of a commit.',4),
  ('git-basics','What does `git clone` do?',ARRAY['Creates a new branch','Copies a remote repository to your local machine','Deletes local changes','Merges two branches'],1,'Clone creates a full local copy of a remote repository, including its history.',5)
) AS v(assessment_slug, prompt, opts, correct, expl, ord)
JOIN public.assessments a ON a.slug = v.assessment_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.assessment_questions existing
  WHERE existing.assessment_id = a.id AND existing.sort_order = v.ord
);
