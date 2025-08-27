import React, { useState, useEffect } from "react";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    document.body.classList.add("login");
    return () => {
      document.body.classList.remove("login");
    };
  }, []);

  const loginAuth = async () => {
    try {
      const user = await window.fileAPI.getUser(username, password);

      if (user) {
        localStorage.setItem("userId", user.userid);
        onLogin(user.userid);
      } else {
        alert("Invalid username or password");
      }
    } catch (err) {
      console.error("Login failed:", err);
      alert("Login error, please try again.");
    }
  };

  return (
    <div className="loginContainer">
      <div className="loginLogo">LOGO</div>

      <label htmlFor="email">
        USERNAME <span className="required">*</span>
      </label>
      <input
        type="text"
        id="username"
        name="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      <label htmlFor="password">
        PASSWORD <span className="required">*</span>
      </label>
      <input
        type="password"
        id="password"
        name="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <div className="forgot">
        <a href="#">Forgot your password?</a>
      </div>

      <button className="loginButton" onClick={loginAuth}>
        Log In
      </button>

      <div className="register">
        Need an account? <a className="registerLink" href="#">Register</a>
      </div>
    </div>
  );
};

export default Login;
