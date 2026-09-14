import React from 'react';

export function ChestIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M4 11V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V11" />
      <path d="M4 11C4 8.79086 5.79086 7 8 7H16C18.2091 7 20 8.79086 20 11V11" />
      <path d="M4 11H20" />
      <path d="M12 11V13" />
      <path d="M11 13H13V15H11V13Z" fill="currentColor" />
      <path d="M6 7V5C6 4.44772 6.44772 4 7 4H17C17.5523 4 18 4.44772 18 5V7" strokeDasharray="2 2" />
    </svg>
  );
}

export function CrewIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      {/* Etched marks */}
      <path d="M7 6L8 5" strokeWidth="1" />
      <path d="M10 6L11 5" strokeWidth="1" />
      <path d="M17 5L18 4" strokeWidth="1" />
    </svg>
  );
}

export function CompassIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      {/* Etched ticks */}
      <path d="M12 2V4M12 20V22M2 12H4M20 12H22" strokeWidth="1.5" />
      <path d="M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" strokeWidth="1" />
    </svg>
  );
}

export function HourglassIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
      {/* Sand */}
      <path d="M9 19h6v3H9z" fill="currentColor" stroke="none" />
      <path d="M12 12v7" strokeDasharray="1 2" strokeWidth="1" />
    </svg>
  );
}

export function KeyIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      <circle cx="7.5" cy="15.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
