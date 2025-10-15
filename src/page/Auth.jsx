import React, { useState, useEffect } from "react";
import logoIcon from "../assets/logo1.png";

const Auth = ({ onLogin }) => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.body.classList.add("login");
    // Load remembered credentials
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    const rememberedPassword = localStorage.getItem("rememberedPassword");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
    if (rememberedPassword) {
      setPassword(rememberedPassword);
    }

    return () => document.body.classList.remove("login");
  }, []);

  const handleAuth = async () => {
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await window.authAPI.login(email, password);
        if (res.error) throw new Error(res.error);

        // Remember credentials if checked
        if (rememberMe) {
          localStorage.setItem("rememberedEmail", email);
          localStorage.setItem("rememberedPassword", password);
        } else {
          localStorage.removeItem("rememberedEmail");
          localStorage.removeItem("rememberedPassword");
        }

        if (res.user) onLogin(res.user);
      } else {
        if (password !== confirmPassword)
          throw new Error("Passwords do not match");
        const res = await window.authAPI.signup(email, password);
        if (res.error) throw new Error(res.error);
        alert("Signup successful! Please log in.");
        setMode("login");
      }
    } catch (err) {
      const message =
        err?.message ||
        String(err) ||
        `${mode === "login" ? "Login" : "Signup"} failed`;
      window.toast(message, "error");
      console.error(`${mode} error:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loginContainer">
      <div className="loginLogo">
        <img src={logoIcon} className="logoIcon" alt="logoIcon" />
      </div>

      <h2>{mode === "login" ? "Log In" : "Create Account"}</h2>

      <label htmlFor="email">
        EMAIL <span className="required">*</span>
      </label>
      <input
        type="email"
        id="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <label htmlFor="password">
        PASSWORD <span className="required">*</span>
      </label>
      <input
        type="password"
        id="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {mode === "signup" && (
        <>
          <label htmlFor="confirmPassword">
            CONFIRM PASSWORD <span className="required">*</span>
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </>
      )}

      <div
        className="rememberMe"
        style={{ visibility: mode === "login" ? "visible" : "hidden" }}
      >
        <input
          type="checkbox"
          id="rememberMe"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        <label htmlFor="rememberMe">Remember me</label>
      </div>

      {mode === "login" && (
        <div className="forgot">
          <a href="#">Forgot your password?</a>
        </div>
      )}

      <button
        className="loginButton"
        onClick={handleAuth}
        disabled={loading}
      >
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
            <a
              className="registerLink"
              href="#"
              onClick={() => setMode("signup")}
            >
              Register
            </a>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <a
              className="registerLink"
              href="#"
              onClick={() => setMode("login")}
            >
              Log In
            </a>
          </>
        )}
      </div>
    </div>
  );
};

export default Auth;