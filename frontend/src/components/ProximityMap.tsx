'use client';

import dynamic from 'next/dynamic';

const ProximityMap = dynamic(() => import('@/components/ProximityMapInner'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '100%',
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

export default ProximityMap;
