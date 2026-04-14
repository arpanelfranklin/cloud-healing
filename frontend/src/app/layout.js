import './globals.css';
import Sidebar  from '@/components/Sidebar';
import TopBar   from '@/components/TopBar';
import { RealtimeProvider } from '@/context/RealtimeContext';

export const metadata = {
  title: 'SelfHeal — Cloud Infrastructure Platform',
  description: 'AI-powered self-healing cloud infrastructure monitoring platform.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <RealtimeProvider>
          <div className="shell">
            <Sidebar />
            <div className="shell-main">
              <TopBar />
              <main className="page-content">
                {children}
              </main>
            </div>
          </div>
        </RealtimeProvider>
      </body>
    </html>
  );
}
