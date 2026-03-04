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
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-4">
        <h3 className="font-semibold">Assinatura digital consultora</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div>
            <div className="h-24 border border-dashed border-base-300 rounded-lg bg-base-200/50"></div>
            <div className="mt-2">
              <p className="text-xs text-base-content/60">Nome da consultora</p>
              <p className="font-medium">{nomeConsultora || '-'}</p>
            </div>
          </div>
          <div className="form-control">
            <div className="h-24 border border-dashed border-base-300 rounded-lg bg-base-200/50"></div>
            <label className="label py-1">
              <span className="label-text">Responsável</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
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
