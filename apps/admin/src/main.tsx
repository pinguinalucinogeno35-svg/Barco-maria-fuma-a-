import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@ac/shared';
import '@ac/shared/src/estilo.css';
import { sb } from './env';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider sb={sb}><BrowserRouter><App /></BrowserRouter></AuthProvider>
  </StrictMode>,
);
