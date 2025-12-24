'use client';

import dynamic from 'next/dynamic';

const TossBox = dynamic(() => import('@/components/TossBox'), {
  ssr: false,
});

export default function Home() {
  return <TossBox />;
}
