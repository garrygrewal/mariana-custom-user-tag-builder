import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@xplortech/apollo-core/build/style.css';
import '@xplortech/apollo-core/dist/esm/apollo-core.js';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
