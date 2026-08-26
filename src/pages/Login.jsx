import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { LogIn, ShieldCheck, ArrowLeft } from "lucide-react";
import logo from "../assets/mb-logo.jpg";

const RESEND_COOLDOWN = 30; // seconds
const OTP_LENGTH = 6;
const MAX_VERIFY_ATTEMPTS = 5;

export default function Login() {
  // step: "credentials" | "otp"
  const [step, setStep] = useState("credentials");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [cooldown, setCooldown] = useState(0);
  const [verifyAttempts, setVerifyAttempts] = useState(0);

  const navigate = useNavigate();
  const otpInputRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  // Step 1: verify the password is correct, then hand off to an email OTP
  // as the actual second factor. We deliberately sign the temporary
  // password-only session back out so nothing is authenticated until the
  // OTP is verified.
  async function handleCredentialsSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email || !password) {
      setError("Please enter both your email and password.");
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    // Credentials were correct — discard this session immediately, it does
    // not count as "logged in" until the OTP step also succeeds.
    await supabase.auth.signOut();

    const sent = await sendOtp();
    setLoading(false);
    if (sent) {
      setVerifyAttempts(0);
      setOtp("");
      setStep("otp");
    }
  }

  async function sendOtp() {
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (otpError) {
      setError(
        otpError.message?.toLowerCase().includes("rate limit")
          ? "Too many codes requested. Please wait a moment and try again."
          : "Could not send the verification code. Please try again."
      );
      return false;
    }

    setInfo(`We sent a ${OTP_LENGTH}-digit code to ${email}.`);
    setCooldown(RESEND_COOLDOWN);
    return true;
  }

  // Step 2: verify the OTP. Only on success does a real session get created.
  async function handleOtpSubmit(e) {
    e.preventDefault();
    setError("");

    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code sent to your email.`);
      return;
    }

    setLoading(true);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    setLoading(false);

    if (verifyError || !data?.session) {
      const attempts = verifyAttempts + 1;
      setVerifyAttempts(attempts);
      setOtp("");

      if (attempts >= MAX_VERIFY_ATTEMPTS) {
        setError("Too many incorrect attempts. Please start over.");
        resetToCredentials();
        return;
      }

      setError("That code is incorrect or has expired. Please try again.");
      return;
    }

    // Session now exists — AuthContext will pick this up automatically.
    navigate("/sectors");
  }

  async function handleResend() {
    if (cooldown > 0 || loading) return;
    setError("");
    setLoading(true);
    await sendOtp();
    setLoading(false);
  }

  function resetToCredentials() {
    setStep("credentials");
    setPassword("");
    setOtp("");
    setInfo("");
    setVerifyAttempts(0);
    setCooldown(0);
  }

  return (
    <div className="min-h-screen bg-[#F4F4F4] flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8 flex flex-col items-center">
          <img
            src={logo}
            alt="MB Development Corporation"
            className="w-36 h-36 object-contain drop-shadow-lg mb-2"
          />
          <h1 className="text-3xl font-bold text-[#2E2E2E]">
            MB Development Corporation
          </h1>
          <p className="text-[#6D6D6D] mt-2">Field Order Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#D9D9D9]">
          {step === "credentials" ? (
            <>
              <h2 className="text-xl font-semibold text-slate-800 mb-6">
                Welcome Back
              </h2>

              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="text-sm text-slate-600">Email</label>
                  <input
                    type="email"
                    autoComplete="email"
                    className="w-full mt-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D89B00]"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-600">Password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    className="w-full mt-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D89B00]"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D89B00] hover:bg-[#C58A00] text-white py-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  <LogIn size={18} />
                  {loading ? "Checking..." : "Login"}
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={resetToCredentials}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={20} className="text-[#D89B00]" />
                <h2 className="text-xl font-semibold text-slate-800">
                  Verify your identity
                </h2>
              </div>

              <p className="text-sm text-slate-500 mb-6">
                {info || `Enter the ${OTP_LENGTH}-digit code we emailed you.`}
              </p>

              <form onSubmit={handleOtpSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="text-sm text-slate-600">
                    Verification code
                  </label>
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={OTP_LENGTH}
                    className="w-full mt-1 px-4 py-3 border border-slate-300 rounded-lg text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#D89B00]"
                    placeholder={"•".repeat(OTP_LENGTH)}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
                    }
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== OTP_LENGTH}
                  className="w-full bg-[#D89B00] hover:bg-[#C58A00] text-white py-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  <ShieldCheck size={18} />
                  {loading ? "Verifying..." : "Verify & Continue"}
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="w-full text-sm text-[#D89B00] hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed py-1"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-400 mt-6">
          Company Management System
        </p>
      </div>
    </div>
  );
}
