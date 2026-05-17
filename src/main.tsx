import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installNetworkSync } from './lib/online';
import './index.css';

installNetworkSync();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


