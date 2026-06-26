import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import TenantLoginPage from './components/TenantLoginPage';
import AdminLoginPage from './components/AdminLoginPage';
import PropertyManagerLoginPage from './components/PropertyManagerLoginPage';
import PropertyManagerView from './components/PropertyManagerView';
import LeaseSigningPage from './components/LeaseSigningPage';
import ShortStaysPublicPage from './components/ShortStaysPublicPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/short-stays/:propertyId" element={<ShortStaysPublicPage />} />
        <Route path="/short-stays" element={<ShortStaysPublicPage />} />
        <Route path="/tenant" element={<TenantLoginPage />} />
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route path="/manager/login" element={<PropertyManagerLoginPage />} />
        <Route path="/manager" element={<PropertyManagerView />} />
        <Route path="/sign-lease" element={<LeaseSigningPage />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);