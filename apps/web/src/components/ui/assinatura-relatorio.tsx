interface AssinaturaRelatorioProps {
  nomeConsultora: string;
  onChangeNomeConsultora: (nome: string) => void;
}

export function AssinaturaRelatorio({
  nomeConsultora,
  onChangeNomeConsultora,
}: AssinaturaRelatorioProps) {
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-4">
        <h3 className="font-semibold">Assinatura digital consultora</h3>
        <div className="mt-4 h-24 border border-dashed border-base-300 rounded-lg bg-base-200/50"></div>
        <div className="mt-4 form-control">
          <label className="label py-0">
            <span className="label-text">Nome da consultora</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            value={nomeConsultora}
            onChange={(event) => onChangeNomeConsultora(event.target.value)}
            placeholder="Nome completo da consultora"
          />
        </div>
      </div>
    </div>
  );
}
