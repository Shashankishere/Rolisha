import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, PageHero } from "@/components/site/marketing-page";
import { LegalSection, LegalTableOfContents } from "@/components/site/legal-page";

const TITLE = "Terms of Service — Rolisha";
const DESCRIPTION = "The terms that govern your use of Rolisha.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: TermsPage,
});

const SECTIONS = [
  { id: "acceptance", title: "Acceptance of terms" },
  { id: "the-service", title: "The Rolisha service" },
  { id: "accounts", title: "User accounts" },
  { id: "job-listings", title: "Job listings" },
  { id: "learning-content", title: "Learning content" },
  { id: "payments-and-subscriptions", title: "Payments and subscriptions" },
  { id: "acceptable-use", title: "Acceptable use" },
  { id: "third-party-services", title: "Third party services" },
  { id: "intellectual-property", title: "Intellectual property" },
  { id: "disclaimer", title: "Disclaimer" },
  { id: "limitation-of-liability", title: "Limitation of liability" },
  { id: "termination", title: "Termination" },
  { id: "changes", title: "Changes to these terms" },
  { id: "contact", title: "Contact" },
];

function TermsPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Legal"
        title="Terms of Service"
        subtitle="Last updated September 5, 2026. Please read these terms before using Rolisha."
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <LegalTableOfContents sections={SECTIONS} />

        <LegalSection id="acceptance" title="Acceptance of terms">
          <p>
            By creating an account or otherwise using Rolisha, you agree to these terms. If you do
            not agree, please do not use the service.
          </p>
        </LegalSection>

        <LegalSection id="the-service" title="The Rolisha service">
          <p>
            Rolisha is a career intelligence platform that compares your skills against real job
            requirements, generates a readiness score and a personalized roadmap, and provides
            supporting tools such as job search, mock interviews, resume review, and skill
            assessments.
          </p>
          <p>
            Scores, roadmaps, and other generated guidance are decision support, not a guarantee of
            any outcome (including being hired, passing an interview, or acquiring a skill by a
            given date).
          </p>
        </LegalSection>

        <LegalSection id="accounts" title="User accounts">
          <p>
            You need an account to use most of Rolisha. You're responsible for keeping your login
            credentials secure and for the activity that happens under your account. Tell us
            promptly through the{" "}
            <Link to="/contact" className="text-primary hover:underline">
              contact page
            </Link>{" "}
            if you believe your account has been accessed without authorization.
          </p>
        </LegalSection>

        <LegalSection id="job-listings" title="Job listings">
          <p>
            Job listings shown in Rolisha are retrieved from Adzuna and its underlying sources.
            Rolisha does not create, verify, or guarantee the accuracy, availability, or legitimacy
            of any listing, and is not a party to any employment relationship that may result from
            applying to one. Always use your own judgment when evaluating and applying to a posting.
          </p>
        </LegalSection>

        <LegalSection id="learning-content" title="Learning content">
          <p>
            Roadmap steps, lessons, and project briefs are provided for educational purposes to help
            you build toward a target role. They do not constitute professional, legal, or financial
            advice, and completing them does not guarantee any certification, job offer, or specific
            proficiency level.
          </p>
        </LegalSection>

        <LegalSection id="payments-and-subscriptions" title="Payments and subscriptions">
          <p>
            Paid plans are billed on a recurring basis through Razorpay at the price shown at
            checkout for your region and plan. You can cancel a subscription at any time from your
            account settings; cancellation stops future renewals but does not retroactively refund
            the current billing period unless required by law.
          </p>
          <p>
            Prices may change with notice for future billing periods. Continuing to use a paid plan
            after a price change takes effect means you accept the new price.
          </p>
        </LegalSection>

        <LegalSection id="acceptable-use" title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Use Rolisha for any unlawful purpose, or to violate any applicable law.</li>
            <li>Attempt to access another user's account or data without authorization.</li>
            <li>
              Scrape, reverse engineer, or systematically extract data from Rolisha beyond normal,
              individual use of the product.
            </li>
            <li>Interfere with or disrupt the service, its infrastructure, or other users.</li>
            <li>
              Upload content to Rolisha (resumes, messages, or otherwise) that infringes someone
              else's rights or contains malicious code.
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="third-party-services" title="Third party services">
          <p>
            Rolisha relies on third party services to operate, including Supabase (authentication
            and data storage), Adzuna (job listings), an AI provider (for features like resume
            review, mock interviews, and roadmap generation), and Razorpay (payments). Your use of
            features backed by these services is also subject to the relevant provider's own terms,
            to the extent they apply to you.
          </p>
        </LegalSection>

        <LegalSection id="intellectual-property" title="Intellectual property">
          <p>
            Rolisha's software, design, and skill/career catalogue are owned by Rolisha or its
            licensors. You retain ownership of the content you submit (such as your resume or
            project work) and grant us a license to use it solely to provide the service to you.
          </p>
        </LegalSection>

        <LegalSection id="disclaimer" title="Disclaimer">
          <p>
            Rolisha is provided "as is" and "as available," without warranties of any kind, express
            or implied, including warranties of merchantability, fitness for a particular purpose,
            or noninfringement. We do not warrant that the service will be uninterrupted, error
            free, or that any score, roadmap, or recommendation will be accurate or complete.
          </p>
        </LegalSection>

        <LegalSection id="limitation-of-liability" title="Limitation of liability">
          <p>
            To the fullest extent permitted by law, Rolisha and its team are not liable for any
            indirect, incidental, special, or consequential damages, or for any loss of income,
            data, or opportunity, arising from your use of (or inability to use) the service. Our
            total liability for any claim relating to the service is limited to the amount you paid
            us in the twelve months before the claim arose.
          </p>
        </LegalSection>

        <LegalSection id="termination" title="Termination">
          <p>
            You may stop using Rolisha and delete your account at any time. We may suspend or
            terminate access to the service for anyone who violates these terms, misuses the
            service, or where we're required to do so by law.
          </p>
        </LegalSection>

        <LegalSection id="changes" title="Changes to these terms">
          <p>
            We may update these terms as the product evolves. If we make a material change, we'll
            update the "last updated" date above and, where appropriate, let you know in the product
            before it takes effect.
          </p>
        </LegalSection>

        <LegalSection id="contact" title="Contact">
          <p>
            Questions about these terms can be sent through the{" "}
            <Link to="/contact" className="text-primary hover:underline">
              contact page
            </Link>
            .
          </p>
        </LegalSection>
      </div>
    </MarketingPage>
  );
}
