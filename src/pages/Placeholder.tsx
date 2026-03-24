interface Props {
  title: string;
}

export function Placeholder({ title }: Props) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">{title}</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Próximamente</p>
      </div>
    </div>
  );
}
