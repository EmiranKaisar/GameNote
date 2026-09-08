import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewPlayer } from '@/components/review-player';
import '@/app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReviewPlayer />
  </StrictMode>,
);
