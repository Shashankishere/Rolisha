-- Seeds real, non-placeholder learning content for five skills that already
-- have both a career mapping (career_skills) and a quiz (assessments, from
-- 20260824000000_seed_assessments.sql and 20260825000100_seed_more_assessments.sql).
-- Each topic reuses its skill's existing assessment as the "quick quiz" step
-- rather than duplicating quiz infrastructure.

INSERT INTO public.learning_topics
  (slug, skill_id, title, why_it_matters, difficulty, estimated_hours, objectives, common_mistakes, target_level, assessment_id)
SELECT v.slug, s.id, v.title, v.why, v.diff::public.difficulty_level, v.hours,
       v.objectives, v.mistakes, v.target::public.proficiency_level, a.id
FROM (VALUES
  (
    'api-design',
    'api-design',
    'API Design',
    'Backend Developer, Software Engineer and most full-stack roles all require designing or consuming APIs. A well-designed API is predictable, easy to integrate with, and easy to change without breaking clients — badly designed ones cause the majority of real-world integration bugs.',
    'beginner',
    5,
    ARRAY[
      'Explain what an API is and why REST became the dominant style',
      'Choose the correct HTTP method and status code for a given operation',
      'Design a resource-oriented URL structure',
      'Design request/response payloads that are consistent and easy to consume',
      'Explain common authentication approaches for APIs',
      'Add pagination, filtering and versioning to an API design',
      'Design error responses that actually help the caller fix the problem'
    ],
    ARRAY[
      'Using verbs in URLs instead of nouns (e.g. /getUser instead of GET /users/:id)',
      'Returning 200 OK for every response, including errors',
      'Putting authentication tokens in the URL instead of headers',
      'Breaking existing clients by changing a field''s meaning without versioning',
      'Returning inconsistent field naming (camelCase in one endpoint, snake_case in another)'
    ],
    'intermediate',
    'api-design-basics'
  ),
  (
    'sql-fundamentals',
    'sql',
    'SQL Fundamentals',
    'SQL is the primary way analysts and backend engineers read and shape data stored in relational databases. Nearly every Data Analyst and Backend Developer role lists SQL as a required, not optional, skill.',
    'beginner',
    6,
    ARRAY[
      'Write SELECT queries with filtering, sorting and limiting',
      'Join multiple tables correctly (INNER vs LEFT JOIN)',
      'Aggregate data with GROUP BY and HAVING',
      'Use subqueries and common table expressions (CTEs)',
      'Recognize when a query will be slow and how indexes help'
    ],
    ARRAY[
      'Confusing WHERE (filters rows before grouping) with HAVING (filters after grouping)',
      'Using INNER JOIN when rows without a match should still appear (should be LEFT JOIN)',
      'Forgetting GROUP BY columns that aren''t aggregated, causing ambiguous results',
      'SELECT * in production queries instead of naming needed columns'
    ],
    'intermediate',
    'sql-basics'
  ),
  (
    'git-version-control',
    'git',
    'Git & Version Control',
    'Every engineering role — Frontend, Backend, Software Engineer — assumes daily fluency with Git. Struggling with branches or merge conflicts slows down every single task on the job.',
    'beginner',
    3,
    ARRAY[
      'Explain the difference between the working directory, staging area and commits',
      'Create and switch branches for isolated work',
      'Resolve a merge conflict confidently',
      'Understand the difference between merge and rebase',
      'Write commit messages that are useful to future readers'
    ],
    ARRAY[
      'Committing directly to main/master instead of a feature branch',
      'Panicking and deleting a branch instead of resolving a conflict',
      'Writing commit messages like "fix" or "update" with no context',
      'Force-pushing to a shared branch without warning collaborators'
    ],
    'intermediate',
    'git-basics'
  ),
  (
    'javascript-fundamentals',
    'javascript',
    'JavaScript Fundamentals',
    'JavaScript is the language of the web front end and (via Node.js) a common backend choice too — it underpins nearly every Frontend Developer and Software Engineer role in the catalog.',
    'beginner',
    6,
    ARRAY[
      'Understand variable scoping with let, const and var',
      'Work confidently with arrays and objects, including common array methods',
      'Understand how "this" behaves in different call contexts',
      'Write and reason about asynchronous code with Promises and async/await',
      'Avoid the most common bugs new JavaScript developers hit'
    ],
    ARRAY[
      'Using var out of habit, leading to confusing function-scoped bugs',
      'Mutating arrays/objects that other code still holds a reference to',
      'Forgetting that array methods like map/filter return new arrays rather than mutating',
      'Mixing .then() chains with await in a way that swallows errors'
    ],
    'intermediate',
    'javascript-basics'
  ),
  (
    'html-css-essentials',
    'html-css',
    'HTML & CSS Essentials',
    'Semantic HTML and solid CSS layout skills (especially Flexbox) are the foundation every Frontend Developer builds on — they also directly affect accessibility and SEO, not just appearance.',
    'beginner',
    4,
    ARRAY[
      'Use semantic HTML elements instead of generic divs where appropriate',
      'Understand the CSS box model (content, padding, border, margin)',
      'Lay out interfaces confidently with Flexbox',
      'Understand CSS specificity and the cascade',
      'Write accessible markup (alt text, labels, landmarks)'
    ],
    ARRAY[
      'Using <div> for everything instead of <nav>, <header>, <main>, <button>',
      'Fighting CSS specificity with !important instead of restructuring selectors',
      'Forgetting box-sizing: border-box, causing unexpected element widths',
      'Missing alt text or form labels, breaking screen-reader accessibility'
    ],
    'intermediate',
    'html-css-basics'
  )
) AS v(slug, skill_slug, title, why, diff, hours, objectives, mistakes, target, assessment_slug)
JOIN public.skills s ON s.slug = v.skill_slug
LEFT JOIN public.assessments a ON a.slug = v.assessment_slug
ON CONFLICT (slug) DO NOTHING;

-- API Design: the full 10-lesson curriculum.
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'What is an API?',
   'An API (Application Programming Interface) is a contract that lets one piece of software ask another piece of software to do something, without needing to know how it works internally. A web API typically means: a client sends an HTTP request to a server, and the server sends back a response — usually as JSON. Think of a restaurant menu: you don''t need to know how the kitchen works, you just need to know what you can order (the API) and what you''ll get back.',
   'A weather app calling GET https://api.example.com/weather?city=Delhi and getting back { "tempC": 34, "condition": "sunny" } — the app never needs to know how the weather service actually gathers that data.',
   'Find any public API you use indirectly (e.g. a weather widget, a map embed). Open your browser''s network tab and see if you can spot the actual API request being made.'),
  (2, 'REST fundamentals',
   'REST (Representational State Transfer) is a style for designing APIs around "resources" — nouns like users, orders, or products — rather than actions. Each resource has a URL, and you use standard HTTP methods to act on it. REST APIs are stateless: each request contains everything the server needs to process it; the server doesn''t remember previous requests from that client.',
   'Resource-oriented: GET /orders/42 (get order 42). Not resource-oriented: GET /getOrderById?id=42 — this works, but it puts the action in the URL instead of using HTTP methods, which is the anti-pattern REST avoids.',
   'Take an app you use often (to-do list, shopping cart) and sketch what its core "resources" would be if it had a REST API — e.g. /tasks, /tasks/:id.'),
  (3, 'HTTP methods',
   'REST APIs use HTTP methods to express intent on a resource: GET reads data and should never change anything (safe). POST creates a new resource. PUT replaces a resource entirely. PATCH partially updates a resource. DELETE removes a resource. GET, PUT and DELETE are expected to be idempotent — calling them multiple times has the same effect as calling them once — while POST typically is not.',
   'POST /orders creates a new order and returns its ID. PUT /orders/42 replaces order 42''s full data. PATCH /orders/42 might just update its status field. DELETE /orders/42 removes it.',
   'For a "task manager" API, write out which HTTP method + URL you''d use for: listing tasks, creating a task, marking one task complete, and deleting a task.'),
  (4, 'Status codes',
   'HTTP status codes tell the caller what happened, without them needing to parse the response body. 2xx means success (200 OK, 201 Created, 204 No Content). 4xx means the client made a mistake (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict). 5xx means the server failed (500 Internal Server Error). Choosing the right code lets clients handle errors programmatically instead of parsing error text.',
   'A POST that successfully creates a resource should return 201 Created (with the new resource in the body), not 200 OK. A request for a resource that doesn''t exist should return 404, not 200 with an empty body.',
   'List the status code you''d return for: successful login, wrong password, resource created, resource not found, and a validation error on submitted data.'),
  (5, 'Request/response structure',
   'Consistency matters more than any single "correct" format. Pick a convention for field naming (commonly camelCase in JSON APIs) and stick to it everywhere. Wrap collections with metadata when useful (e.g. { "data": [...], "total": 42 }) rather than returning a bare array, so you can add pagination info later without breaking clients.',
   '{ "data": [ { "id": "1", "title": "Buy milk" } ], "total": 1, "page": 1 } is easier to extend later than a bare [ { "id": "1", "title": "Buy milk" } ].',
   'Design the JSON response shape for a GET /products endpoint that needs to support pagination later.'),
  (6, 'Authentication',
   'Most real APIs need to know who is calling them. Common approaches: API keys (a static secret sent in a header, simple but less secure), Bearer tokens / JWTs (a signed token sent as Authorization: Bearer <token>, common for user-facing apps), and OAuth 2.0 (a full delegated-authorization flow, used when a third party needs limited access to a user''s data, e.g. "Sign in with Google"). Credentials should always be sent in headers, never in the URL, since URLs get logged.',
   'Authorization: Bearer eyJhbGciOi... is the standard way an API client proves who it is on every request after logging in.',
   'Look at a request your own app or a tool you use makes (via browser dev tools) and identify which authentication approach it uses.'),
  (7, 'Pagination and filtering',
   'APIs that return large collections should never return everything at once. Offset-based pagination (?page=2&pageSize=20) is simple and common. Cursor-based pagination (?after=<id>) scales better for huge, frequently-changing datasets. Filtering (?status=active) and sorting (?sort=-createdAt) let clients ask for exactly the slice of data they need instead of filtering client-side.',
   'GET /orders?status=shipped&page=2&pageSize=20&sort=-createdAt asks for page 2 of shipped orders, newest first.',
   'Design the query parameters for an endpoint that lists blog posts and needs to support filtering by author and sorting by publish date.'),
  (8, 'API error handling',
   'A good error response tells the caller exactly what went wrong and, ideally, how to fix it — not just "Error". Include a machine-readable error code (for programmatic handling) alongside a human-readable message. Validation errors should list every field that failed, not just the first one, so the client isn''t stuck fixing one field at a time.',
   '{ "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid", "fields": { "email": "must be a valid email address" } } } is far more useful than { "error": "Bad request" }.',
   'Design the error response body for a signup endpoint where both the email and password fields fail validation at once.'),
  (9, 'API versioning',
   'APIs change over time, but existing clients (mobile apps that can''t be force-updated, third-party integrations) may depend on the old behavior. Versioning lets you evolve safely. Common approaches: URL versioning (/v1/orders, /v2/orders), header versioning (Accept: application/vnd.myapi.v2+json), and additive-only changes (only ever add optional fields, never remove or repurpose existing ones).',
   'Adding a new optional field to a response is usually safe without a new version. Removing a field, or changing what an existing field means, is a breaking change and needs /v2 or equivalent.',
   'You need to rename a field from "name" to "fullName" in an API real clients depend on. Describe two different ways to do this without breaking existing clients immediately.'),
  (10, 'Designing a production-quality API',
   'Bringing it together: a production API is resource-oriented, uses HTTP methods and status codes correctly, has consistent naming, supports pagination/filtering on collections, authenticates every request appropriately, returns actionable errors, and is versioned so it can evolve. It''s also documented — even a short README with example requests saves every future integrator hours.',
   'A well-designed GET /v1/orders?status=shipped&page=1&pageSize=20 with Authorization: Bearer <token>, returning { "data": [...], "total": 134, "page": 1 } and consistent camelCase fields, demonstrates most of the principles from this topic at once.',
   'Pick a small app idea (e.g. a bookmarking tool) and design its full first-version API: list every endpoint, method, and response shape for its 2-3 core resources.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'api-design'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- SQL Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'SELECT, WHERE and ORDER BY',
   'Every SQL query starts with SELECT (which columns you want) and FROM (which table). WHERE filters rows before any grouping happens. ORDER BY sorts the final result, and LIMIT caps how many rows come back.',
   'SELECT name, salary FROM employees WHERE department = ''Sales'' ORDER BY salary DESC LIMIT 10',
   'Write a query that returns the 5 most recent orders from an "orders" table, newest first.'),
  (2, 'Joining tables',
   'INNER JOIN returns only rows that match in both tables. LEFT JOIN returns every row from the left table, with NULLs for unmatched right-table columns. Choosing the wrong one silently drops rows you actually wanted.',
   'SELECT c.name, o.total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id; keeps customers even if they have no orders yet.',
   'Given a "students" and "enrollments" table, write a query that lists every student, including those enrolled in zero courses.'),
  (3, 'Aggregation with GROUP BY',
   'GROUP BY collapses rows sharing a value into one row per group, so you can use aggregate functions like COUNT, SUM, AVG per group. HAVING filters groups after aggregation (unlike WHERE, which filters rows before).',
   'SELECT department, AVG(salary) FROM employees GROUP BY department HAVING AVG(salary) > 70000;',
   'Write a query that finds which product categories have sold more than 100 units total.'),
  (4, 'Subqueries and CTEs',
   'A subquery is a query nested inside another. A CTE (WITH clause) names a subquery so it can be reused and read top-to-bottom, which is usually clearer than deeply nested subqueries.',
   'WITH top_customers AS (SELECT customer_id, SUM(total) AS spent FROM orders GROUP BY customer_id) SELECT * FROM top_customers WHERE spent > 1000;',
   'Rewrite a query that finds employees earning more than their department''s average salary, using a CTE.'),
  (5, 'Data cleaning basics',
   'Real data has duplicates, NULLs, and inconsistent formatting. DISTINCT removes duplicate rows. COALESCE substitutes a default for NULLs. TRIM/LOWER normalize text for comparison.',
   'SELECT DISTINCT LOWER(TRIM(email)) FROM signups; normalizes emails before deduplicating.',
   'Given a "customers" table where some phone numbers are NULL, write a query that shows "Not provided" instead of NULL.'),
  (6, 'Indexes and query performance',
   'An index lets the database find rows without scanning the whole table — like a book''s index instead of reading every page. Indexes speed up WHERE/JOIN/ORDER BY on the indexed column, but slow down writes slightly and use extra storage, so they''re a trade-off, not a free win.',
   'CREATE INDEX idx_orders_customer ON orders(customer_id); speeds up queries that filter or join on customer_id.',
   'You have a 10-million-row "orders" table and queries filtering by customer_id are slow. What would you check or add first?')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'sql-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Git & Version Control
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'The three areas: working directory, staging, commits',
   'Git tracks changes in three stages: your working directory (files as you see them), the staging area (changes marked to be included in the next commit via git add), and commits (permanent snapshots via git commit). Understanding this separation explains most of Git''s day-to-day commands.',
   'git add file.txt stages one file; git commit -m "message" turns everything staged into a permanent snapshot.',
   'Change two files, but only stage and commit one of them. Check git status after each step to see the difference.'),
  (2, 'Branching',
   'A branch is an independent line of work. Creating a branch for each feature or fix keeps main/master always deployable and makes it easy to abandon an idea without cleanup.',
   'git checkout -b feature/login creates and switches to a new branch for login work.',
   'Create a branch, make a commit on it, then switch back to main and confirm your change isn''t there.'),
  (3, 'Merging and resolving conflicts',
   'A merge conflict happens when the same lines were changed differently on two branches being combined, and Git can''t decide which version is correct. You resolve it by editing the conflicted file to keep the right content, then staging and committing.',
   'After a conflicting merge, Git marks the file with conflict markers you must edit by hand before committing.',
   'Intentionally create a merge conflict (edit the same line on two branches) and practice resolving it.'),
  (4, 'Merge vs rebase',
   'git merge combines two branches and preserves full history with a merge commit. git rebase replays your commits on top of another branch, producing a linear history but rewriting commit hashes — which is risky on a branch others are also using.',
   'git rebase main while on a feature branch moves your commits to sit on top of the latest main, avoiding an extra merge commit.',
   'Explain, in your own words, why rebasing a branch that a teammate has already pulled can cause them problems.'),
  (5, 'Writing useful commit messages',
   'A commit message should explain why a change was made, not just repeat what changed (the diff already shows that). Future you, or a teammate debugging months later, relies on this context.',
   '"Fix" is a bad commit message. "Fix null pointer when user has no saved address" is a good one.',
   'Rewrite three vague commit messages ("fix", "update", "wip") into specific, useful ones for a hypothetical change.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'git-version-control'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- JavaScript Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Variables and scope',
   'let and const are block-scoped (only exist within the braces they''re declared in); var is function-scoped and can lead to confusing bugs. Prefer const by default, and let only when you need to reassign.',
   'if (true) { let x = 1; } — x doesn''t exist outside the if block. With var it would.',
   'Predict the output of a loop using var i in a setTimeout callback, then check if you were right.'),
  (2, 'Arrays and objects',
   'Arrays and objects are the two core data structures. Common array methods — map (transform), filter (select), reduce (accumulate) — return new arrays rather than mutating the original, which avoids a whole class of bugs.',
   'const doubled = [1,2,3].map(n => n * 2); gives [2,4,6] — the original array is untouched.',
   'Given an array of user objects, write one line using filter + map to get the names of all users older than 18.'),
  (3, 'Understanding "this"',
   '"this" depends on how a function is called, not where it''s defined. Called as obj.method(), "this" is obj. Called alone, "this" is undefined (in strict mode) or the global object. Arrow functions don''t have their own "this" — they inherit it from their surrounding scope.',
   'const obj = { name: "A", greet() { return this.name; } }; obj.greet() returns "A", but assigning greet to a variable and calling it alone would not.',
   'Explain why using a regular function (not an arrow function) as a callback inside a class method often breaks "this".'),
  (4, 'Promises and async/await',
   'A Promise represents a value that will exist later (e.g. from a network request). async/await is syntax that makes working with Promises read like synchronous code. Always wrap awaited calls that can fail in try/catch.',
   'An async function can await a fetch call, check response.ok, and throw an Error if the request failed, before returning the parsed JSON.',
   'Write an async function that fetches two URLs in parallel (not one after another) and returns both results.'),
  (5, 'Common bugs and how to avoid them',
   'Two frequent sources of bugs: mutating an object/array that other code still holds a reference to, causing unexpected changes elsewhere; and comparing values with == instead of === and hitting JavaScript''s type coercion rules.',
   'Comparing an empty array to false with == gives a surprising true, but the strict === comparison gives false, which is almost always what you actually want.',
   'Find and fix a snippet where a function mutates an array parameter that the caller didn''t expect to change.'),
  (6, 'Modules and code organization',
   'ES modules (import/export) let you split code into files with clear boundaries instead of one giant script or relying on global variables. Named exports are explicit about what a file provides; default exports are for a file''s single main thing.',
   'Exporting a named formatDate function from a utils file, then importing just that function elsewhere, keeps dependencies explicit.',
   'Take a script with three unrelated functions in one file and split it into modules with clear, minimal exports.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'javascript-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- HTML & CSS Essentials
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Semantic HTML',
   'Semantic elements (nav, header, main, article, button) describe meaning, not just appearance — screen readers, search engines and browsers all use this meaning. A styled div is not a button to assistive technology; a real button element is.',
   'Use nav for primary navigation and button for anything clickable that triggers an action, instead of a styled div.',
   'Take a page built entirely with divs and rewrite its structure using semantic elements.'),
  (2, 'The box model',
   'Every element is a box: content, then padding (space inside the border), then border, then margin (space outside the border). box-sizing: border-box makes width/height include padding and border, which matches most designers'' mental model and avoids surprise overflow.',
   'A 200px-wide box with 20px padding and default content-box sizing actually renders 240px wide; with border-box it stays 200px.',
   'Add box-sizing: border-box to a layout that''s overflowing and observe the difference.'),
  (3, 'Flexbox layout',
   'Flexbox lays children out along a main axis (justify-content) and a cross axis (align-items). It solves most everyday layout problems — centering, equal-height columns, spacing — without floats or absolute positioning.',
   'display: flex with justify-content: space-between and align-items: center spreads items apart horizontally and centers them vertically.',
   'Build a header with a logo on the left and three nav links on the right, vertically centered, using only Flexbox.'),
  (4, 'CSS specificity and the cascade',
   'When multiple rules target the same element, specificity decides which wins: inline styles beat IDs, which beat classes and attributes, which beat plain element selectors. Reaching for !important usually means the underlying selector structure needs rethinking.',
   'A selector combining an ID and a class has higher specificity than the class alone, so it wins even if the class rule comes later in the file.',
   'Given two conflicting CSS rules on the same button, work out which one applies without running the code.'),
  (5, 'Accessible markup',
   'Every image that conveys information needs an alt attribute. Every form input needs an associated label. Landmarks (nav, main, footer) let screen-reader users jump directly to page sections instead of tabbing through everything.',
   'A label linked to an input by matching for/id attributes lets a screen reader announce what the input is for; without that link, it can''t.',
   'Audit a form you''ve built (or find one online) for missing labels and alt text, and list what''s missing.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'html-css-essentials'
ON CONFLICT (topic_id, sort_order) DO NOTHING;
