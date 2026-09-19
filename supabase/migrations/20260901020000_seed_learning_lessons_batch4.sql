-- Lessons for the 3 topics seeded in 20260901010000_seed_learning_content_batch4.sql

-- Machine Learning Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Supervised vs unsupervised learning',
   'Supervised learning trains on labeled examples (inputs paired with a known correct output) to predict labels for new data — think spam/not-spam or predicting a price. Unsupervised learning has no labels; it finds structure in the data itself, like grouping similar customers together. Most real Data Scientist work starts by identifying which of these a business question actually is, since it determines which algorithms are even on the table.',
   'Predicting whether a loan will default (using past loans labeled "defaulted" or "repaid") is supervised. Grouping website visitors into behavioral segments with no predefined categories is unsupervised clustering.',
   'A retailer wants to "understand what kinds of customers we have" versus "predict which customers will churn next month." Identify which is supervised and which is unsupervised, and explain why.'),
  (2, 'Train, validation, and test splits',
   'You never evaluate a model on the same data it trained on — it would look artificially good, since it has effectively memorized the answers. Split data into a training set (used to fit the model), a validation set (used to tune choices like hyperparameters), and a test set (touched only once, at the end, for an honest final performance estimate).',
   'With 10,000 labeled rows, a common split is roughly 70% train, 15% validation, 15% test — the model never sees the test set until the very last evaluation.',
   'You tune a model''s settings by repeatedly checking its score on the test set and picking whatever setting scores highest. Explain what is wrong with this approach and what you should have done instead.'),
  (3, 'Overfitting and underfitting',
   'Overfitting is when a model learns the training data too specifically, including its noise, so it performs well on training data but poorly on new data — the gap between train and test performance is the tell. Underfitting is the opposite: the model is too simple to capture the real pattern, and performs poorly on both training and test data.',
   'A decision tree grown so deep it has a unique branch for nearly every training row will hit 99% training accuracy but may drop to 60% on new data — classic overfitting.',
   'A linear regression model gets 40% accuracy on both training and test data on a problem you know has non-linear structure. Is this overfitting or underfitting, and what would you try next?'),
  (4, 'Choosing the right evaluation metric',
   'Accuracy (percent correct) can be misleading on imbalanced data — a model that always predicts "not fraud" can be 99% accurate if fraud is rare, while being useless. Precision measures how trustworthy a positive prediction is; recall measures how many actual positives you caught. For regression, RMSE and MAE measure how far off your numeric predictions are, in the original units.',
   'For a fraud-detection model where fraud is 1% of transactions, recall (catching actual fraud cases) usually matters more than raw accuracy, since missing fraud is far costlier than a false alarm.',
   'You are building a model to flag potentially defective products before shipping. Would you prioritize precision or recall, and why? What is the real-world cost of getting the wrong one wrong?'),
  (5, 'The end-to-end ML workflow',
   'A real ML project is not "train a model" in isolation — it is: define the business question, gather and clean data, engineer features, split the data, train a baseline model, evaluate it honestly, iterate, and finally deploy and monitor it in production (since real-world data drifts over time and performance can silently degrade).',
   'A baseline logistic regression that gets 78% accuracy in an afternoon is often more valuable early on than a complex model tuned for three weeks, because it tells you quickly whether the problem is even tractable with the data you have.',
   'Outline the six-step workflow above for a project predicting employee attrition, naming one concrete task you would do at each step with typical HR data.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'machine-learning-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Deep Learning Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Neurons, layers, and weights',
   'A neural network is built from layers of simple units ("neurons"), each computing a weighted sum of its inputs plus a bias, then passing that through an activation function. Stacking layers (an input layer, one or more hidden layers, an output layer) lets the network combine simple pieces into representations of increasingly complex patterns.',
   'In a network predicting house price, the input layer might take square footage, bedrooms, and location; hidden layers combine these into learned intermediate features; the output layer produces a single predicted price.',
   'A network has an input layer with 4 features, one hidden layer with 8 neurons, and one output neuron. Describe, in your own words, what happens to a single input row as it flows through this network.'),
  (2, 'Why activation functions matter',
   'Without a non-linear activation function (like ReLU or sigmoid) between layers, stacking any number of layers mathematically collapses into a single linear transformation — you would gain nothing from "depth." Non-linear activations are what let a deep network learn curved decision boundaries and complex patterns that a straight line cannot capture.',
   'ReLU (max(0, x)) is the default choice in most hidden layers today because it is simple and avoids some training problems that sigmoid/tanh have in deep networks.',
   'Explain, without using any equations, why a 10-layer network with no activation functions between the layers behaves the same as a single-layer linear model.'),
  (3, 'Backpropagation and gradient descent',
   'Training a network means adjusting its weights to reduce prediction error. Backpropagation computes how much each weight contributed to that error (using the chain rule, working backward from the output). Gradient descent then nudges each weight slightly in the direction that reduces the error, repeating this over many passes through the data.',
   'If a weight, when increased slightly, would reduce prediction error, gradient descent increases it a small step (scaled by the "learning rate"); if it would increase the error, it decreases it instead.',
   'A model''s loss stops improving and starts increasing partway through training. Name two possible causes related to the learning rate, and how you might diagnose which one it is.'),
  (4, 'CNNs, RNNs, and Transformers: picking an architecture',
   'Different data shapes call for different architectures. Convolutional Neural Networks (CNNs) exploit spatial structure and are the default for images. Recurrent Neural Networks (RNNs) and, more commonly today, Transformers handle sequential data like text or time series by modeling relationships across positions. A plain feedforward network is the fallback for simple tabular data.',
   'A model classifying chest X-rays as normal/abnormal would use a CNN to exploit pixel-neighborhood structure; a model translating English to French would use a Transformer to relate words across a whole sentence.',
   'You need to build a model that predicts next week''s sales from the past two years of weekly sales figures. Which architecture family fits best, and what property of the data makes it the right choice?'),
  (5, 'Overfitting, compute, and transfer learning in practice',
   'Deep networks have huge numbers of parameters and can overfit small datasets easily — techniques like dropout, data augmentation, and early stopping help. Training large networks from scratch is expensive and needs GPUs and lots of data; transfer learning (starting from a model already pretrained on a large dataset, then fine-tuning it on your smaller one) is usually the practical default instead.',
   'Instead of training an image classifier from scratch on 2,000 photos, fine-tuning a network pretrained on millions of general images (like ImageNet) typically reaches much better accuracy with far less data and compute.',
   'You have 500 labeled images and a deadline in two weeks. Explain why training a large CNN from scratch is a poor plan here, and what you would do instead.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'deep-learning-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- R Programming Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Vectors, lists, and data frames',
   'A vector holds a sequence of values of the same type (all numeric, or all character) and is the most basic R structure — even a single number is technically a length-1 vector. A list can hold mixed types and different lengths. A data frame is R''s tabular structure: a set of equal-length columns (each a vector), which can each be a different type, exactly like a spreadsheet or a SQL table.',
   'c(1, 2, 3) is a numeric vector. data.frame(name = c("Ana","Ben"), age = c(31, 27)) is a data frame with one character column and one numeric column, two rows each.',
   'You have three separate vectors: names, ages, and departments, each with 5 values. Describe how you would combine them into a single data frame, and what would go wrong if one vector only had 4 values.'),
  (2, 'Filtering and transforming with dplyr',
   'dplyr provides a small set of verbs that cover most data manipulation: filter() keeps rows matching a condition, select() picks columns, mutate() adds or changes a column, arrange() sorts rows, and group_by() + summarise() computes per-group statistics. Chaining these with the pipe (|> or %>%) reads like a left-to-right recipe instead of nested function calls.',
   'sales |> filter(region == "West") |> group_by(product) |> summarise(total = sum(amount)) reads as: take sales, keep only West region, group by product, then total the amount per product.',
   'Given a data frame `orders` with columns customer_id, amount, and status, write the dplyr pipeline to find total amount per customer, counting only orders where status is "completed".'),
  (3, 'Building charts with ggplot2',
   'ggplot2 builds charts in layers: ggplot(data, aes(x = ..., y = ...)) sets up what data and which columns map to which visual property, and geom_ functions (geom_point(), geom_bar(), geom_line()) add the actual visual marks on top. This "grammar of graphics" approach means changing a bar chart to a line chart is often a one-word change.',
   'ggplot(sales, aes(x = month, y = revenue)) + geom_line() draws a line chart of revenue by month; swapping geom_line() for geom_col() turns it into a bar chart with no other changes needed.',
   'You have a data frame with columns `department` and `avg_salary`, one row per department. Write the ggplot2 code to show this as a sorted bar chart, and explain what you would add to label the y-axis as "Average Salary ($)".'),
  (4, 'Summary statistics in R',
   'Base R and dplyr both make it straightforward to compute the everyday statistics on a column or group: mean(), median(), sd() (standard deviation), and summary() for a quick five-number overview. These are the same descriptive-statistics building blocks used across the Statistics topic, just expressed in R''s syntax.',
   'summary(df$age) prints the min, 1st quartile, median, mean, 3rd quartile, and max of the age column in one call — a fast first look at any numeric column.',
   'You want the average and standard deviation of `delivery_days` separately for each `warehouse`. Write the dplyr pipeline (group_by + summarise) that produces this.'),
  (5, 'Reproducible reports with R Markdown',
   'R Markdown documents mix narrative text, R code chunks, and their output (tables, charts) in one file that "knits" into a shareable report (HTML, PDF, or Word). Because the code runs live when the report is generated, the numbers and charts in the report are guaranteed to match the actual data — no manually copy-pasted, stale figures.',
   'An R Markdown report might have a paragraph explaining a churn analysis, followed by a code chunk that generates the churn-rate chart directly inline, so re-knitting the document after new data arrives updates the chart automatically.',
   'Explain why an R Markdown report is more trustworthy for a monthly stakeholder update than an R script whose output was manually copied into a slide deck.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'r-programming-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;
