-- Lessons for the 12 topics seeded in 20260826010000_seed_learning_content_batch2.sql

-- Python Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Core data types',
   'Python''s everyday building blocks are strings (text), numbers (int/float), lists (ordered, mutable collections), tuples (ordered, immutable), dicts (key-value maps) and sets (unique, unordered values). Picking the right one matters: a dict gives O(1) lookup by key, a list is right for ordered sequences, a set is right when you only care about membership and uniqueness.',
   'user = {"name": "Amara", "age": 29} is a dict — you look someone up by key, not position. scores = [88, 91, 76] is a list — order and duplicates matter.',
   'Given a list of email addresses with duplicates, write the Python expression that returns only the unique ones.'),
  (2, 'Functions and default arguments',
   'A function groups reusable logic behind a name. Parameters can have default values, letting callers omit arguments they don''t need to override. Functions should generally do one thing and return a value rather than relying on side effects, which makes them far easier to test.',
   'def greet(name, greeting="Hello"): return f"{greeting}, {name}!" — greet("Amara") returns "Hello, Amara!", but greet("Amara", "Hi") overrides the default.',
   'Write a function `discount_price(price, percent=10)` that returns the price after applying a percentage discount.'),
  (3, 'Loops and comprehensions',
   'A for loop iterates over any iterable (list, dict, string, range). A list comprehension is a compact way to build a new list by transforming or filtering another iterable in a single readable line, and is usually preferred over a manual loop with .append() for simple transformations.',
   '[x * 2 for x in [1, 2, 3]] returns [2, 4, 6]. [x for x in scores if x >= 80] returns only the passing scores.',
   'Write a comprehension that takes a list of words and returns only the ones longer than 5 characters, in uppercase.'),
  (4, 'Mutability and aliasing',
   'Lists, dicts and sets are mutable — assigning a second variable to the same list doesn''t copy it, it creates a second name pointing at the same object, so mutating through one variable affects the other. Strings, tuples, and numbers are immutable, so this surprise doesn''t apply to them.',
   'a = [1, 2, 3]; b = a; b.append(4) — now a is also [1, 2, 3, 4], because a and b point to the same list. b = a.copy() would avoid this.',
   'Explain, in your own words, why `def add_item(item, bucket=[]): bucket.append(item); return bucket` is a classic Python bug when called multiple times.'),
  (5, 'Handling errors with try/except',
   'try/except lets a program handle an expected failure (a missing file, invalid input, a failed network call) without crashing. Catch the specific exception type you expect (e.g. ValueError, KeyError) rather than a bare except, so you don''t accidentally hide bugs unrelated to the problem you''re handling.',
   'try:\n    age = int(user_input)\nexcept ValueError:\n    print("Please enter a number") — this handles bad input specifically, without hiding other unrelated bugs.',
   'Write a function that safely divides two numbers and returns None (instead of crashing) if the divisor is zero.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'python-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Statistics Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Mean, median and mode',
   'The mean (average) is sensitive to extreme values (outliers); the median (middle value) is not. The mode is the most frequent value, useful for categorical data. For skewed data — like income or house prices — the median usually represents "typical" better than the mean.',
   'Salaries of $40k, $42k, $45k, $48k and $400k have a mean around $115k, which misrepresents the group — the median ($45k) is far more representative.',
   'Given the dataset [3, 4, 4, 5, 100], calculate the mean and median by hand and explain which better represents the "typical" value.'),
  (2, 'Spread: variance and standard deviation',
   'Variance measures how far values are, on average, from the mean (squared, so it is always positive). Standard deviation is the square root of variance, expressed in the same units as the original data, which makes it easier to interpret directly — e.g. "test scores had a standard deviation of 8 points."',
   'Two classes could have the same average test score of 75, but one has a standard deviation of 2 (everyone scored similarly) and the other has a standard deviation of 20 (scores varied wildly) — the average alone hides that difference.',
   'Explain in one sentence why reporting only the average without any measure of spread can be misleading to a decision-maker.'),
  (3, 'What a p-value actually means',
   'A p-value is the probability of seeing a result at least this extreme if there truly were no effect (the null hypothesis is true). A small p-value (commonly < 0.05) is evidence against the null hypothesis, but it does not tell you the size of the effect, and it does not mean there is a large probability the null hypothesis is false.',
   'A drug trial can produce a statistically significant (p < 0.05) but practically tiny effect — e.g. lowering blood pressure by 0.1 mmHg — significance alone doesn''t mean the result matters in practice.',
   'A colleague says "p = 0.03, so there''s a 97% chance our hypothesis is true." Explain what is wrong with that statement.'),
  (4, 'Correlation vs causation',
   'Two variables can move together (correlate) without one causing the other — a third, unmeasured variable (a confounder) may be driving both. Establishing causation generally needs a controlled experiment (e.g. an A/B test) or careful statistical control for confounders, not just an observed correlation.',
   'Ice cream sales and drowning incidents both rise in summer, and correlate — but ice cream doesn''t cause drownings; hot weather (the confounder) drives both.',
   'Give one other example of two variables that likely correlate due to a shared confounder rather than a direct causal link.'),
  (5, 'Sampling and sample size',
   'A sample is a subset used to estimate something about the full population. Small or biased samples produce unreliable estimates with wide margins of error, and a sample that isn''t randomly selected can be systematically skewed no matter how large it is.',
   'Surveying 20 visitors to a single store about "customer satisfaction nationwide" is a small, non-random sample and shouldn''t be generalized to all customers.',
   'A dashboard reports "68% of users love the new feature" based on 12 survey responses out of 50,000 active users. Write one sentence flagging the statistical problem with this claim.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'statistics-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Excel for Analysts
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Core formulas',
   'SUM, AVERAGE and COUNT handle basic aggregation. IF branches on a condition. COUNTIFS/SUMIFS aggregate with one or more conditions, which covers the majority of everyday analyst requests ("total sales where region = West and month = March").',
   '=SUMIFS(Sales, Region, "West", Month, "March") totals the Sales column only for rows where Region is West and Month is March.',
   'Write the formula that counts how many rows in a "Status" column equal "Completed" AND a "Priority" column equals "High".'),
  (2, 'Lookups: VLOOKUP, XLOOKUP, INDEX/MATCH',
   'VLOOKUP finds a value in the leftmost column of a range and returns a value from a column to its right — it cannot look left. XLOOKUP (newer) fixes this and is more flexible. INDEX/MATCH is the classic workaround in older Excel versions and still widely used.',
   '=XLOOKUP(A2, ProductID, ProductName) returns the product name for the ID in A2, regardless of column order — something classic VLOOKUP can''t do if ProductName is to the left of ProductID.',
   'You need to look up an employee''s department from a table where "Department" is to the LEFT of "EmployeeID". Explain why VLOOKUP alone can''t do this directly, and which formula can.'),
  (3, 'PivotTables',
   'A PivotTable summarizes a large dataset without formulas — drag a field to Rows/Columns to group by it, and a field to Values to aggregate it (sum, count, average). It is the fastest way to answer "totals by category" questions on messy raw data.',
   'Dragging "Region" to Rows and "Revenue" to Values instantly gives total revenue per region, without writing a single SUMIF formula.',
   'Describe, step by step, how you''d build a PivotTable to show total sales by month and by product category.'),
  (4, 'Cleaning messy data',
   'Real data is rarely clean: extra whitespace, inconsistent capitalization, text stored as numbers. TRIM removes extra spaces, PROPER/UPPER/LOWER fix casing, and Find & Replace or Text-to-Columns fix formatting issues in bulk, rather than editing cell by cell.',
   '=TRIM(A2) removes leading/trailing/extra spaces from "  New York  ", so it matches other "New York" entries in a lookup instead of silently failing to match.',
   'A "Status" column has values "active", "Active", " active" mixed together. Describe how you''d normalize them all to a single consistent value.'),
  (5, 'Reference types and common mistakes',
   'A relative reference (A1) shifts when copied to other cells; an absolute reference ($A$1) stays fixed. Forgetting to lock a reference is the single most common cause of "my formula gives different wrong numbers in every row" bugs.',
   '=A2*$B$1 can be copied down an entire column and always multiply by the same fixed rate in B1, while A2 correctly shifts to A3, A4, etc.',
   'You copy a formula referencing a fixed tax rate down 100 rows and every row shows a different, wrong tax rate. Explain the likely cause and the fix.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'excel-for-analysts'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Data Visualization Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Choosing the right chart',
   'Match the chart to the question. Comparing categories: bar chart. Trend over time: line chart. Distribution of one variable: histogram. Relationship between two numeric variables: scatter plot. Part-to-whole with very few categories: pie chart (and only then).',
   'Comparing revenue across 8 regions is a bar chart question; showing how that same total revenue changed month over month is a line chart question — the same data can need two different charts depending on what''s being asked.',
   'You want to show how website signups changed week over week for the last year. Name the chart type and explain why.'),
  (2, 'Avoiding misleading charts',
   'A truncated y-axis (not starting at zero) can make a 2% difference look like a 200% difference. 3D charts distort area/perspective and make values harder to compare accurately. Both are common ways charts unintentionally (or intentionally) mislead.',
   'A bar chart with a y-axis starting at 90 instead of 0 can make a change from 91 to 93 units look like a threefold increase, when it''s actually about 2%.',
   'Look at any bar chart you have handy (or picture one) and check: does its y-axis start at zero? If not, what impression does that create?'),
  (3, 'Using color with purpose',
   'Color should encode meaning (a category, a status, a highlight), not decoration. Using one accent color to draw attention to the single most important series, and neutral gray for the rest, communicates more clearly than a rainbow of equally-saturated colors.',
   'Highlighting "this quarter" in a bold color and all prior quarters in light gray draws the eye to what matters, instead of a chart where every bar competes for attention.',
   'You have a bar chart with 12 bars, one per month. Describe a color scheme that highlights only the current month.'),
  (4, 'Designing for your audience',
   'An executive needs one clear takeaway and minimal detail; an analyst reviewing your work wants to see the underlying breakdown and be able to verify it. The same data may need two different visual treatments depending on who is looking at it.',
   'A one-slide executive chart might show a single trend line with an annotation ("Revenue up 12% since launch"), while the analyst-facing version shows the same trend broken out by product line with a data table beneath it.',
   'You need to present the same churn-rate finding to a VP and to your own analytics team. Describe how the two versions of the chart would differ.'),
  (5, 'Labeling so a chart stands alone',
   'A chart should be understandable without you standing next to it explaining it: title stating the finding (not just the metric name), labeled axes with units, and a legend if there is more than one series.',
   '"Revenue grew steadily through Q3" is a better chart title than just "Revenue," because it states the takeaway rather than making the reader find it themselves.',
   'Rewrite the generic chart title "Sales Data" into a title that states an actual finding, using a hypothetical trend of your choosing.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'data-visualization-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- React Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Components and props',
   'A React component is a function that returns UI. Props are read-only inputs passed from a parent to a child, similar to function arguments. Data flows one way: parent to child. A child cannot directly change a prop it receives — it can only ask the parent to change it.',
   'function Greeting({ name }) { return <h1>Hello, {name}</h1>; } — <Greeting name="Amara" /> renders "Hello, Amara", with "Amara" flowing down from parent to child as a prop.',
   'Sketch (in words or pseudo-JSX) a `ProductCard` component that receives `title`, `price` and `imageUrl` as props.'),
  (2, 'State with useState',
   'State is data a component owns and can change over time, causing it to re-render when updated. useState(initialValue) returns the current value and a setter function; calling the setter schedules a re-render with the new value — you never mutate state directly.',
   'const [count, setCount] = useState(0); <button onClick={() => setCount(count + 1)}>{count}</button> — clicking increments and re-renders the displayed count.',
   'Describe how you''d implement a toggle button that switches between "Show" and "Hide" text using useState.'),
  (3, 'Effects and cleanup',
   'useEffect runs code after render — for things React itself doesn''t handle, like subscribing to an event, starting a timer, or fetching data. If an effect sets something up (a subscription, an interval), its cleanup function (the returned function) must tear it down, or it leaks every time the component re-renders or unmounts.',
   'useEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); }, []) — the returned function clears the interval when the component unmounts, preventing a leaked timer.',
   'Explain what would go wrong if the cleanup function (clearInterval) were omitted from a component that mounts and unmounts repeatedly.'),
  (4, 'Rendering lists with keys',
   'When rendering an array with .map(), each element needs a stable, unique `key` prop so React can correctly track which item is which across re-renders — especially important when items can be added, removed or reordered.',
   'items.map(item => <li key={item.id}>{item.name}</li>) uses a stable database ID as the key, so reordering the list doesn''t confuse React about which <li> is which.',
   'Explain why using the array index as the key becomes a problem specifically when a user can delete an item from the middle of the list.'),
  (5, 'Lifting state up',
   'When two sibling components need to share or stay in sync on the same piece of state, that state should live in their closest common parent, which then passes the value and an updater function down as props to both children.',
   'A filter dropdown and a results list both need the selected "category" — that state lives in their shared parent, which passes `category` down to the list and `onCategoryChange` down to the dropdown.',
   'You have a search box and a results count in separate components that need to share the current search term. Describe where the state should live and how each component would use it.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'react-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- TypeScript Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Typing variables and functions',
   'TypeScript lets you declare the type of a variable or function parameter/return value, and will flag mismatches before the code ever runs. Most of the time the type can be inferred automatically from the assigned value, so explicit annotations matter most on function signatures.',
   'function add(a: number, b: number): number { return a + b; } — calling add("2", 3) is caught at compile time instead of silently producing "23" at runtime.',
   'Write the TypeScript signature for a function `formatCurrency` that takes a number and an optional currency code string, and returns a string.'),
  (2, 'Interfaces and type aliases',
   'An interface (or type alias) describes the shape of an object — which properties exist and what type each one is. This lets the compiler catch typos in property names and missing required fields anywhere that object is used.',
   'interface User { id: string; name: string; email: string; } — passing an object missing `email` to a function expecting a User is flagged immediately, not discovered later at runtime.',
   'Define an interface `Task` with `id`, `title`, `isDone`, and an optional `dueDate`.'),
  (3, 'Union types',
   'A union type (A | B) says a value can be one of several specific types or literal values. This is especially useful for representing a fixed set of states, like a request status, instead of a loosely-typed string that could be anything.',
   'type RequestStatus = "idle" | "loading" | "success" | "error"; — assigning status = "pending" (a typo) is a compile error, unlike a plain string type which would silently accept it.',
   'Define a union type representing a traffic light''s possible colors.'),
  (4, 'Narrowing union types',
   'Before you can safely use a property that only exists on one branch of a union, TypeScript requires you to "narrow" the type with a check (typeof, an if, a discriminant field) so it knows which branch it''s dealing with at that point in the code.',
   'if (typeof value === "string") { value.toUpperCase(); } — inside that block, TypeScript knows `value` is definitely a string and allows string-only methods.',
   'Given `type Result = { status: "success"; data: string } | { status: "error"; message: string }`, describe how you would safely access `data` only when status is "success".'),
  (5, 'When (not) to use any',
   '`any` turns off type checking for that value entirely, which defeats the purpose of using TypeScript. It is sometimes a necessary escape hatch for genuinely untyped third-party data, but reaching for it to silence an error you don''t understand hides real bugs instead of fixing them.',
   'Typing an API response as `any` means a typo like `response.usrename` (instead of `username`) won''t be caught until it fails at runtime — typing the actual response shape would catch it immediately.',
   'You get a TypeScript error on a function parameter and you''re tempted to type it `any` to make the error go away. Describe a better first step.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'typescript-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- System Design Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Vertical vs horizontal scaling',
   'Vertical scaling means making one machine bigger (more CPU/RAM) — simple, but has a ceiling and a single point of failure. Horizontal scaling means adding more machines and distributing load across them — more complex, but scales further and can tolerate one machine failing.',
   'Upgrading a database server from 8 to 32 GB of RAM is vertical scaling; adding three more application servers behind a load balancer is horizontal scaling.',
   'A single web server is struggling under traffic. List one vertical and one horizontal option to address it, and one tradeoff of each.'),
  (2, 'Load balancers and statelessness',
   'A load balancer distributes incoming requests across multiple servers. For this to work cleanly, application servers should be stateless — not storing session data only in that one server''s memory — so any server can handle any request, and one server going down doesn''t log everyone out.',
   'Storing a logged-in user''s session in a shared database or cache (like Redis) instead of in one server''s local memory means a load balancer can route their next request to any server without losing their session.',
   'Explain why storing user sessions only in a single server''s local memory breaks once you add a second server behind a load balancer.'),
  (3, 'Caching',
   'A cache stores a fast-to-read copy of data that''s expensive to compute or fetch repeatedly. It speeds up reads dramatically but introduces the risk of serving stale data if the underlying data changes and the cache isn''t invalidated or given a sensible expiry.',
   'Caching a product page''s data for 60 seconds cuts database load dramatically for a popular item, at the cost of a shopper occasionally seeing a price that''s up to 60 seconds out of date.',
   'A cached list of "featured products" is updated by an admin, but users report seeing stale data for 10 minutes afterward. Describe two ways to fix this.'),
  (4, 'Read replicas and sharding (conceptually)',
   'A read replica is a copy of a database that serves read-only queries, taking load off the primary database which still handles writes. Sharding splits data across multiple databases (e.g. by user ID range) so no single database has to hold or serve all the data.',
   'An app with heavy read traffic (e.g. viewing profiles) but light write traffic (e.g. editing a profile) benefits from read replicas: writes go to the primary, most reads go to replicas.',
   'A social app''s single database is struggling with read load from a feed feature, but writes are fine. Which technique from this lesson fits best, and why?'),
  (5, 'The CAP tradeoff in plain terms',
   'In a distributed system, when a network partition happens, you must choose between Consistency (every read sees the latest write) and Availability (every request gets a response, even if it might be slightly stale). You cannot have perfect versions of both during a partition — different systems make different choices deliberately.',
   'A banking system usually favors consistency (better to reject a transaction than risk double-spending); a social media "like" counter usually favors availability (better to show a slightly stale count than an error page).',
   'For a shopping cart''s inventory count during a big sale, would you lean toward consistency or availability, and why?')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'system-design-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Automated Testing Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Unit, integration and end-to-end tests',
   'A unit test checks one function/component in isolation, fast and focused. An integration test checks that multiple pieces work together correctly (e.g. a service talking to a real test database). An end-to-end test drives the whole app like a real user would, through the UI. Each layer catches different bugs, and a healthy suite has far more unit tests than end-to-end tests, since end-to-end tests are slower and more brittle.',
   'A unit test checks that `calculateTotal(items)` sums correctly. An integration test checks that the checkout API actually saves an order to the database. An end-to-end test clicks through an entire purchase in a browser.',
   'For a login feature, describe one thing you''d check with a unit test and one thing you''d only be able to check with an end-to-end test.'),
  (2, 'Arrange, act, assert',
   'A clear unit test has three parts: arrange (set up the inputs/state needed), act (call the thing being tested), assert (check the result is what you expect). Keeping this structure explicit — even with blank lines between the parts — makes tests far easier to read and debug later.',
   'Arrange: const cart = [{price: 10}, {price: 20}]. Act: const total = calculateTotal(cart). Assert: expect(total).toBe(30).',
   'Write, in plain English, the arrange/act/assert steps for a test of a function that validates an email address.'),
  (3, 'Mocks and stubs',
   'A mock or stub replaces a real dependency (a network call, a database, the current time) with a controlled fake, so the test is fast, deterministic, and isolated from things outside your control. Overusing mocks can hide real integration bugs, so they''re most valuable at true boundaries (external APIs, databases) rather than your own internal logic.',
   'Mocking a payment gateway''s API call in a checkout test lets you verify your code handles a "payment declined" response correctly, without actually contacting the real payment provider.',
   'You''re testing a function that sends a welcome email on signup. Explain why you''d mock the email-sending service rather than calling the real one in every test run.'),
  (4, 'Recognizing flaky tests',
   'A flaky test passes and fails unpredictably with no code changes — common causes include relying on real timing/delays, unordered test execution assuming shared state, or depending on external network calls. Flaky tests erode trust in the whole suite, since people start ignoring failures.',
   'A test that waits exactly 500ms for an animation to finish before asserting can flake on a slower CI machine where the animation takes 600ms — waiting for a specific condition instead of a fixed delay fixes this.',
   'A test occasionally fails only when run alongside other tests, but always passes alone. What''s the most likely category of cause?'),
  (5, 'What coverage does and doesn''t guarantee',
   'Code coverage measures which lines were executed during tests, not whether they were meaningfully verified. A line can be "covered" by a test with no real assertion, or a test that only checks the happy path while ignoring error cases the code was written to handle.',
   'A test that calls `divide(10, 2)` and only checks it doesn''t throw gives 100% "line coverage" of the divide function, while completely missing the divide-by-zero case it needs to handle.',
   'Explain why a codebase reporting "95% test coverage" could still ship a serious bug.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'testing-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- PostgreSQL for Developers
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Designing a normalized schema',
   'Normalization means storing each fact once, in the table it actually belongs to, and linking related tables with foreign keys instead of repeating data. This avoids update anomalies where the same fact (e.g. a customer''s address) could get out of sync across multiple copies.',
   'Instead of repeating a customer''s email on every one of their orders, an `orders` table stores a `customer_id` foreign key referencing a single row in `customers` — update the email once, everywhere it''s used stays correct.',
   'You have an `orders` table with columns for product_name, product_price and product_category repeated on every order row. Explain the normalization problem and how you''d restructure it.'),
  (2, 'Constraints as data integrity',
   'NOT NULL, UNIQUE and CHECK constraints enforce rules at the database level, so bad data can never get in even if application code has a bug. This is a stronger guarantee than validating only in the application, since the database is the last line of defense.',
   'ALTER TABLE users ADD CONSTRAINT email_unique UNIQUE (email); guarantees no duplicate emails can ever be inserted, even if a bug in the app''s own validation logic is bypassed.',
   'Write the constraint you''d add to ensure a `quantity` column in an `order_items` table can never be zero or negative.'),
  (3, 'Indexes and their tradeoff',
   'An index lets the database find rows matching a condition without scanning the whole table, dramatically speeding up reads on large tables. The cost is that every write (insert/update/delete) also has to update the index, so indexing every column "just in case" slows down writes for no read benefit.',
   'Adding an index on `orders.customer_id` makes "find all orders for this customer" fast even with millions of rows, at the small cost of slightly slower inserts into `orders`.',
   'A table is read constantly by customer_id but written to rarely. Would you index customer_id? What if the table were written to thousands of times per second and rarely read?'),
  (4, 'Transactions',
   'A transaction groups multiple statements so they either all succeed together or all roll back together — critical for multi-step writes like "deduct from account A, add to account B," where a failure partway through must not leave the data in an inconsistent state.',
   'BEGIN; UPDATE accounts SET balance = balance - 100 WHERE id = 1; UPDATE accounts SET balance = balance + 100 WHERE id = 2; COMMIT; — if the second update fails, the whole transaction rolls back, so money is never "lost" mid-transfer.',
   'Explain what could go wrong if a money transfer''s two UPDATE statements were run outside a transaction and the app crashed between them.'),
  (5, 'Basic locking and race conditions',
   'When two operations try to read-then-write the same row at nearly the same time, one can overwrite the other''s change (a race condition) unless the database locks the row during the update. Using an atomic update expression instead of "read value, compute in app, write value back" avoids many of these bugs entirely.',
   'UPDATE inventory SET stock = stock - 1 WHERE id = 5 AND stock > 0; is atomic and safe under concurrent requests, unlike reading stock in the app, subtracting one, and writing it back separately.',
   'Two customers try to buy the last item in stock at the same second. Explain how an atomic UPDATE with a WHERE condition prevents both purchases from succeeding.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'postgresql-for-developers'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Networking Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'The TCP/IP model in practice',
   'Data moving across a network passes through layers: the application layer (HTTP, DNS), transport layer (TCP/UDP), internet layer (IP addressing/routing) and link layer (physical/local network). An analyst investigating traffic needs to know which layer a given problem or attack is happening at.',
   'A DNS spoofing attack happens at the application layer; a SYN flood attack targets the transport layer''s connection-setup process — the right response differs depending on which layer is involved.',
   'A website is unreachable. Name one thing you''d check at the DNS/application layer and one thing you''d check at the network/routing layer.'),
  (2, 'IP addressing and subnets',
   'An IP address identifies a device on a network. A subnet mask splits an IP range into a network portion and a host portion, defining which addresses are "local" to each other. Private address ranges (like 10.0.0.0/8, 192.168.0.0/16) are used inside organizations and are not directly reachable from the public internet.',
   '192.168.1.10 is a private address commonly used on a home or office network; it cannot be reached directly from the public internet without translation (NAT).',
   'Explain why seeing a private IP address (like 192.168.x.x) in a public-facing server log would be a red flag worth investigating.'),
  (3, 'DNS resolution and abuse',
   'DNS translates domain names into IP addresses. A client asks a resolver, which may check a cache or ask authoritative servers up the chain, before returning an answer. Because DNS is trusted by default, attackers abuse it for spoofing (returning a fake IP) and for slow, low-volume data exfiltration hidden inside DNS queries.',
   'A phishing attack can use DNS spoofing to redirect a legitimate-looking domain to an attacker-controlled IP, so the user never notices anything wrong with the URL bar.',
   'Explain, in your own words, why DNS traffic being "usually allowed through firewalls" makes it an attractive channel for attackers to exfiltrate small amounts of data slowly.'),
  (4, 'The TCP handshake and common ports',
   'TCP establishes a reliable connection with a three-way handshake: SYN, SYN-ACK, ACK. Common ports map to well-known services (80/443 for HTTP/HTTPS, 22 for SSH, 53 for DNS), which is why unusual traffic on unexpected ports is a common thing analysts look for.',
   'Seeing repeated SYN packets to many different ports from one source, with no completed handshakes, is a classic signature of a port scan.',
   'You see a burst of SYN packets from one IP to 200 different ports in under a second, with no completed connections. What activity does this most likely indicate?'),
  (5, 'Reading basic diagnostic tools',
   'ping tests basic reachability and round-trip latency to a host. traceroute shows the path (hop by hop) packets take to a destination, useful for spotting where connectivity breaks down. netstat/ss show active connections on a machine, useful for spotting unexpected outbound connections.',
   'Running traceroute and seeing the path stop responding at a specific hop tells you connectivity is failing at (or just after) that point in the network, not at the final destination.',
   'A workstation is suspected of communicating with an unknown external server. Which tool from this lesson would you use first to check its active connections, and what would you look for?')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'networking-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Incident Response Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'The incident response lifecycle',
   'The standard lifecycle is: prepare (have tools/playbooks ready before anything happens), detect (identify the incident), contain (stop it from spreading further), eradicate (remove the actual cause), recover (safely restore normal operation) and review (lessons learned, so it''s harder for the same thing to happen again).',
   'Isolating an infected laptop from the network is containment; removing the malware from it is eradication; those are two distinct steps, done in that order, not one combined action.',
   'For a suspected phishing email that led to a compromised account, list what you''d do at each of the six lifecycle stages.'),
  (2, 'Containment before eradication',
   'Containing an incident (isolating an affected system, disabling a compromised account) stops active damage immediately, buying time to investigate properly before removing the actual cause. Skipping straight to eradication without containment risks the attacker reacting and destroying evidence, or the threat spreading further during the delay.',
   'Disabling a compromised employee account immediately (containment) while investigating exactly how it was compromised, rather than waiting until the full investigation is finished, limits ongoing damage.',
   'Explain why disabling network access for a compromised server should typically happen before you start deeply investigating exactly how it was compromised.'),
  (3, 'Preserving evidence for forensics',
   'Volatile evidence (running processes, active network connections, memory contents) is lost the moment a system reboots or is wiped. Before remediating, an analyst should capture what''s needed (memory dump, process list, relevant logs) whenever forensic analysis will be needed later.',
   'Rebooting a compromised server to "fix" the immediate problem can destroy the exact malicious process and network connection evidence needed to understand how the attacker got in and what they did.',
   'A manager wants to immediately reboot a suspected-compromised production server to restore service. Explain the tradeoff you''d raise before doing that.'),
  (4, 'Writing a clear incident timeline',
   'A good incident timeline records specific, timestamped, factual observations ("14:32 UTC — failed login attempts from IP X on account Y") rather than vague summaries. This makes the incident reconstructable by someone who wasn''t there, and defensible if it needs review later.',
   '"14:02 UTC: alert fired for unusual outbound traffic from host WKS-042. 14:05 UTC: host isolated from network. 14:20 UTC: malware identified as X." is specific and reconstructable, unlike "noticed something weird this afternoon, fixed it."',
   'Rewrite the vague note "Server acted strange around lunchtime, we restarted it and it seemed fine" as a specific, timestamped incident note (you can invent plausible specifics).'),
  (5, 'Knowing when to escalate',
   'Not every incident is something a single analyst should handle alone — incidents involving customer data, executive accounts, regulatory-covered data, or unclear scope should be escalated immediately per the organization''s policy, rather than quietly handled and reported after the fact.',
   'An analyst noticing a single failed login is routine; an analyst noticing an admin account was used to export a customer database at 3 AM should escalate immediately, not wait to finish investigating alone first.',
   'You discover a compromised account had access to a database containing customer personal information. Explain why this specific detail changes your next action.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'incident-response-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Figma for Designers
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Structuring a file',
   'Frames are containers (like an artboard) representing screens or sections. Components are reusable elements (a button, a card) defined once and instanced everywhere else. Keeping a clear layer/page structure — not one giant flat canvas — is what makes a file usable by a team, not just by the person who made it.',
   'A "Buttons" page holding the master component, versus 40 loose copies of a button scattered across different screen frames, is the difference between a maintainable design system and a mess.',
   'Describe how you''d organize a Figma file for a 5-screen mobile app so a new team member could find things quickly.'),
  (2, 'Auto-layout',
   'Auto-layout makes a frame size itself based on its content and spacing rules, similar to how flexbox works in CSS. This means when text or content changes length, the layout adjusts automatically instead of everything needing manual repositioning.',
   'A button with auto-layout and 16px horizontal padding automatically grows wider when its label changes from "Save" to "Save Changes", instead of the text overflowing a fixed-width box.',
   'Explain, conceptually, why a card component built with auto-layout survives a much longer product description better than one built with fixed positioning.'),
  (3, 'Components and variants',
   'A component is a master version of an element; instances of it update automatically when the master changes. Variants group related versions of a component (e.g. a button''s primary/secondary/disabled states) into one switchable component instead of separate, disconnected copies.',
   'A single Button component with variants for size (small/large) and state (default/hover/disabled) lets a designer swap between them from one dropdown, instead of hunting for 6 separate loose button designs.',
   'You have primary, secondary and disabled versions of the same button, currently as 3 separate unconnected layers. Describe how you''d turn them into one component with variants.'),
  (4, 'Constraints for responsive resizing',
   'Constraints control how a layer behaves when its parent frame is resized — pinned to left/right/top/bottom/center, or scaled proportionally. Getting this wrong is why a redesigned frame at a different size often looks broken until constraints are set deliberately.',
   'A background image constrained to "scale" resizes proportionally with its frame, while a logo constrained to "top-left" stays a fixed size in the corner regardless of frame size.',
   'A modal''s close button should always stay in the top-right corner no matter how tall the modal gets. Which constraint setting achieves that?'),
  (5, 'Preparing for developer handoff',
   'Developers need consistent naming, exportable assets (icons, images) at the right formats/sizes, and inspectable spacing/color/typography values — not just a pretty picture. A design that looks right but has inconsistent spacing values forces engineers to guess at the intended system.',
   'Naming layers "Icon/Search" and "Icon/Close" consistently, rather than "Rectangle 47" and "Group 12", lets a developer immediately understand and find what they need.',
   'List three things you''d check in a design file before telling engineering it''s ready for handoff.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'figma-for-designers'
ON CONFLICT (topic_id, sort_order) DO NOTHING;
