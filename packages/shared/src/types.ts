export type Papel = 'tecnico' | 'admin';
export type TipoManutencao = 'preventiva' | 'corretiva' | 'instalacao' | 'limpeza';

export interface Cliente {
  id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  endereco: string | null;
}

export interface Equipamento {
  id: string;
  codigo: string;
  cliente_id: string;
  local_instalacao: string | null;
  marca: string;
  modelo: string | null;
  btus: number | null;
  numero_serie: string | null;
  data_instalacao: string | null;
  periodicidade_dias: number;
  ativo: boolean;
}

export interface EquipamentoStatus extends Equipamento {
  ultima_manutencao: string | null;
  proxima_manutencao: string | null;
}

export type Checklist = Record<string, boolean>;

export interface Manutencao {
  id: string;
  equipamento_id: string;
  tecnico_id: string;
  tipo: TipoManutencao;
  checklist: Checklist;
  tecnico_nome: string;
  servico: string;
  observacoes: string | null;
  fotos: string[];
  executada_em: string;
  cancelada_em: string | null;
  cancelada_motivo: string | null;
  editada_em: string | null;
}

export interface EdicaoEquipamento { modelo: string | null; local_instalacao: string | null }

export const ITENS_CHECKLIST: { chave: string; rotulo: string }[] = [
  { chave: 'filtros_limpos', rotulo: 'Filtros limpos' },
  { chave: 'serpentina_evaporadora', rotulo: 'Serpentina evaporadora higienizada' },
  { chave: 'serpentina_condensadora', rotulo: 'Serpentina condensadora limpa' },
  { chave: 'dreno_desobstruido', rotulo: 'Dreno desobstruído' },
  { chave: 'pressao_gas', rotulo: 'Pressão do gás verificada' },
  { chave: 'corrente_eletrica', rotulo: 'Corrente elétrica verificada' },
  { chave: 'ruidos_vibracoes', rotulo: 'Sem ruídos ou vibrações anormais' },
  { chave: 'controle_remoto', rotulo: 'Controle remoto funcionando' },
];
