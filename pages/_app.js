// pages/_app.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const publicPaths = ['/login'];

  useEffect(() => {
    // Sólo en cliente
    if (typeof window === 'undefined') return;

    const center = localStorage.getItem('active_center');
    if (!center && !publicPaths.includes(router.pathname)) {
      router.replace('/login');
    } else if (center && router.pathname === '/login') {
      router.replace('/');
    }
  }, [router]);

  return <Component {...pageProps} />;
}
