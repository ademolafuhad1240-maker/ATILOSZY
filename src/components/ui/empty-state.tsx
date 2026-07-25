interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h3 className="text-2xl font-bold mb-2 text-charcoal">{title}</h3>
      {description && <p className="text-text-muted mb-6">{description}</p>}
      {action && action}
    </div>
  );
}
