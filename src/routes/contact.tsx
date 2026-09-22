import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { MarketingPage, PageHero } from "@/components/site/marketing-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contactMessageSchema, submitContactMessage } from "@/lib/contact.functions";

const TITLE = "Contact Rolisha";
const DESCRIPTION = "Get in touch with the Rolisha team.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: ContactPage,
});

type FieldErrors = Partial<Record<"name" | "email" | "message", string>>;

function ContactPage() {
  // These stay in sync with the inputs via onChange (for the "Send another
  // message" reset), but they are NOT what gets validated/submitted — see
  // handleSubmit. Reading straight from the submitted <form>'s FormData
  // instead of these state values means what's validated is always
  // exactly what the browser would actually submit, even in edge cases
  // (fast browser autofill, etc.) where the DOM value and React's copy of
  // it can momentarily disagree.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot: left empty by real visitors, never shown to them.
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: (values: { name: string; email: string; message: string }) =>
      submitContactMessage({ data: { ...values, companyWebsite } }),
    onSuccess: () => setSent(true),
    onError: (error: Error) =>
      toast.error(error.message || "Could not send your message. Please try again."),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;

    // The single source of truth for "what did the user actually fill
    // in" — read straight from the form element rather than from React
    // state, so a prefilled/autofilled value that's visibly present in
    // the field is never mistaken for empty.
    const formData = new FormData(event.currentTarget);
    const values = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      message: String(formData.get("message") ?? ""),
    };

    const result = contactMessageSchema
      .pick({ name: true, email: true, message: true })
      .safeParse(values);

    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if ((key === "name" || key === "email" || key === "message") && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields and try again.");
      return;
    }

    setErrors({});
    mutation.mutate(result.data);
  }

  return (
    <MarketingPage>
      <PageHero
        eyebrow="Contact"
        title="Get in touch"
        subtitle="Questions, feedback, or something not working the way it should? Send us a message and we'll get back to you."
      />

      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <div className="panel p-6 sm:p-8">
          {sent ? (
            <div className="py-6 text-center">
              <div className="bg-success-soft text-success mx-auto flex size-12 items-center justify-center rounded-full">
                <CheckCircle2 className="size-6" />
              </div>
              <h2 className="font-display mt-4 text-xl font-semibold">Message sent</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Message sent successfully. We'll get back to you soon at the email address you
                provided.
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => {
                  setSent(false);
                  setName("");
                  setEmail("");
                  setMessage("");
                  setErrors({});
                }}
              >
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="flex items-center gap-2">
                <Mail className="text-primary size-5" />
                <h2 className="text-lg font-semibold">Send a message</h2>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  name="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name)
                      setErrors((prev) => {
                        const { name: _name, ...rest } = prev;
                        return rest;
                      });
                  }}
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Your name"
                  aria-invalid={Boolean(errors.name)}
                  required
                />
                {errors.name && <p className="text-destructive text-xs">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email)
                      setErrors((prev) => {
                        const { email: _email, ...rest } = prev;
                        return rest;
                      });
                  }}
                  maxLength={255}
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(errors.email)}
                  required
                />
                {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  name="message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (errors.message)
                      setErrors((prev) => {
                        const { message: _message, ...rest } = prev;
                        return rest;
                      });
                  }}
                  maxLength={4000}
                  rows={6}
                  placeholder="How can we help?"
                  aria-invalid={Boolean(errors.message)}
                  required
                />
                {errors.message && <p className="text-destructive text-xs">{errors.message}</p>}
              </div>

              {/* Honeypot — hidden from sighted and screen-reader users alike.
                  Bots that fill in every field will trip this; real visitors
                  never see it exists. */}
              <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                <label htmlFor="contact-company-website">Company website</label>
                <input
                  id="contact-company-website"
                  name="companyWebsite"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Send message
              </Button>
            </form>
          )}
        </div>
      </div>
    </MarketingPage>
  );
}
