'use client';

import { useEffect } from 'react';
import { WaiterDashboard } from '@/components/waiter-dashboard';

export default function Home() {
  useEffect(() => {
    // Enable dark mode by default
    document.documentElement.classList.add('dark');
  }, []);

  return <WaiterDashboard waiterName="Jordan" shiftHours={[3, 34, 28]} />;
}
