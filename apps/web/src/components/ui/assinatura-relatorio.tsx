interface AssinaturaRelatorioProps {
  nomeConsultora: string;
}

export function AssinaturaRelatorio({
  nomeConsultora,
}: AssinaturaRelatorioProps) {
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-4">
        <h3 className="font-semibold">Assinatura digital consultora</h3>
        <div className="mt-4 h-24 border border-dashed border-base-300 rounded-lg bg-base-200/50"></div>
        <div className="mt-4">
          <p className="text-xs text-base-content/60">Nome da consultora</p>
          <p className="font-medium">{nomeConsultora || '-'}</p>
        </div>
      </div>
    </div>
  );
}
