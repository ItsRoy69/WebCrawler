export function FlameMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.2 2.2c.4 2.4-.3 4.2-1.6 5.8-1.2 1.5-1.8 2.7-1.5 4.2.2.9.8 1.7 1.6 2.2-2.1-.2-3.7-1.8-4.2-3.9-.6 2.2.1 4.6 1.8 6.2 1.7 1.6 4 2.4 6.3 2.1 2.6-.3 4.8-2.2 5.6-4.7.8-2.5.2-5.2-1.5-7.2-1.1 1.6-1.3 3.6-.4 5.4-.2-3.1-1.8-5.7-4.1-7.4-.7-.5-1.6-1.5-2-2.7z" />
    </svg>
  );
}
