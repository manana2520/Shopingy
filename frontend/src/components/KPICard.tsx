'use client';

import { useEffect, useState } from 'react';

interface KPICardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  suffix?: string;
}

export function KPICard({ label, value, icon, suffix }: KPICardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }

    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * value));

      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value]);

  const formattedValue = displayValue.toLocaleString();

  return (
    <div className="kpi-card flex items-center gap-4">
      <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
           style={{ background: 'rgba(62, 168, 255, 0.1)', color: '#3EA8FF' }}>
        {icon}
      </div>
      <div>
        <div className="text-3xl font-bold" style={{ color: '#1A1A2E' }}>
          {formattedValue}{suffix && <span className="text-lg ml-1">{suffix}</span>}
        </div>
        <div className="text-sm mt-0.5" style={{ color: '#64748B' }}>
          {label}
        </div>
      </div>
    </div>
  );
}
