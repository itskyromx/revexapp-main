import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, User, Eye, EyeOff } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { isUsernameAvailable, isValidUsername, normalizeUsername } from "@/lib/usernames";
import { useI18n } from "@/lib/i18n";

const SIGNUP_OTP_LENGTH = 6;

export default function Register() {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!acceptedLegal) {
      setError(t("Please read and agree to the Terms and Conditions and Privacy Policy."));
      return;
    }
    const normalizedUsername = normalizeUsername(username);
    if (!isValidUsername(normalizedUsername)) {
      setError(t("Username must be 3–20 characters, using letters, numbers, and underscores. It can't start or end with an underscore."));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("Passwords do not match"));
      return;
    }
    setLoading(true);
    try {
      if (!await isUsernameAvailable(supabase, normalizedUsername)) {
        setError(t("That username is already taken. Choose another one."));
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: normalizedUsername } },
      });
      if (error) throw error;
      setShowOtp(true);
    } catch (err) {
      setError(t(err.message || "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "signup" });
      if (error) throw error;
      window.location.href = "/onboarding";
    } catch (err) {
      setError(t(err.message || "Invalid verification code"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      toast({
        title: t("Code sent"),
        description: t("Check your email for the new code."),
      });
    } catch (err) {
      setError(t(err.message || "Failed to resend code"));
    }
  };

  const handleGoogle = async () => {
    if (!acceptedLegal) {
      setError(t("Please read and agree to the Terms and Conditions and Privacy Policy."));
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${safeReturnTo()}` },
    });
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title={t("Verify your email")}
      subtitle={t("We sent a 6-digit code to {email}", { email })}
        showBack
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={SIGNUP_OTP_LENGTH}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              {Array.from({ length: SIGNUP_OTP_LENGTH }, (_, index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length !== SIGNUP_OTP_LENGTH}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("Verifying...")}
            </>
          ) : (
            t("Verify")
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          {t("Didn't receive the code?")}{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            {t("Resend")}
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
        title={t("Create your account")}
        subtitle={t("Sign up to get started")}
      showBack
      footer={
        <>
          {t("Already have an account?")}{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="text-primary font-medium hover:underline"
          >
            {t("Log in")}
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        {t("Continue with Google")}
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">{t("or")}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">{t("Username")}</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="your_username"
              value={username}
              onChange={(e) => setUsername(normalizeUsername(e.target.value).replace(/[^a-z0-9_]/g, "").slice(0, 20))}
              className="pl-10 h-12"
              minLength={3}
              maxLength={20}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("Email")}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("Password")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-12 h-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <Eye className="w-4 h-4" aria-hidden="true" /> : <EyeOff className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">{t("Confirm Password")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 pr-12 h-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              aria-pressed={showConfirmPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <Eye className="w-4 h-4" aria-hidden="true" /> : <EyeOff className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className="flex items-start gap-3 text-sm leading-5">
          <input
            id="accepted-legal"
            type="checkbox"
            required
            checked={acceptedLegal}
            onChange={(e) => setAcceptedLegal(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
          />
          <label htmlFor="accepted-legal" className="text-muted-foreground">
            {t("Read and agree with the")}{" "}
            <Link to="/terms-and-conditions" className="text-primary font-medium underline underline-offset-2">
              {t("Terms and Conditions")}
            </Link>{" "}&amp;{" "}
            <Link to="/privacy-policy" className="text-primary font-medium underline underline-offset-2">
              {t("Privacy Policy")}
            </Link>
          </label>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("Creating account...")}
            </>
          ) : (
            t("Create account")
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
