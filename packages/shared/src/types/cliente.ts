export interface Cliente {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  email?: string;
  telefone: string;
  tipoAtividade: string;
  responsavelTecnico?: string;
  ativo: boolean;
  gestorId?: string;
  logoUrl?: string | null;
  unidades: Unidade[];
}

export interface Unidade {
  id: string;
  nome: string;
  endereco: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
  raioGeofencing: number;
  responsavel: string;
  telefone?: string;
  email: string;
  whatsapp?: string;
  ativo: boolean;
  clienteId: string;
}
