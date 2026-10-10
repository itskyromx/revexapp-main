import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function LegalDocument({ title, updated, otherPath, otherLabel, children }) {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b-[4px] border-border bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 font-heading text-sm font-bold uppercase"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </button>
        </div>
      </header>
      <article className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="mt-2 font-display text-3xl uppercase leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-foreground/90 sm:text-base">
          {children}
        </div>
        <div className="mt-12 border-t-2 border-border pt-6 text-sm text-muted-foreground">
          <Link to={otherPath} className="font-medium text-primary underline underline-offset-4">Read our {otherLabel}</Link>
        </div>
      </article>
    </main>
  );
}

export function LegalSection({ title, children }) {
  return (
    <section>
      <h2 className="mb-2 font-heading text-lg font-bold uppercase sm:text-xl">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
