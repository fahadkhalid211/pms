"use client";

import Link from "next/link";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your Lumina PMS workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <React.Suspense fallback={<div className="py-4 text-center text-sm text-muted-foreground">Loading sign in form...</div>}>
            <SignInForm />
          </React.Suspense>
          <div className="mt-4 space-y-2 text-center text-sm text-muted-foreground">
            <p>
              Forgot your password?{" "}
              <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                Reset password
              </Link>
            </p>
            <p>
              New to Lumina?{" "}
              <Link href="/register" className="font-medium text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const isDisallowed =
    !rawNext ||
    rawNext === "/login" ||
    rawNext.startsWith("/login?") ||
    rawNext.startsWith("/login/") ||
    rawNext === "/register" ||
    rawNext.startsWith("/register?") ||
    !rawNext.startsWith("/") ||
    rawNext.startsWith("//");
  const targetDestination = isDisallowed ? "/dashboard" : rawNext;

  const [state, formAction, isPending] = React.useActionState(loginAction, undefined);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  React.useEffect(() => {
    let active = true;
    fetch("/api/auth/session", {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json?.success && json?.data?.user) {
          window.location.replace(targetDestination);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [targetDestination]);

  return (
    <form className="space-y-4" action={formAction}>
      <input type="hidden" name="next" value={targetDestination} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            Reset password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {state?.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
