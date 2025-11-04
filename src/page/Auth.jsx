import React, { useState, useEffect } from "react";
import logoIcon from "../assets/logo1.png";
import Background from "../assets/BG.jpg";

const Auth = ({ onLogin }) => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  // const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.body.classList.add("login");
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    return () => document.body.classList.remove("login");
  }, []);

  const handleAuth = async () => {
    if (!email || !password) {
      window.toast?.("Please enter your email and password.", "error");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const res = await window.authAPI.login(email, password);
        if (res.error) throw new Error(res.error);

        await window.authAPI.setSession(res.session);

        if (res.user) onLogin(res.user);

      } else {
        if (password !== confirmPassword) throw new Error("Passwords do not match");

        const res = await window.authAPI.signup(email, password);
        if (res.error) throw new Error(res.error);

        window.toast?.("Signup successful! Please log in.", "success");
        setMode("login");
      }
    } catch (err) {
      const message = err?.message || String(err) || `${mode === "login" ? "Login" : "Signup"} failed`;
      window.toast?.(message, "error");
      console.error(`${mode} error:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authContainer" style={{ backgroundImage: `url(${Background})` }}>
      <div className="loginContainer">
        <div className="loginLogo">
          <img src={logoIcon} className="logoIcon" alt="logoIcon" />
        </div>
        <h2>{mode === "login" ? "Log In" : "Create Account"}</h2>

        <label htmlFor="email">EMAIL <span className="required">*</span></label>
        <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label htmlFor="password">PASSWORD <span className="required">*</span></label>
        <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {mode === "signup" && (
          <>
            <label htmlFor="confirmPassword">CONFIRM PASSWORD <span className="required">*</span></label>
            <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </>
        )}

        {mode === "login" && (
          <>
            <div className="loginOptions">
              <div className="rememberMe">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="rememberMe">Remember my email</label>
              </div>
            </div>

            <div className="forgot">
              <a href="#">Forgot your password?</a>
            </div>
          </>
        )}

        <button className="loginButton" onClick={handleAuth} disabled={loading}>
          {loading
            ? mode === "login"
              ? "Logging in..."
              : "Signing up..."
            : mode === "login"
              ? "Log In"
              : "Sign Up"}
        </button>

        <div className="register">
          {mode === "login" ? (
            <>
              Need an account?{" "}
              <a className="registerLink" href="#" onClick={() => setMode("signup")}>
                Register
              </a>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <a className="registerLink" href="#" onClick={() => setMode("login")}>
                Log In
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;