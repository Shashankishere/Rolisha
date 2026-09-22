-- Lessons for the 30 topics seeded in 20260826030000_seed_learning_content_batch3.sql

-- Power BI Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Shaping data with Power Query',
   'Power Query is where you clean and reshape data before it ever reaches a visual — renaming columns, fixing types, removing duplicates, and unpivoting. Doing this once in Power Query beats fixing the same mess in every downstream visual.',
   'A sales export with a "Region " column (trailing space) and mixed date formats gets trimmed and standardized once in Power Query, so every report built on it is automatically clean.',
   'You get a CSV with a "Full Name" column. Describe the Power Query steps to split it into "First Name" and "Last Name" columns.'),
  (2, 'Fact and dimension tables',
   'A fact table holds measurable events (a sale, a click) with foreign keys to dimension tables that describe context (customer, product, date). This star schema is why "how much did we sell in March, by region" is a fast, reliable query instead of a messy one.',
   'A Sales fact table with CustomerID and ProductID links out to Customer and Product dimension tables, instead of repeating the customer''s full name and address on every single sales row.',
   'Given raw columns OrderID, OrderDate, CustomerName, CustomerEmail, ProductName, Price, Quantity, decide which columns belong in a fact table vs a dimension table.'),
  (3, 'Basic DAX measures',
   'DAX measures calculate values dynamically based on filter context (whatever slicers/rows are currently applied). SUM aggregates a column; CALCULATE changes the filter context a measure is evaluated in — it is the single most important DAX function to understand.',
   'Total Sales = SUM(Sales[Amount]) gives a simple total. Sales LY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR(''Date''[Date])) reuses that measure but shifts the time filter back a year.',
   'Write the DAX for a measure called "Average Order Value" using SUM of sales amount divided by DISTINCTCOUNT of order IDs.'),
  (4, 'Choosing the right visual',
   'A line chart shows a trend over time; a bar chart compares discrete categories; a scatter plot shows the relationship between two numeric variables. Picking the wrong one (e.g. a pie chart with 12 slices) makes an otherwise correct number hard to read.',
   'Monthly revenue over 2 years is a line chart. Revenue by product category (6 categories) is a sorted bar chart, not a pie chart.',
   'You need to show how customer satisfaction score relates to support response time across 200 customers. Which visual fits, and why?'),
  (5, 'Slicers and interactive filtering',
   'Slicers let report viewers filter visuals interactively (by date, region, category) without needing to edit the report. Sync slicers across pages so filtering feels consistent as someone navigates the report.',
   'A region slicer placed on a sales dashboard lets a viewer click "West" and instantly see every chart on the page filtered to just West region sales.',
   'A stakeholder wants to compare two specific months side by side on the same page. Describe how you would set up slicers/filters to support that.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'power-bi-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Tableau Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Dimensions vs measures',
   'Tableau automatically classifies fields as dimensions (categorical, used to slice/group data — like region or product) or measures (numeric, used to aggregate — like revenue). Misclassifying a field, like a numeric ID, breaks aggregation.',
   'Zip code is numeric but should be a dimension (you group by it, never sum it); revenue is a measure you sum or average.',
   'A dataset has a "Customer ID" field stored as a number. Explain why it should be converted to a dimension rather than left as a measure.'),
  (2, 'Core chart types',
   'Bars compare categories, lines show trends over time, scatter plots reveal relationships between two measures, and maps show geographic distribution. Drag a dimension to Rows/Columns and a measure to the chart shelf to build each.',
   'Dragging Region to Rows and SUM(Sales) to Columns builds a horizontal bar chart comparing sales by region instantly.',
   'You want to see if marketing spend and revenue are related across 50 campaigns. Which chart type fits, and which fields go on which shelf?'),
  (3, 'Filters, parameters, and calculated fields',
   'Filters restrict which data appears in a view. Parameters let a user dynamically change a value used in a calculation (like a threshold). Calculated fields let you derive new measures/dimensions with Tableau''s formula language.',
   'A calculated field Profit Ratio = SUM([Profit]) / SUM([Sales]) creates a reusable measure available across every view in the workbook.',
   'Write the logic for a calculated field that flags an order as "High Value" if its Sales amount is greater than 1000.'),
  (4, 'Building a dashboard with actions',
   'A dashboard combines multiple worksheets on one canvas. A filter action lets clicking a mark in one chart filter the others, turning several static charts into one connected, explorable dashboard.',
   'Clicking a specific region on a map filters a sales-by-product bar chart elsewhere on the same dashboard to just that region.',
   'You have a bar chart of sales by category and a line chart of sales over time on the same dashboard. Describe the action you''d add so clicking a category filters the trend line to just that category.'),
  (5, 'Level of detail (LOD) expressions',
   'LOD expressions let you compute a value at a different granularity than the view''s current level (e.g. average order value per customer, shown alongside per-row data), avoiding double-counting or wrong aggregation.',
   '{FIXED [Customer ID] : SUM([Sales])} calculates each customer''s total sales regardless of what other dimensions are in the current view.',
   'You need each product''s average sales across all its orders, but the view is broken down by order date. Explain why a plain SUM would be wrong and how a FIXED LOD expression fixes it.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'tableau-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Business Analytics Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'From business question to analytical question',
   'A stakeholder rarely asks a directly answerable question ("why are sales down?"). Your job is to translate that into something measurable — a specific metric, time window, and comparison — before touching any data.',
   '"Why are sales down?" becomes "How does this quarter''s conversion rate by channel compare to last quarter''s, and which channel accounts for most of the drop?"',
   'A manager asks "why aren''t customers happy?" Rewrite this as one specific, measurable analytical question.'),
  (2, 'Choosing the right metric',
   'Every metric has blind spots. Total revenue hides whether growth came from more customers or higher prices. Average hides distribution. Pick — and pair — metrics deliberately based on the decision they inform.',
   'Reporting only "average session length increased" hides whether that''s because engaged users stayed longer, or because a bug made the page hang for everyone.',
   'A team wants one metric to track "product health." Propose two complementary metrics instead of one, and explain what each covers that the other misses.'),
  (3, 'Funnels and cohorts',
   'A funnel shows step-by-step drop-off in a process (signup -> activation -> purchase). A cohort groups users by when they started, so you can compare how different cohorts behave over time rather than mixing new and old users together.',
   'A signup funnel showing 100% -> 60% -> 20% reveals the biggest drop is between account creation and first purchase, not signup itself.',
   'Retention looks flat overall, but you suspect it changed after a redesign. Explain how a cohort view (by signup month) would reveal this when an aggregate number would not.'),
  (4, 'Leading vs lagging indicators',
   'A lagging indicator (revenue, churn) tells you what already happened. A leading indicator (trial signups, feature adoption) predicts what''s likely to happen, giving you time to act before the lagging number moves.',
   'Monthly recurring revenue is lagging; weekly active trial usage is a leading indicator that often moves first and predicts the lagging number.',
   'For a subscription product, propose one leading indicator that would likely predict next quarter''s churn.'),
  (5, 'From finding to recommendation',
   'A chart is not an answer. Good analysis ends with a specific, defensible recommendation tied to the business decision at hand, including the confidence level and what would change the recommendation.',
   '"Conversion dropped 8% after the checkout redesign, concentrated in mobile users — recommend reverting the mobile checkout flow" is a recommendation; "conversion dropped 8%" alone is not.',
   'You found that customers acquired via paid search churn twice as fast as organic customers. Write one sentence turning that finding into an actionable recommendation.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'business-analytics-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Pandas for Data Analysis
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Loading and inspecting a DataFrame',
   'pd.read_csv loads tabular data into a DataFrame. .head(), .info(), and .describe() are the first three calls you should make on any new dataset — they reveal shape, types, and obvious problems before you write a single transformation.',
   'df = pd.read_csv("sales.csv"); df.info() immediately shows you which columns have missing values and whether a "date" column loaded as text instead of a datetime.',
   'After loading a DataFrame, write the three commands you''d run first to understand its shape, types, and summary statistics.'),
  (2, 'Handling missing data deliberately',
   'Missing values (NaN) need a deliberate decision: drop the row, drop the column, or fill with a sensible value (mean, median, forward-fill). The wrong default silently changes your results.',
   'df.dropna() with no arguments drops any row with even one missing value anywhere — on a wide DataFrame this can silently discard most of your data.',
   'A "discount_percent" column is missing for 5% of rows, and you believe those orders simply had no discount. Write the pandas line to fill those specifically with 0 instead of dropping the rows.'),
  (3, 'Grouping and aggregating',
   'df.groupby("column").agg(...) splits data into groups and computes a summary per group — the pandas equivalent of a pivot table or SQL GROUP BY.',
   'df.groupby("region")["sales"].sum() gives total sales per region in one line.',
   'Write the pandas line to compute both the average and the max order value, grouped by customer segment.'),
  (4, 'Merging DataFrames like SQL joins',
   'pd.merge(df1, df2, on="key", how="inner"/"left"/"outer") combines DataFrames the same way SQL joins do. The "how" argument matters as much as it does in SQL — an inner join silently drops unmatched rows.',
   'pd.merge(orders, customers, on="customer_id", how="left") keeps every order even if a matching customer record is somehow missing.',
   'You merge orders with a customer table using how="inner" and the row count drops by 5%. Explain what that tells you and how you''d confirm it.'),
  (5, 'Reshaping wide and long data',
   'pd.melt() turns wide data (one column per month) into long/tidy data (one row per month), which most plotting and grouping operations expect. pivot() does the reverse.',
   'A DataFrame with columns Jan, Feb, Mar (one per month) becomes a long DataFrame with columns month and value using pd.melt(df, id_vars=["product"], var_name="month", value_name="sales").',
   'You have a wide DataFrame with a column per year (2022, 2023, 2024) and want to plot a trend line. Explain why you''d reshape it first and what function you''d use.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'pandas-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Tailwind CSS Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Utility-first styling',
   'Instead of writing a custom CSS class and stylesheet rule, Tailwind gives you small, composable utility classes directly in your markup — one for padding, one for color, one for font weight — combined to build the exact look you need.',
   '<button className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium"> styles a button entirely with utilities, no separate CSS file needed.',
   'Using only utility classes, style a card with white background, rounded corners, medium shadow, and 6-unit padding.'),
  (2, 'Using the design scale consistently',
   'Tailwind''s spacing, color, and type scales are deliberately constrained (p-2, p-4, p-6, not arbitrary pixel values) so a whole app stays visually consistent by default, as long as you stick to the scale instead of arbitrary values.',
   'Using p-4 and p-6 consistently across cards keeps spacing rhythm consistent; sprinkling in p-[13px] here and p-[22px] there breaks that rhythm invisibly.',
   'Explain why mt-[17px] is a worse choice than mt-4 in a Tailwind codebase, even if 17px was the designer''s exact spec.'),
  (3, 'Responsive breakpoints',
   'Prefixes like sm:, md:, and lg: apply a utility only at that breakpoint and above, letting you build mobile-first responsive layouts directly in the class list without separate media query CSS.',
   'className="flex flex-col md:flex-row" stacks items vertically on mobile and switches to a horizontal row from the md breakpoint up.',
   'Write the Tailwind classes for a grid that shows 1 column on mobile, 2 columns from md, and 4 columns from lg.'),
  (4, 'State variants',
   'hover:, focus:, disabled:, and similar prefixes apply a utility only in that interactive state, which is how you build visible hover/focus feedback without any separate CSS or JS.',
   'className="bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-400" gives a button both hover and keyboard-focus feedback.',
   'A submit button currently has no visible change when disabled. Write the Tailwind classes to make it appear faded and show a not-allowed cursor when disabled.'),
  (5, 'Extracting repeated patterns',
   'When the same long utility string appears on many elements, extract it into a reusable component (or use @apply sparingly) instead of copy-pasting, so a design change happens in one place.',
   'Instead of repeating "px-4 py-2 bg-blue-600 text-white rounded-md" on 15 buttons, extract a <Button> component that applies those classes once.',
   'You notice the same 6-utility class string on 10 different <span> badges across the app. Describe the refactor you''d make.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'tailwind-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Next.js Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'File-based routing',
   'In the app router, a folder under app/ becomes a URL segment, and a page.tsx file inside it becomes that route''s content — no separate router configuration file to maintain.',
   'app/careers/[slug]/page.tsx automatically handles /careers/data-analyst, /careers/frontend-developer, and so on, with slug available as a route param.',
   'Describe the folder/file structure you''d create for a route at /projects/[projectId]/tasks.'),
  (2, 'Server vs client components',
   'Components are server components by default — rendered on the server, sending no JS for them to the browser. Add "use client" only when a component needs interactivity (state, event handlers, browser-only APIs).',
   'A page that fetches and displays a list of projects can stay a server component; a "like" button that needs onClick and local state needs "use client".',
   'A component displays a static list of career titles with no interactivity. Should it be a server or client component, and why?'),
  (3, 'Rendering strategies',
   'Static rendering builds a page at build time (fast, but data can go stale). Server rendering builds it per-request (always fresh, slightly slower). Streaming lets parts of a slow page arrive progressively instead of blocking the whole response.',
   'A marketing page with content that rarely changes is a good static-rendering candidate; a personalized dashboard needs per-request server rendering.',
   'You''re building a public blog post page and a logged-in user dashboard. Which rendering strategy fits each, and why?'),
  (4, 'Fetching data on the server',
   'Fetching data directly inside a server component (during render) avoids the client-server round trip a useEffect-based fetch would require, and keeps API keys/secrets off the client entirely.',
   'An async server component can directly call const data = await fetch(...) at the top of the function, with no loading spinner needed for that data.',
   'A client component currently fetches career data with useEffect after mount, causing a visible loading flash. Explain how moving that fetch to a server component would remove the flash.'),
  (5, 'Loading and error conventions',
   'A loading.tsx file in a route folder automatically shows while that segment''s data is being fetched; an error.tsx file automatically catches rendering errors in that segment, without manual try/catch scattered everywhere.',
   'Adding app/projects/loading.tsx with a skeleton UI automatically shows while the projects list loads, with zero manual state management.',
   'A route currently shows a blank white screen for a second while data loads. Name the file you''d add and roughly what it should contain.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'nextjs-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Web Accessibility (a11y) Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Semantic HTML first',
   'Elements like <button>, <a>, <nav>, and <label> come with built-in keyboard operability and screen-reader semantics for free. A styled <div onClick> looks the same visually but is invisible to a keyboard or screen-reader user.',
   'A <button> is focusable and triggers on both click and Enter/Space automatically; a <div onClick> needs manual tabIndex, role, and key handlers to match that — and is easy to get wrong.',
   'You find a clickable <div className="button"> in the codebase. Explain the two things it''s silently missing compared to a real <button>.'),
  (2, 'Color contrast and never color-alone',
   'Text needs sufficient contrast against its background (WCAG AA is a common bar: 4.5:1 for normal text) to be readable for low-vision users, and any status or meaning conveyed by color also needs a non-color signal (icon, text, pattern).',
   'A red vs green form field border for error/success is invisible to a colorblind user unless paired with an icon or message text.',
   'A dashboard shows "healthy" vs "at risk" projects using only a green or red dot. Propose a fix that doesn''t rely on color alone.'),
  (3, 'Keyboard operability and focus',
   'Every interactive element must be reachable and operable via Tab/Enter/Space alone, with a visible focus indicator showing where keyboard focus currently is — many users cannot use a mouse at all.',
   'Removing outline: none on :focus with no replacement leaves keyboard users with no visual indication of where they are on the page.',
   'You want to remove the default blue focus ring for design reasons. Describe what you must add instead to stay accessible.'),
  (4, 'Alt text and form labels',
   'Images that convey information need descriptive alt text; purely decorative images should have empty alt="" so screen readers skip them. Every form input needs an associated, visible label, not just a placeholder.',
   'A placeholder like "Email" disappears the moment a user starts typing, so a screen reader (and the user, once typing) loses the field''s purpose — a real <label> stays present.',
   'A search input currently only has placeholder="Search projects" and no <label>. Explain the accessibility problem and how you''d fix it.'),
  (5, 'Using ARIA only when needed',
   'ARIA roles/attributes exist to describe custom widgets HTML has no native element for (like a tab panel or combobox). Adding ARIA on top of an element that already has correct native semantics is usually redundant or actively harmful.',
   'Adding role="button" to an actual <button> element does nothing useful; adding it to a <div> to fake a button still leaves out keyboard behavior ARIA can''t provide on its own.',
   'A custom dropdown menu is built entirely from styled <div>s. Name one ARIA attribute it would need that a native <select> would not.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'accessibility-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Node.js Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'The event loop',
   'Node runs JavaScript on a single thread but handles I/O (file, network, database) asynchronously via the event loop — the thread never blocks waiting for I/O, it moves on and comes back via a callback/promise when the result is ready.',
   'A slow database query doesn''t freeze the whole server for other users; Node keeps handling other requests while that one query is in flight.',
   'Explain, in one or two sentences, why a CPU-heavy synchronous loop (like sorting a huge array in place) is more dangerous in Node than a slow network request.'),
  (2, 'Files and streams',
   'fs.readFile loads an entire file into memory at once — fine for small files, risky for large ones. Streams process data in chunks, which is essential for large files or data you want to start processing before it fully arrives.',
   'Reading a 2GB log file with fs.readFile risks running out of memory; piping it through a read stream processes it in manageable chunks instead.',
   'You need to process a very large CSV export without loading the whole thing into memory. Name the approach you''d use instead of fs.readFile.'),
  (3, 'HTTP servers and middleware',
   'A basic server handles requests and sends responses; middleware functions run in sequence before the final handler, commonly used for logging, auth checks, and parsing request bodies.',
   'An Express app might run a logging middleware, then an auth middleware that checks a token, then the actual route handler — each can short-circuit the chain by not calling next().',
   'Describe, at a high level, the order you''d place logging, authentication, and body-parsing middleware in a request pipeline, and why.'),
  (4, 'Async control flow',
   'async/await makes asynchronous code read like synchronous code, but errors from a rejected promise still need a try/catch (or .catch), or they become unhandled rejections that can crash the process.',
   'async function getUser(id) { try { return await db.query(...); } catch (err) { logger.error(err); throw err; } } handles the failure case explicitly instead of leaving it unhandled.',
   'Rewrite this to handle a failed database call safely: `async function getUser(id) { return await db.query(id); }`'),
  (5, 'npm and package.json basics',
   'package.json declares your dependencies and their version ranges; package-lock.json pins the exact resolved versions so every install (yours, a teammate''s, CI''s) gets identical dependency trees.',
   'A dependency declared as "^4.2.0" could resolve to 4.9.0 on a fresh install months later — the lock file prevents that drift from silently breaking a working setup.',
   'Explain why committing package-lock.json to version control matters, even though it''s auto-generated.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'nodejs-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- MongoDB Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Documents and collections',
   'A MongoDB document is a JSON-like object (BSON) and a collection is a group of documents — roughly analogous to a row and a table, but documents in the same collection don''t need identical fields.',
   '{ "_id": 1, "name": "Amara", "tags": ["admin", "beta"] } is a single document in a "users" collection; another user document could have completely different optional fields.',
   'Compare storing a blog post''s comments as an embedded array inside the post document vs a separate "comments" collection referencing the post by ID.'),
  (2, 'Embedding vs referencing',
   'Embed related data that is always read together and bounded in size (an address inside a user document). Reference (store an ID and look it up separately) data that is large, unbounded, or shared across many parents.',
   'Embedding a user''s shipping address makes sense (small, always read with the user); referencing a product from an order makes sense (products are shared and looked up separately).',
   'An e-commerce order needs to record its line items. Would you embed them in the order document or reference a separate collection? Justify it.'),
  (3, 'Basic CRUD and filters',
   'db.collection.find({ field: value }) filters documents; insertOne/updateOne/deleteOne handle single-document writes, with query operators like $gt, $in, and $exists for more complex filters.',
   'db.orders.find({ status: "pending", total: { $gt: 100 } }) finds pending orders over $100.',
   'Write a MongoDB query to find all users whose "role" field is either "admin" or "editor".'),
  (4, 'Indexes',
   'Without an index, MongoDB scans every document in a collection to satisfy a query. An index on a frequently filtered/sorted field turns that into a fast lookup, at the cost of slightly slower writes and extra storage.',
   'Querying db.orders.find({ customerId: "abc" }) on a million-document collection is slow without an index on customerId, and fast with one.',
   'A "users" collection is frequently queried by email for login. Which field should be indexed, and why?'),
  (5, 'When MongoDB fits (and doesn''t)',
   'MongoDB fits flexible, evolving schemas and data that''s naturally document-shaped. It fits less well for data with heavy cross-entity relationships and strict transactional/consistency needs across many records, where a relational database''s constraints and joins are a better tool.',
   'A content management system with varied, evolving article structures fits MongoDB well; a banking ledger needing strict multi-table transactional consistency fits a relational database better.',
   'You''re asked to store financial transactions that must always balance exactly across multiple related tables. Would you default to MongoDB or a relational database, and why?')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'mongodb-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Java Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Classes, objects, and interfaces',
   'A class is a blueprint; an object is an instance of it. An interface defines a contract (method signatures) that any implementing class must fulfill, letting code depend on behavior rather than a specific concrete class.',
   'interface PaymentProcessor { void charge(double amount); } lets StripeProcessor and PaypalProcessor both implement it, and calling code can depend on the interface alone.',
   'Explain why coding against an interface (List<String> list = new ArrayList<>()) instead of the concrete type is generally preferred in Java.'),
  (2, 'Core collections',
   'List preserves order and allows duplicates; Set enforces uniqueness with no guaranteed order (unless you use a LinkedHashSet/TreeSet); Map stores key-value pairs for fast lookup by key.',
   'Using a HashSet<String> to track "already-processed" IDs automatically prevents duplicate processing without manual duplicate-checking logic.',
   'You need to count how many times each word appears in a list of strings. Which Java collection type fits, and why?'),
  (3, 'Static vs instance members',
   'An instance member belongs to each object separately; a static member belongs to the class itself and is shared across all instances. Overusing static breaks the object-oriented benefits of encapsulation and testability.',
   'A Counter class with a static int totalCount tracks how many Counter objects have ever been created, shared across all instances, unlike an instance field.',
   'Explain why making every method in a class static, just to avoid creating an instance, defeats the purpose of using a class at all.'),
  (4, 'Exception handling',
   'Checked exceptions must be declared or caught (e.g. IOException); unchecked exceptions (RuntimeException and subclasses) don''t require this. Catch the specific exception type you expect, not a broad Exception, so real bugs aren''t hidden.',
   'catch (FileNotFoundException e) handles a specific, expected failure; catch (Exception e) would also silently swallow an unrelated NullPointerException bug.',
   'A method reads a file and parses its contents as a number. Name the two specific exception types you''d want to catch separately, and why.'),
  (5, 'Basic generics',
   'Generics let a class or method work with any type while still being checked at compile time, avoiding both code duplication and unsafe casts. List<String> guarantees at compile time that only strings go in.',
   'A raw List (no type parameter) lets you accidentally add an Integer to a list of Strings with no compiler warning; List<String> prevents that at compile time.',
   'Explain what compile-time safety you lose if you declare a collection as a raw List instead of List<String>.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'java-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Docker Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Images vs containers',
   'An image is a read-only template (your app plus its dependencies, baked in layers); a container is a running instance of that image. You can start many containers from the same image, each isolated from the others.',
   'docker build creates an image once; docker run can start that same image as a container multiple times, each with its own isolated filesystem changes.',
   'Explain the difference between "rebuilding an image" and "restarting a container" and when each is actually needed.'),
  (2, 'Writing a correct Dockerfile',
   'Each Dockerfile instruction (FROM, COPY, RUN) creates a layer. Order matters: put rarely-changing steps (installing dependencies) before frequently-changing steps (copying source code) so Docker''s layer cache speeds up rebuilds.',
   'Copying package.json and running npm install before copying the rest of the source means code changes don''t force a full dependency reinstall on every rebuild.',
   'You have a Dockerfile that COPYs the entire project first, then runs npm install. Explain why reordering those two steps would speed up rebuilds.'),
  (3, 'Volumes for persistent data',
   'A container''s own filesystem is ephemeral — deleting the container deletes its data. A volume is a separate, persistent storage location mounted into the container, so data survives container restarts/removal.',
   'Running a Postgres container with -v pgdata:/var/lib/postgresql/data means the database survives even if the container is removed and recreated.',
   'You run a database in a container with no volume configured, then remove the container to upgrade the image. What happens to the data, and how would a volume prevent that?'),
  (4, 'Docker Compose for multi-service apps',
   'A docker-compose.yml file describes multiple related containers (e.g. app + database + cache) and their shared network/config in one file, so the whole stack starts with one command instead of manually running each container.',
   'A docker-compose.yml with services for "api" and "db" lets both start together with shared networking, so the api service can reach the db by its service name.',
   'You need to run a Node API alongside a Postgres database locally for development. Describe the two services you''d define in docker-compose.yml.'),
  (5, 'Smaller, layered images',
   'A multi-stage build compiles/builds in one stage (with all the build tools) and copies only the final artifact into a lean final-stage image, dramatically shrinking image size and attack surface versus shipping build tools to production.',
   'A Node app built with a multi-stage Dockerfile can drop from 1.2GB (with the full build toolchain) to under 200MB in the final runtime image.',
   'Explain why shipping your build tools (compilers, dev dependencies) inside your production image is generally a bad practice.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'docker-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- CI/CD Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Continuous integration vs delivery/deployment',
   'Continuous integration means every change is automatically built and tested on merge. Continuous delivery means every passing change is ready to release at any time; continuous deployment goes further and releases it automatically with no manual step.',
   'A team that runs tests on every pull request practices CI; a team where a passing merge to main auto-deploys to production practices continuous deployment.',
   'Explain the difference between continuous delivery and continuous deployment in one sentence each.'),
  (2, 'A basic automated pipeline',
   'A pipeline definition (e.g. a GitHub Actions workflow file) triggers on an event (push, pull request) and runs a sequence of steps: install dependencies, lint, run tests, and optionally build/deploy.',
   'A workflow triggered on pull_request that runs npm ci, then npm run lint, then npm test gives every reviewer automatic confidence the change didn''t break anything, before a human even looks at it.',
   'List the steps, in order, you''d expect in a basic CI pipeline for a Node.js project.'),
  (3, 'Build artifacts and environment config',
   'A build artifact is the packaged output of a build step (a compiled binary, a Docker image) passed between pipeline stages. Environment-specific values (API URLs, keys) should come from environment variables/secrets, never hardcoded into the artifact.',
   'A pipeline builds one Docker image artifact once, then deploys that same artifact to staging and production, configured differently only via environment variables at runtime.',
   'Explain why hardcoding a staging database URL directly into application code (instead of an environment variable) causes a problem when that same build gets deployed to production.'),
  (4, 'Why staging exists',
   'A staging environment mirrors production closely enough to catch integration issues (config, data, third-party services) that unit tests alone won''t surface, before real users are affected.',
   'A payment integration might work perfectly in unit tests but fail against the real payment provider''s sandbox — something only a staging deploy would catch.',
   'A "small" CSS-only change is being deployed straight to production, skipping staging, to save time. Explain one risk with that shortcut, even for a change that seems purely cosmetic.'),
  (5, 'Reducing pipeline flakiness',
   'A flaky test passes and fails intermittently with no code change, usually due to timing assumptions, shared state between tests, or real network calls. Left unfixed, teams start ignoring red pipelines entirely, defeating CI''s purpose.',
   'A test that waits a fixed 500ms for an async operation to finish is flaky on a slow CI runner; waiting for the actual condition (not a fixed delay) fixes it.',
   'A test intermittently fails only on CI, never locally, and involves waiting for an animation to finish. Propose the likely cause and a fix.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'ci-cd-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Cloud (AWS) Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Core building blocks',
   'EC2 gives you a virtual server; serverless (Lambda) runs code without managing a server at all; S3 stores files/objects; RDS runs a managed relational database so you don''t patch/back it up manually.',
   'A small API with unpredictable traffic might run cheaply on Lambda; a steady, always-on service might run more predictably on EC2.',
   'You need to store user-uploaded profile photos. Which core AWS building block fits best, and why not a database for this?'),
  (2, 'IAM and least privilege',
   'IAM controls who (or what service) can do what. The principle of least privilege means granting only the specific permissions a role actually needs — not broad admin access "to be safe," which is actually far riskier.',
   'A Lambda function that only needs to read from one specific S3 bucket should get a policy scoped to exactly that bucket and the GetObject action, not full S3 access.',
   'A service currently has AdministratorAccess but only needs to read from one DynamoDB table. Describe the policy change you''d make.'),
  (3, 'Security groups vs network ACLs',
   'A security group is a stateful firewall attached to a resource (like an EC2 instance) — allow a request in, and the matching response is automatically allowed back out. A network ACL is stateless and operates at the subnet level, checking both directions explicitly.',
   'A security group allowing inbound port 443 automatically allows the corresponding outbound response traffic; a network ACL would need explicit outbound rules too.',
   'Explain, in one sentence, the practical difference between "stateful" and "stateless" in this context.'),
  (4, 'Regions and availability zones',
   'A region is a geographic area (e.g. us-east-1); each region has multiple availability zones (physically separate data centers) so an outage in one zone doesn''t take down a properly distributed application.',
   'Running your database with a standby replica in a second availability zone means a single data center outage doesn''t take your application offline.',
   'An application currently runs entirely in one availability zone. What''s the risk, and what''s the general fix?'),
  (5, 'Basic cost awareness',
   'Compute, storage, and data transfer are the main cost drivers. Resources left running (unused EC2 instances, forgotten test databases) accrue cost even when idle — cleaning up unused resources is a routine, not optional, practice.',
   'A developer spins up an EC2 instance for a one-off test and forgets to terminate it — it keeps costing money every hour until someone notices.',
   'Name two habits that help avoid unexpected AWS bills on a small side project.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'cloud-aws-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Linux & Shell Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Filesystem navigation and permissions',
   'Permissions (rwx) apply separately to owner, group, and others. Read/write/execute mean different things for a file vs a directory (execute on a directory means "can list/enter it").',
   'chmod 644 file.txt gives the owner read/write and everyone else read-only — a common, safe default for a regular file.',
   'A script needs to be run by its owner but not readable/writable by anyone else. What chmod permission number would you set?'),
  (2, 'Searching and filtering with grep, find, and pipes',
   'grep searches text for a pattern; find locates files by name/type/path; the pipe (|) chains commands so one command''s output becomes the next command''s input, letting you compose small tools into a specific query.',
   'grep "ERROR" app.log | wc -l counts how many lines in a log file contain "ERROR" by piping grep''s matches into a line counter.',
   'Write a one-line command to find all ".log" files under /var/log modified in the last 24 hours.'),
  (3, 'Processes: viewing, killing, and background jobs',
   'ps/top show running processes; kill sends a signal to a process (a graceful SIGTERM by default, a forceful SIGKILL with -9); appending & runs a command in the background so your shell stays free.',
   'kill 4521 asks process 4521 to shut down gracefully; kill -9 4521 forces it to stop immediately, skipping any cleanup it might have been doing.',
   'A process is hung and not responding to a normal kill. Explain the difference in what kill -9 does versus a plain kill, and the tradeoff of using it.'),
  (4, 'Reading logs in real time',
   'tail -f follows a log file as new lines are appended, letting you watch activity live instead of repeatedly re-opening the file — essential for watching an application or server as it runs.',
   'tail -f /var/log/auth.log lets you watch login attempts arrive in real time while investigating suspicious activity.',
   'You want to watch a log file live but only see lines containing "failed". Combine tail -f with another command to do this.'),
  (5, 'Writing a simple shell script',
   'A shell script automates a sequence of commands you''d otherwise type manually. Adding set -e (exit on first error) and checking command exit codes prevents a script from silently continuing after something has already failed.',
   '#!/bin/bash\nset -e\ncp important.txt backup/ makes the whole script stop immediately if the copy fails, instead of continuing as if nothing went wrong.',
   'A backup script currently has no error handling and silently continues even if a step fails. Name the one line you''d add near the top to fix that.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'linux-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- SIEM & Log Analysis Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Why centralize logs',
   'A SIEM aggregates logs from many sources (firewalls, servers, endpoints) into one searchable place, because an attack often leaves partial evidence scattered across systems that only becomes a clear pattern when viewed together.',
   'A failed login on a server and an unusual outbound connection from that same host, seen separately, look unremarkable — correlated in a SIEM within the same time window, they look like a compromise.',
   'Explain why investigating a single server''s logs in isolation could miss an attack that a SIEM correlating multiple sources would catch.'),
  (2, 'Writing a basic search query',
   'A SIEM search filters events by time range, source, and specific field values — the same way a database query filters rows — to narrow millions of events down to the handful relevant to an investigation.',
   'A search for failed logins from a specific IP in the last hour, filtered by event_type=auth_failure AND src_ip=203.0.113.5, narrows a huge log volume to exactly the relevant events.',
   'Write, in plain terms, the filter you''d use to find all failed login attempts against a specific username in the last 15 minutes.'),
  (3, 'True positives vs false positives',
   'A true positive is a real, actionable threat; a false positive looks suspicious but has a benign explanation. Poorly tuned rules generate so many false positives that real alerts get lost in the noise (alert fatigue).',
   'A rule that fires every time an employee logs in from a new coffee shop Wi-Fi generates constant false positives unless tuned to account for normal travel/remote-work patterns.',
   'A detection rule for "login from new location" fires 200 times a day, mostly for legitimate remote workers. Suggest one way to tune it to reduce false positives.'),
  (4, 'Basic correlation rules',
   'A correlation rule fires when a specific combination or sequence of events happens across sources within a time window — catching patterns that no single log line reveals on its own.',
   'A rule firing on "5 failed logins followed by 1 success from the same account within 10 minutes" flags a likely successful brute-force attempt, which no single event alone would indicate.',
   'Describe a correlation rule that would catch someone downloading an unusually large amount of data shortly after an after-hours login.'),
  (5, 'Prioritizing alerts',
   'Alerts should be triaged by severity and the criticality of the affected asset — a low-severity alert on a critical production database deserves more urgent attention than a high-severity alert on an isolated test machine.',
   'A "malware detected" alert on an isolated sandbox VM is lower real-world priority than a lower-confidence alert involving the production customer database.',
   'You have two open alerts: a medium-severity alert on a critical finance server, and a high-severity alert on a decommissioned test machine. Which do you triage first, and why?')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'siem-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Network Security Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Firewalls: stateful vs stateless',
   'A stateful firewall tracks the state of a connection (allow the response to an outbound request automatically); a stateless firewall (packet filter) checks each packet independently against rules, with no memory of prior packets.',
   'A stateful firewall allowing outbound HTTPS automatically permits the return traffic; a stateless filter would need a separate explicit rule for the inbound response.',
   'Explain, in one sentence, why a stateless filter typically needs more explicit rules than a stateful firewall to achieve the same behavior.'),
  (2, 'Network segmentation',
   'Segmentation divides a network into smaller zones (e.g. isolating a guest Wi-Fi from internal servers) so that compromising one segment doesn''t automatically give an attacker access to everything else.',
   'Placing point-of-sale systems on a separate VLAN from general office Wi-Fi means a compromised employee laptop can''t directly reach payment systems.',
   'A company runs its guest Wi-Fi on the same network as internal file servers. Explain the risk and how segmentation would reduce it.'),
  (3, 'IDS vs IPS',
   'An IDS (intrusion detection system) monitors and alerts on suspicious traffic but does not block it; an IPS (intrusion prevention system) sits inline and can actively block traffic matching a detected pattern.',
   'An IDS would alert on a detected exploit attempt for an analyst to review; an IPS could drop that traffic automatically before it reaches the target.',
   'Explain why a team might deliberately choose IDS-only (detect, don''t block) mode for a new rule before switching it to IPS (blocking) mode.'),
  (4, 'What a VPN does and doesn''t protect',
   'A VPN encrypts traffic between your device and the VPN endpoint, protecting it from network-level eavesdropping on that path — but it doesn''t protect against a compromised endpoint, malware already on the device, or a malicious destination.',
   'A VPN protects your traffic from being read on public Wi-Fi, but if your laptop already has malware, the VPN does nothing to stop that malware from exfiltrating data.',
   'Explain why "we use a VPN" is not a complete answer to "is this device secure?"'),
  (5, 'Common network-based attacks',
   'Scanning probes a network to discover live hosts/open ports; spoofing forges a source identity (IP or MAC) to impersonate a trusted party; a man-in-the-middle attack intercepts traffic between two parties who believe they''re talking directly to each other.',
   'ARP spoofing on a local network can let an attacker position themselves as a man-in-the-middle between a victim and the router, intercepting traffic.',
   'A sudden spike in connection attempts to many sequential ports on a single server is most consistent with which type of activity described above?')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'network-security-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Ethical Hacking / Penetration Testing Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'The penetration testing phases',
   'Reconnaissance gathers information about the target; scanning identifies live hosts, ports, and services; exploitation attempts to actually gain access using a discovered weakness; reporting documents findings and remediation for the client.',
   'A tester might spend hours on reconnaissance (public records, DNS, employee info) before ever touching a scanner, because context found there often reveals the easiest path in.',
   'Explain why skipping straight to exploitation without reconnaissance risks missing the actual easiest attack path.'),
  (2, 'Authorization and rules of engagement',
   'A penetration test only happens with explicit written authorization defining scope (which systems), timing, and rules of engagement (what''s off-limits). Testing without this authorization is illegal, regardless of intent.',
   'A signed scope document might explicitly exclude a production payment system from testing, even if it''s technically reachable, to avoid disrupting real transactions.',
   'Explain why a tester finding an interesting vulnerability on a system explicitly marked out-of-scope should not exploit it anyway.'),
  (3, 'Common vulnerability classes',
   'Injection (untrusted input executed as code/query) and broken authentication (weak session/credential handling) are two of the most common, high-impact vulnerability classes found in real assessments.',
   'A login form that inserts raw user input directly into a SQL query without parameterization is vulnerable to SQL injection, letting an attacker manipulate the query itself.',
   'Explain, at a conceptual level (no exploit code), what makes SQL injection possible in a vulnerable application.'),
  (4, 'Vulnerability scan vs full penetration test',
   'An automated vulnerability scan flags potential weaknesses based on signatures/versions, often with false positives; a full penetration test manually validates which findings are actually exploitable and what real impact they''d have.',
   'A scanner might flag an outdated library version as "vulnerable," while a manual test confirms whether that specific vulnerability is actually reachable and exploitable in this deployment.',
   'Explain why a client who only ran an automated scan might still have a false sense of security.'),
  (5, 'Writing an actionable finding',
   'A good finding states what was found, how it was found, the business impact if exploited, and a specific remediation step — not just "system X is vulnerable."',
   '"The login endpoint accepts unlimited password attempts with no lockout, allowing brute-force attacks; recommend adding rate limiting and account lockout after 5 failed attempts" is actionable; "weak login security" is not.',
   'Rewrite this vague finding into an actionable one: "The API has bad error handling."')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'ethical-hacking-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Security Frameworks & Compliance Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Why frameworks matter',
   'A framework gives a shared, auditable structure for security practices instead of ad hoc, undocumented decisions — making it possible to demonstrate to customers, regulators, and auditors that controls are consistent and complete.',
   'Without a framework, two teams might implement wildly different, incompatible logging practices; a framework gives both a shared baseline to be measured against.',
   'Explain, in one sentence, what a security framework provides that "we just do sensible things" does not.'),
  (2, 'NIST CSF structure',
   'NIST CSF organizes security activities into five functions: identify (know your assets/risks), protect (safeguards), detect (monitoring), respond (incident handling), and recover (restore normal operations).',
   'Asset inventory falls under "identify"; access control falls under "protect"; a SIEM alert falls under "detect".',
   'Which NIST CSF function does "restoring a system from backup after an incident" fall under?'),
  (3, 'What ISO 27001 attests to',
   'ISO 27001 certification means an organization has an information security management system (ISMS) — documented policies, risk assessments, and controls — that has been independently audited, not that the org is immune to breaches.',
   'A certified company can still suffer an incident; certification attests that a structured, audited security management process exists, not a guarantee of zero risk.',
   'Explain the difference between "ISO 27001 certified" and "cannot be breached."'),
  (4, 'Control vs policy vs framework',
   'A framework is the overall structure (e.g. NIST CSF); a policy is a written statement of intent (e.g. "passwords must be rotated"); a control is the actual implemented mechanism enforcing that policy (e.g. a password expiration setting in the identity system).',
   'A password policy document is not itself a control — the actual system configuration enforcing password expiration is the control that makes the policy real.',
   'A company has a written policy requiring MFA for all admin accounts, but no technical enforcement exists. Explain the gap.'),
  (5, 'Mapping a finding to a category',
   'When writing up an audit finding, mapping it to the relevant framework category (e.g. "detect" under NIST CSF, or a specific ISO 27001 control) makes the finding auditable and comparable across assessments.',
   'A finding that "failed logins are not monitored" maps to the "detect" function under NIST CSF.',
   'A finding states "no documented incident response plan exists." Which NIST CSF function does this best map to?')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'security-frameworks-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Product Strategy Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Vision vs feature list',
   'A vision describes the future state the product is working toward and why it matters to users; a feature list is just the "what" with no explanation of the underlying bet being made.',
   '"Make small business accounting effortless enough that non-accountants trust it" is a vision; "add invoicing, add expense tracking" is just a feature list with no unifying why.',
   'A roadmap lists ten features with no stated vision. Write one sentence of vision that could plausibly unify them.'),
  (2, 'A basic strategic framework',
   'Evaluating a direction against opportunity size, target market fit, and genuine differentiation (why you, why now) forces a strategy to justify itself beyond "this seems useful."',
   'A feature that''s technically impressive but matches three competitors exactly, with no differentiation, fails the "why you" test even if the opportunity is real.',
   'Apply opportunity/market/differentiation to evaluate: "Should we add a chatbot to our product?"'),
  (3, 'Strategy vs roadmap',
   'Strategy answers why and what problem is worth solving; a roadmap answers when and in what order. Confusing the two turns strategy into just a prioritized to-do list with no reasoning behind it.',
   '"We will win by being the fastest tool for solo freelancers, not teams" is strategy; "Q2: invoicing, Q3: time tracking" is the roadmap that should follow from it.',
   'Given the strategy "win by being the most affordable option for early-stage startups," name one roadmap item this strategy would justify prioritizing.'),
  (4, 'Identifying the core assumption',
   'Every strategy rests on at least one assumption that could turn out false (e.g. "users will pay more for this outcome"). Naming it explicitly lets you validate it cheaply before committing significant resources.',
   'A strategy betting that "users will switch from spreadsheets to our tool" rests on the assumption that spreadsheet pain is severe enough to motivate switching — testable with a handful of user interviews before building anything.',
   'For a strategy of "expand into the enterprise market," name the riskiest assumption it depends on.'),
  (5, 'Saying no to a plausible idea',
   'Not every good idea serves the strategy. A PM''s job includes explicitly declining requests that are reasonable on their own but don''t advance the chosen direction, and explaining why.',
   'A request to add a admin-heavy enterprise feature might be declined for a product strategically focused on solo users, even though the feature itself is reasonable.',
   'A stakeholder requests a solid feature that doesn''t fit your product''s current strategy. Draft one sentence explaining the "no" with the strategic reasoning, not just "we don''t have time."')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'product-strategy-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Product Roadmapping Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Roadmap vs project plan',
   'A roadmap communicates direction and relative priority over time; a Gantt-style project plan commits to specific dates and dependencies. Presenting a roadmap as if it were a delivery guarantee sets an expectation it can''t reliably keep.',
   'A roadmap might show "Q2: improve onboarding" as a theme, while the actual project plan behind it has week-by-week engineering tasks and dates.',
   'Explain, in one sentence, why a roadmap with hard calendar dates for every item tends to damage stakeholder trust over time.'),
  (2, 'Prioritization frameworks',
   'A framework like RICE (reach, impact, confidence, effort) or a simple value-vs-effort grid gives a consistent, explainable basis for sequencing work, rather than whoever asked most recently or loudest.',
   'Two feature requests with similar impact but very different effort (one week vs three months) get sequenced differently under a value-vs-effort framework, with a clear reason to show stakeholders.',
   'Using value vs effort, which would you prioritize first: a high-value, high-effort feature, or a medium-value, low-effort one? Explain your reasoning.'),
  (3, 'Communicating by theme, not just features',
   'Presenting a roadmap as outcomes/themes ("improve first-week retention") rather than a flat feature list gives stakeholders the reasoning, and gives the team flexibility in how they achieve the outcome.',
   '"Reduce time-to-first-value for new users" as a theme allows several possible features to satisfy it, versus locking in one specific feature name months in advance.',
   'Rewrite this feature-only roadmap item as an outcome/theme: "Add a product tour."'),
  (4, 'Handling an off-roadmap request',
   'A request that doesn''t fit the current roadmap deserves an explanation tied to priority and strategy, plus a clear path (backlog, future consideration) rather than a flat "no" with no reasoning.',
   '"This is a reasonable request, but it doesn''t serve this quarter''s theme of onboarding — I''ll log it for next quarter''s planning" respects both the request and the current focus.',
   'A sales team requests a custom feature for one client outside the current roadmap theme. Draft a one-sentence response that respects the request without derailing the roadmap.'),
  (5, 'Re-sequencing without losing trust',
   'When new evidence changes priorities, communicate what changed and why clearly and early, rather than silently reshuffling the roadmap — the reasoning, not the stability, is what maintains stakeholder trust.',
   '"Usage data showed the feature we planned for Q3 matters far less than expected, so we''re moving X up instead — here''s the data" preserves trust even though the plan changed.',
   'A previously high-priority roadmap item turns out to be far less impactful based on new user research. Draft the one-sentence update you''d send stakeholders.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'roadmapping-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- User Research Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Generative vs evaluative research',
   'Generative research explores an open problem space before a solution exists ("what do users struggle with?"); evaluative research tests a specific existing solution ("does this design work?"). Using the wrong one wastes both time and the participant''s input.',
   'Interviewing users about their current invoicing frustrations (before designing anything) is generative; watching users try a specific invoicing prototype is evaluative.',
   'You have a rough idea for a new feature but no design yet. Should your next research step be generative or evaluative? Why?'),
  (2, 'Writing unbiased questions',
   'A leading question ("wouldn''t it be easier if...") signals the answer you want and produces agreeable, unreliable responses. Neutral, open-ended questions ("walk me through how you currently...") surface the participant''s real experience.',
   '"How do you currently handle X?" surfaces real behavior; "don''t you think our new approach to X would help?" just invites polite agreement.',
   'Rewrite this leading interview question neutrally: "Wouldn''t it be great if you could filter results instantly?"'),
  (3, 'Running a usability test',
   'Give a participant a realistic task, not instructions on how to complete it, and watch where they hesitate, backtrack, or fail — that friction is the signal, more useful than what they say afterward about liking it.',
   'A participant repeatedly clicking the wrong element while trying to complete a task reveals a real usability problem, even if they later say "it was fine" out of politeness.',
   'A participant struggled for 30 seconds before finding the "save" button during a test, but said the experience felt "pretty smooth" afterward. Which signal should you trust more, and why?'),
  (4, 'Synthesizing themes, not quotes',
   'Good synthesis groups similar observations across multiple participants into a theme with supporting evidence, rather than presenting a handful of vivid individual quotes as if they represent everyone.',
   '"4 of 6 participants got confused at the same step" is a theme with evidence; a single dramatic quote from one participant, presented alone, might just be an outlier.',
   'Two of five interviewees mentioned pricing confusion in passing. Is that enough to call it a "theme"? What would you want to see before concluding it is?'),
  (5, 'Recruiting a representative sample',
   'Recruiting whoever is easiest to reach (colleagues, friends, existing power users) tends to produce a sample that doesn''t represent the actual target user, biasing every finding that follows.',
   'Testing a first-time-user onboarding flow only with existing power users who already know the product misses exactly the confusion new users would hit.',
   'You''re testing a new-user onboarding flow but the easiest people to recruit are your own coworkers who already know the product well. Explain the bias this introduces.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'user-research-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Agile & Scrum Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Core Scrum roles, events, and artifacts',
   'Scrum defines three roles (product owner, scrum master, development team), a set of events (sprint planning, daily standup, review, retrospective), and artifacts (product backlog, sprint backlog, increment) that structure iterative delivery.',
   'The product owner owns the backlog and priority; the scrum master removes blockers and protects the process; the team delivers the work — each role has a distinct, non-overlapping responsibility.',
   'A team has no one clearly responsible for prioritizing the backlog. Which Scrum role is missing, and what problem does that cause?'),
  (2, 'Writing a clear user story',
   'A good user story states who the user is, what they want, and why, plus specific acceptance criteria defining what "done" means — without acceptance criteria, "done" is a matter of opinion.',
   '"As a returning customer, I want my saved payment method pre-filled, so checkout is faster" with acceptance criteria like "saved card shows masked; user can still change it before submitting" removes ambiguity.',
   'Write acceptance criteria for this story: "As a user, I want to reset my forgotten password."'),
  (3, 'The purpose of a retrospective',
   'A retrospective looks back at how the team worked (not just what was built) to find specific, actionable process improvements — it''s not a status update and not a venting session with no follow-through.',
   'A retro that ends with "we''ll try limiting work-in-progress to 2 items next sprint" produces a concrete change; one that ends with only "communication could be better" produces nothing actionable.',
   'A retrospective just produced the note "communication needs to improve." Rewrite it as one specific, actionable experiment for the next sprint.'),
  (4, 'Velocity: planning tool, not performance metric',
   'Velocity (story points completed per sprint) helps a team forecast its own future capacity. Using it to compare or rank different teams, or individuals within a team, distorts estimation and damages trust.',
   'Comparing "Team A did 40 points, Team B did 25" as if B underperformed ignores that points are relative and team-specific, not a standardized productivity unit.',
   'A manager wants to rank two teams by velocity to decide who gets a bonus. Explain why this misuses the metric.'),
  (5, 'When Kanban fits better than Scrum',
   'Scrum''s fixed sprints fit planned, batched work well; Kanban''s continuous flow (with WIP limits, no fixed iteration) fits unpredictable, interrupt-driven work like support or maintenance better.',
   'A support team fielding unpredictable incoming tickets fits Kanban''s continuous pull model far better than forcing tickets into two-week sprint boxes.',
   'A team handles unpredictable production support requests that can''t be scheduled two weeks in advance. Would Scrum or Kanban fit better, and why?')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'agile-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Stakeholder Management Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Mapping stakeholders by influence and interest',
   'Not every stakeholder deserves equal time. Mapping people by how much influence they have over the outcome and how much interest they take in it tells you where to actually invest communication effort.',
   'A VP with high influence but low day-to-day interest needs concise, infrequent high-level updates; a peer engineering lead with high interest and involvement needs much more frequent detail.',
   'You have limited time this week. Between a highly interested individual contributor and a low-interest but highly influential VP, how would you split your stakeholder communication effort, and why?'),
  (2, 'Communicating a decision with reasoning',
   'Announcing only the outcome of a decision ("we''re not doing X") without the reasoning behind it reads as arbitrary, even when the decision itself was right — the reasoning is what builds or preserves trust.',
   '"We''re deprioritizing X because usage data showed it would only help 2% of users, versus Y which addresses the top reported complaint" preserves trust even when the news is disappointing.',
   'Rewrite this decision announcement to include reasoning: "We''re not building the custom export feature this quarter."'),
  (3, 'Handling conflicting priorities',
   'When two stakeholders want different things, resolve it against a consistent standard (strategy, data, prioritization framework) rather than whoever has the most positional power or was loudest most recently.',
   'When sales wants a custom feature and engineering wants to pay down technical debt, referencing the quarter''s stated strategic theme (not just seniority) gives both sides a shared basis for the decision.',
   'Sales and engineering both want their priority handled first this sprint, with no clear tiebreaker. Propose one neutral standard you''d use to decide.'),
  (4, 'Setting expectations proactively',
   'Surfacing likely risks, delays, or tradeoffs before they become a surprise (rather than only when someone asks or escalates) is what keeps stakeholders from being blindsided and losing trust.',
   'A PM who flags "this is now at risk of slipping a week due to a dependency" as soon as it''s known avoids the much worse conversation of explaining a surprise miss on the deadline itself.',
   'You learn today that a committed deliverable will likely slip by a week. Draft the one-sentence proactive update you''d send now, rather than waiting until the deadline passes.'),
  (5, 'Giving difficult feedback across teams',
   'Feedback to someone outside your direct authority (an engineer, a designer, another PM) needs to be specific, tied to impact, and delivered privately and early — not saved up, and not delivered publicly.',
   '"The last two estimates were off by 3x, which is making it hard for me to set expectations with leadership — can we talk through what''s driving that?" is specific and actionable; "your estimates are bad" is not.',
   'An engineering lead''s estimates have been consistently inaccurate, affecting your roadmap commitments. Draft the opening line of a private, specific, non-accusatory conversation about it.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'stakeholder-management-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Product Analytics Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'North star and input metrics',
   'A north star metric captures the core value the product delivers; input metrics are the specific, actionable levers a team can move that (in theory) drive the north star, connecting day-to-day work to the bigger outcome.',
   'A north star of "weekly active collaborative documents" might be driven by input metrics like invite acceptance rate and first-week document creation rate.',
   'For a fitness app, propose a plausible north star metric and one input metric that would drive it.'),
  (2, 'Reading a funnel correctly',
   'A funnel shows the percentage of users completing each step of a process in sequence. The biggest percentage-point drop identifies where to focus, but always segment before concluding a single fix will address it for everyone.',
   'A signup-to-activation funnel dropping most sharply between "account created" and "first project created" points investigation at that specific step, not the whole flow equally.',
   'A funnel shows a large drop-off between step 2 and step 3. What''s your next move before concluding what the fix should be?'),
  (3, 'Activation vs retention metrics',
   'Activation measures whether a new user reached a meaningful first value moment; retention measures whether users keep coming back over time. A product can have great activation and still fail on retention, or vice versa.',
   'A high percentage of new users completing onboarding (activation) but few returning a week later (poor retention) suggests the first-use experience is fine but ongoing value isn''t sticking.',
   'A product shows 80% of new users complete onboarding, but only 15% return after week one. Which metric points to the real problem, and what would you investigate next?'),
  (4, 'Designing a basic A/B test',
   'A trustworthy A/B test needs random assignment, a clear success metric decided in advance, and a large enough sample run for long enough to detect the effect size you actually care about — not stopped early the moment it looks good.',
   'Stopping a test the moment it shows a promising result after only 2 days, instead of the pre-planned 2 weeks, risks acting on noise rather than a real effect.',
   'A test shows a 3% lift after only 200 users and one day. Should you ship it yet? What would you want to see first?'),
  (5, 'Common metric traps',
   'Vanity metrics look impressive but don''t connect to real value (total signups vs active users); Simpson''s paradox can make an aggregate trend reverse direction when segmented; survivorship bias means only looking at users who stayed, ignoring those who churned.',
   'Overall conversion rate might look flat, while it''s actually improving in every individual segment — a classic Simpson''s paradox caused by a shifting mix of segments.',
   'A dashboard proudly reports "total signups are up 40%," while active usage is flat. Explain why total signups alone is a vanity metric here.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'product-analytics-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- UI Design Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Type hierarchy and spacing scale',
   'A small set of consistent font sizes/weights (not a dozen ad hoc ones) and a consistent spacing scale (like Tailwind''s 4/8/12/16px steps) is what makes an interface feel intentional rather than randomly assembled.',
   'Using exactly 3 font sizes (heading, body, caption) consistently across a whole product reads as more polished than a page with 8 slightly different, similar-but-not-identical sizes.',
   'A screen uses five slightly different font sizes for what are conceptually only two levels of information (heading and body). What would you consolidate this to?'),
  (2, 'Using color with intention',
   'Reserve a strong accent color for primary actions so it stands out; use it sparingly elsewhere. Ensure text-on-background combinations meet contrast guidelines, especially for smaller text.',
   'If blue is the "primary action" color, using that same blue for five unrelated decorative elements dilutes its meaning as a signal for "click here."',
   'A page has a blue "Submit" button and also uses the identical blue for a decorative header underline. Explain the problem this causes for the button''s clarity.'),
  (3, 'Consistent, reusable components',
   'Designing one button component with defined variants (primary, secondary, destructive) and states (default, hover, disabled) prevents the drift that happens when every screen invents its own slightly different button.',
   'A design file with 12 slightly different-looking buttons across different screens signals no shared component was used, causing implementation inconsistency and extra engineering work.',
   'You notice three different border-radius values used for buttons across a mockup. What would you do before handing this off to engineering?'),
  (4, 'Visual hierarchy',
   'Size, weight, color, and spacing should clearly communicate what''s most important on a screen. If every element competes for attention equally, users don''t know where to look first.',
   'A checkout screen with the "Place Order" button the same visual weight as a "Save for later" link makes it unclear which action the business actually wants the user to take.',
   'A screen has a primary action, a secondary action, and a destructive action (like "delete"), all styled identically. Describe how you''d visually differentiate the three.'),
  (5, 'Designing non-happy-path states',
   'Every screen needs an explicit empty state (no data yet), loading state (data in flight), and error state (something failed) — designed with the same care as the happy path, not left as a blank engineering guess.',
   'A dashboard with no data yet showing a helpful "create your first project" prompt (rather than a blank empty table) turns a dead end into a clear next step.',
   'A list screen currently has a design only for "has data." Name the two other states it''s missing and what each should communicate to the user.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'ui-design-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- UX Design Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Mapping the flow before designing screens',
   'Sketching the full sequence of steps a user takes (including branches, errors, and exits) before designing any visuals reveals dead ends or missing states that are far more expensive to fix after high-fidelity design has started.',
   'Mapping a checkout flow first reveals a missing "payment failed, try again" branch that would otherwise be discovered only after engineering had already built the happy path.',
   'You''re about to design a password reset flow. Name two branches (besides the happy path) you should map out first.'),
  (2, 'Information architecture users can predict',
   'Organize navigation around how users think about their own tasks (mental model), not around internal team or org structure — the latter forces users to learn your company chart just to find something.',
   'A settings menu organized around "Billing," "Notifications," and "Security" (user tasks) is far more findable than one organized around internal team names like "Platform Team Settings."',
   'A settings menu is currently organized by which internal engineering team owns each feature. Propose a reorganization based on user tasks instead.'),
  (3, 'Core usability heuristics',
   'Give clear feedback after every action, stay consistent with patterns users already learned elsewhere in the product, and prevent errors before they happen rather than only handling them after.',
   'Disabling a "Submit" button and showing a spinner after a click gives immediate feedback that the action registered, instead of leaving the user unsure if their click worked.',
   'A form silently accepts a submit click with zero visual change for 3 seconds while a request completes. What heuristic is being violated, and what''s the fix?'),
  (4, 'Designing for error prevention and recovery',
   'Prevent likely errors where possible (disable an invalid combination rather than letting it be submitted), and when an error does happen, explain clearly what went wrong and exactly how to fix it.',
   '"Passwords must match" shown live as someone types the confirmation field prevents the error before submission, rather than only showing it after a failed submit.',
   'A form only shows "Error: invalid input" after submission, with no indication of which field or what was wrong. Rewrite this as a more helpful error message.'),
  (5, 'Minimizing steps without losing context',
   'Removing unnecessary steps speeds up a flow, but removing steps that give users needed confidence or context (like an order review before final purchase) can backfire, causing more errors or hesitation than it saves.',
   'Combining shipping and payment into one screen might reduce steps, but removing the final order-review step before "Place Order" could increase costly mistaken purchases.',
   'A checkout flow currently has 5 steps. Propose which step you would consider removing, and one you would deliberately keep even though it adds a step.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'ux-design-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Prototyping Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Choosing the right fidelity',
   'Low-fidelity (paper, wireframes) is fast and cheap for testing a concept or flow; high-fidelity (polished, on-brand) is right for testing specific visual/interaction details once the concept is validated. Mismatching fidelity to the question wastes effort or misleads feedback.',
   'Testing whether users understand a brand-new concept with a polished, pixel-perfect prototype risks participants reacting to visual polish rather than the underlying idea.',
   'You want early feedback on whether a completely new feature concept makes sense at all. Would you build a low- or high-fidelity prototype first, and why?'),
  (2, 'Building a clickable, linked prototype',
   'Every plausible click a test participant might make along the primary flow needs to actually go somewhere — an unlinked element breaks the illusion and derails the test the moment someone clicks it.',
   'If a "back" button is left unlinked, a participant clicking it during a test hits a dead end that has nothing to do with the actual thing being tested.',
   'You''re prototyping a 4-screen signup flow. Besides "next" on each screen, name one other clickable element you''d need to link for the test to hold up.'),
  (3, 'Interactive components: variants and states',
   'Using a component''s built-in variants and states (hover, pressed, disabled) instead of duplicating static frames lets a prototype actually respond like the real interface, not just look like it.',
   'A single button component with a "disabled" variant, swapped in when a form is invalid, feels far more real to a test participant than a static frame with no interaction.',
   'A prototype currently shows a button as always "active," even before required fields are filled. What would make this feel more realistic?'),
  (4, 'Realistic content for testing',
   'Placeholder Lorem Ipsum text hides real problems: long names that wrap awkwardly, empty states, or numbers with more digits than expected. Testing with realistic (even messy) content surfaces issues that clean fake content hides.',
   'A prototype tested only with short, tidy fake names ("Jane Doe") might hide a layout break that occurs with a long real name that wraps to two lines.',
   'A prototype for a user profile card only uses the name "Alex Kim" in every test. What''s one more realistic (and harder) name/content example you''d want to test with instead?'),
  (5, 'Knowing when a prototype is "good enough"',
   'A prototype is ready to test once it can support the specific question you''re trying to answer — polishing it further beyond that point mostly costs time without adding useful signal.',
   'If the goal is testing navigation findability, spending days perfecting exact color values before testing delays learning something more urgent and doesn''t change the answer to that question.',
   'Your goal this week is testing whether users can find the "export" feature at all. Would refining exact icon pixel alignment be a good use of remaining time before testing? Why or why not?')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'prototyping-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Design Systems Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'What belongs in a design system',
   'A design system holds the reusable, shared building blocks (tokens, components, patterns) meant to be used across many products/screens — a one-off layout for a single unusual page generally does not belong in it.',
   'A shared "Button" component with defined variants belongs in the system; a highly custom, one-time promotional landing page layout generally does not.',
   'A team wants to add a highly specific, one-off animation used only on a single marketing page to the shared design system. Should it go in the system? Why or why not?'),
  (2, 'Design tokens',
   'Tokens are named values (a specific blue, a specific spacing unit) referenced by name everywhere instead of hardcoded, so a single token update (e.g. rebranding the primary color) propagates everywhere automatically.',
   'A token named color-primary-600 used across 40 components means a rebrand only requires updating that one token value, not 40 separate hardcoded hex codes.',
   'Explain what breaks (or what extra work is required) if every component hardcodes its own hex color instead of referencing a shared token.'),
  (3, 'Documenting a component fully',
   'A component''s documentation should cover every meaningful variant (primary/secondary/destructive) and every state (default/hover/focus/disabled/loading), not just its default appearance — otherwise engineers guess the missing states.',
   'Documenting a "Button" component''s primary variant but leaving its disabled state undocumented means every engineer implementing it guesses that state differently.',
   'A design system''s "Input" component is documented only in its default state. Name two other states it should document.'),
  (4, 'Governance: who can change a shared component',
   'A design system needs a clear process (review, ownership) for who can add or modify shared components — without it, uncoordinated changes silently break consistency across every product using that component.',
   'Allowing any team to directly edit the shared "Card" component with no review means one team''s change could unintentionally break another team''s layout that depends on the same component.',
   'Propose a lightweight review process for approving changes to a shared component used across five different product teams.'),
  (5, 'Recognizing when a one-off should become a pattern',
   'When a similar custom solution starts appearing independently on multiple screens/teams, that''s the signal it should be formalized into the design system instead of continuing to be quietly duplicated with small inconsistencies.',
   'If three different teams have each independently built a slightly different "empty state" illustration and layout, that''s a strong signal to formalize one shared empty-state pattern.',
   'You notice three teams have each built their own slightly different "confirmation modal." What would you propose doing about it?')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'design-systems-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Workplace Communication Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Lead with the conclusion',
   'Busy stakeholders need the recommendation or headline first, with supporting detail available for those who want to dig in — burying the conclusion at the end of a long walkthrough loses most of the audience before they get there.',
   '"Recommend we revert the checkout redesign — conversion dropped 8%, concentrated on mobile" up front, with the methodology below for anyone who wants it, respects the reader''s time.',
   'Rewrite this so the conclusion comes first: "We looked at the data across three weeks, controlled for seasonality, checked mobile vs desktop separately, and found that conversion is down 8% since the redesign, so we recommend reverting it."'),
  (2, 'Adjusting technical depth to the audience',
   'An executive summary needs the implication and recommendation in plain language; a peer technical review can include the methodology, caveats, and edge cases the executive doesn''t need.',
   'An executive update says "the new pricing page is losing us customers — recommend reverting"; a peer review of the same finding includes the specific statistical test used and its assumptions.',
   'You need to explain a data finding to both your engineering peers and a non-technical VP. Name one thing you''d include for the peers but leave out for the VP.'),
  (3, 'Giving specific, actionable feedback',
   'Feedback that names the specific behavior/artifact and the concrete change requested is usable; vague feedback ("this doesn''t feel right") gives the recipient nothing to actually act on.',
   '"The error message on line 42 doesn''t tell the user what field is wrong — can you name the specific field?" is actionable; "the error handling isn''t great" is not.',
   'Rewrite this vague feedback into something specific and actionable: "This report is kind of confusing."'),
  (4, 'Writing a concise status update',
   'A good status update answers three things quickly: what''s done, what''s at risk, and what (if anything) is needed from the reader — not a full chronological narrative of everything that happened.',
   '"On track. One risk: waiting on design review, need a decision by Friday to stay on schedule" is more useful than a long paragraph describing every meeting held this week.',
   'Write a 2-sentence status update for a project that''s mostly on track but blocked waiting on another team''s API to be ready.'),
  (5, 'Asking a clarifying question',
   'When a requirement is ambiguous, asking one focused clarifying question up front is far cheaper than building the wrong thing and discovering the mismatch after the work is done.',
   '"When you say ''faster,'' do you mean the page load time, or the number of clicks to complete the task?" prevents building the wrong kind of "faster."',
   'A stakeholder asks for "a simpler dashboard" with no further detail. Write the one clarifying question you''d ask before starting.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'communication-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Analytical Problem Solving Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Breaking an ambiguous problem into sub-questions',
   'An open-ended problem ("users are churning") is easier to solve once split into smaller, individually testable questions (which segment? which point in their journey? what changed recently?) than tackled all at once.',
   '"Users are churning" becomes "Is churn concentrated in a specific plan tier, and did it start after a specific release?" — a question you can actually check against data.',
   'Break "our app is slow" into two or three smaller, individually testable sub-questions.'),
  (2, 'Forming a hypothesis before investigating',
   'Stating a specific, checkable guess before diving into data or code gives the investigation a clear target and a clear stopping point, instead of open-ended, unfocused exploration.',
   '"I think the slowdown started after last week''s deploy" is a checkable hypothesis; "let''s look at everything and see what we find" has no natural stopping point.',
   'Before investigating a sudden spike in customer support tickets, write one specific, checkable hypothesis for what might have caused it.'),
  (3, 'Root-cause techniques',
   'A structured technique like "5 whys" (repeatedly asking why a symptom occurs) pushes past the first, surface-level explanation toward the actual underlying cause, which is what needs fixing to prevent recurrence.',
   '"The page crashed" -> why? "out of memory" -> why? "a loop kept adding to an array without limit" -> why? "no cap was ever added to that loop" — the real fix is the missing cap, not just restarting the server.',
   'Apply one round of "why" to this symptom: "The weekly report email didn''t send this morning." What''s the next-level question you''d ask?'),
  (4, 'Symptom vs root cause',
   'Fixing the visible symptom (restarting a crashed service) without addressing what actually caused it (a memory leak) means the same problem recurs — often at a worse time.',
   'Restarting a server that keeps running out of memory "fixes" the immediate outage but not the underlying leak that will cause it to happen again.',
   'A support team keeps manually re-sending failed emails every day. What''s the symptom here, and what''s one plausible root cause worth investigating instead?'),
  (5, 'Knowing when to stop and communicate',
   'Given real time constraints, a reasonable, clearly-caveated answer delivered now is often more useful than a more complete answer delivered too late to inform the decision it was meant to support.',
   '"Based on the data available so far, it looks like mobile is the bigger driver, though I haven''t yet ruled out a seasonal effect" is a useful, honest answer under a deadline, rather than delaying until every angle is checked.',
   'You have one hour before a decision meeting and haven''t finished a full analysis. Draft the one caveated sentence you''d share instead of waiting for a fully complete answer.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'problem-solving-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;
