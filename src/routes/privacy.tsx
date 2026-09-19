import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, PageHero } from "@/components/site/marketing-page";
import { LegalSection, LegalTableOfContents } from "@/components/site/legal-page";

const TITLE = "Privacy Policy — Rolisha";
const DESCRIPTION = "How Rolisha collects, uses, and protects your information.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS = [
  { id: "information-we-collect", title: "Information we collect" },
  { id: "how-we-use-information", title: "How we use information" },
  { id: "authentication", title: "Authentication" },
  { id: "job-data-and-third-parties", title: "Job data and third party services" },
  { id: "payments", title: "Payments" },
  { id: "cookies-and-local-storage", title: "Cookies and local storage" },
  { id: "data-retention", title: "Data retention" },
  { id: "security", title: "Security" },
  { id: "your-rights", title: "Your rights" },
  { id: "contact", title: "Contact" },
  { id: "changes", title: "Changes to this policy" },
];

function PrivacyPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="Last updated September 5, 2026. This page explains what Rolisha collects, why, and how you can control it."
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <LegalTableOfContents sections={SECTIONS} />

        <LegalSection id="information-we-collect" title="Information we collect">
          <p>
            When you create a Rolisha account, we collect the email address and name you provide (or
            that your identity provider shares, if you sign in with Google).
          </p>
          <p>
            As you use the product, we store the information you give us to power its features: your
            target career, your self reported and assessed skills, resume content you submit for
            review, mock interview responses, project and roadmap progress, and saved jobs.
          </p>
          <p>
            We also collect basic product analytics (which features are used and when) to understand
            what's working and to fix what isn't.
          </p>
        </LegalSection>

        <LegalSection id="how-we-use-information" title="How we use information">
          <p>
            We use your information to run the product: to generate your skill gap analysis and
            readiness score, build and update your roadmap, match you against job listings, run mock
            interviews and resume reviews, and track your progress over time.
          </p>
          <p>
            We do not sell your personal information, and we do not use your resume, interview, or
            assessment content to train third party AI models beyond what's needed to generate the
            response you asked for in the moment.
          </p>
        </LegalSection>

        <LegalSection id="authentication" title="Authentication">
          <p>
            Accounts and sign in are handled by Supabase, our authentication and database provider.
            You can create an account with an email and password, or sign in with Google through
            Supabase's OAuth integration. We never see or store your Google password.
          </p>
        </LegalSection>

        <LegalSection id="job-data-and-third-parties" title="Job data and third party services">
          <p>
            Live job listings are retrieved from Adzuna, a third party job search API. Job data
            (titles, descriptions, and employer names) comes from Adzuna and its listed sources, not
            from Rolisha.
          </p>
          <p>
            Some features on Rolisha (for example resume feedback, mock interview questions, and
            roadmap generation) are powered by a third party AI provider. Content you submit to
            those features is sent to that provider to generate a response and is subject to its own
            data handling terms in addition to this policy.
          </p>
        </LegalSection>

        <LegalSection id="payments" title="Payments">
          <p>
            Paid subscriptions are processed by Razorpay. Rolisha does not receive or store your
            full card, UPI, or bank account details — Razorpay handles payment collection directly
            and shares with us only what's needed to activate and manage your subscription (plan,
            status, and billing history).
          </p>
        </LegalSection>

        <LegalSection id="cookies-and-local-storage" title="Cookies and local storage">
          <p>
            Rolisha uses your browser's local storage to keep you signed in between visits and to
            remember short lived interface preferences (like a filter you last used on the Jobs
            page). We do not use third party advertising cookies or trackers.
          </p>
        </LegalSection>

        <LegalSection id="data-retention" title="Data retention">
          <p>
            We keep your account data for as long as your account is active. If you delete your
            account, we delete or anonymize the personal information associated with it, other than
            records we're required to keep for legal, tax, or fraud prevention purposes (for
            example, payment records).
          </p>
        </LegalSection>

        <LegalSection id="security" title="Security">
          <p>
            Your data is stored in Supabase's managed Postgres database with row level security
            policies that restrict each account to its own data. Access to production data is
            limited to what's needed to operate and support the product. No method of storage or
            transmission is completely secure, and we can't guarantee absolute security.
          </p>
        </LegalSection>

        <LegalSection id="your-rights" title="Your rights">
          <p>
            You can review and update most of your information directly from your account settings.
            You can request a copy of your data or ask us to delete your account and associated
            personal data by reaching out through the{" "}
            <Link to="/contact" className="text-primary hover:underline">
              contact page
            </Link>
            . We'll respond within a reasonable time and may need to verify your identity first.
          </p>
        </LegalSection>

        <LegalSection id="contact" title="Contact">
          <p>
            Questions about this policy or your data can be sent through the{" "}
            <Link to="/contact" className="text-primary hover:underline">
              contact page
            </Link>
            .
          </p>
        </LegalSection>

        <LegalSection id="changes" title="Changes to this policy">
          <p>
            We may update this policy as the product changes. If we make a material change, we'll
            update the "last updated" date above and, where appropriate, let you know in the
            product.
          </p>
        </LegalSection>
      </div>
    </MarketingPage>
  );
}
