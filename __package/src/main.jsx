import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import ResumeParser from "./app/resume-parser/page.tsx";
import '../styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/resume-parser" element={<ResumeParser />} />
      </Routes>
    </HashRouter>
  </StrictMode>
);