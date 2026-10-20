interface AssinaturaRelatorioProps {
  nomeConsultora: string;
  responsavel: string;
  onChangeResponsavel: (valor: string) => void;
  somenteLeitura?: boolean;
}

export function AssinaturaRelatorio({
  nomeConsultora,
  responsavel,
  onChangeResponsavel,
  somenteLeitura = false,
}: AssinaturaRelatorioProps) {
  return (
    <div className="relative flex flex-col rounded-lg border border-border bg-card">
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold">Assinatura digital consultora</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div>
            <div className="h-24 border border-dashed border-border rounded-lg bg-muted/50"></div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">Nome da consultora</p>
              <p className="font-medium">{nomeConsultora || '-'}</p>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="h-24 border border-dashed border-border rounded-lg bg-muted/50"></div>
            <label className="flex items-center justify-between gap-2 py-1">
              <span className="text-sm font-medium text-foreground">Responsável</span>
            </label>
            <input
              type="text"
              className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
              value={responsavel}
              onChange={(event) => onChangeResponsavel(event.target.value)}
              placeholder="Informe o responsável"
              disabled={somenteLeitura}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
