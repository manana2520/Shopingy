'use client';

import dynamic from 'next/dynamic';
import type { Mall } from '@/lib/types';

const MallMapInner = dynamic(() => import('@/components/MallMapInner'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F8FAFE',
        borderRadius: '12px',
        color: '#94A3B8',
      }}
    >
      Loading map...
    </div>
  ),
});

interface MallMapProps {
  malls: Mall[];
  height?: string;
}

export default function MallMap({ malls, height }: MallMapProps) {
  return <MallMapInner malls={malls} height={height} />;
}
