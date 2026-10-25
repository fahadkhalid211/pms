import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Lumina<span className="text-primary">PMS</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link href="/register" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
              Get started
            </Link>
          </nav>
        </div>
      </header>
      <main className="container flex flex-1 flex-col items-center justify-center py-24 text-center">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Run your property with calm precision.
          </h1>
          <p className="text-lg text-muted-foreground">
            Lumina PMS unifies reservations, room availability, front desk operations, billing, and guest
            communication — with an AI operations agent and support chatbot built in.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/register" className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow">
              Start free trial
            </Link>
            <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium shadow-sm hover:bg-accent">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
