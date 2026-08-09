export default function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <p className="font-medium text-foreground">{title}</p>
      {subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{subtitle}</p>}
    </div>
  );
}