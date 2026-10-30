export type Role = 'fundador' | 'inversor' | 'empleado' | 'pool';

export interface Holder {
  id: string;
  name: string;
  role: Role;
}

/** Clase de participaciones. Las series de inversión llevan preferencia de liquidación. */
export interface ShareClass {
  id: string;
  name: string;
  /** Votos por participación (0 = sin voto). El voto plural de fundadores se aplica aparte. */
  votesPerShare: number;
  /** Múltiplo de preferencia de liquidación (0 = ordinaria). */
  liqMultiple: number;
  participating: boolean;
  /** Precio de emisión usado para calcular la preferencia. */
  issuePrice: number;
  /** Orden de creación, para mostrar las series cronológicamente. */
  order: number;
}

export interface Incorporation {
  id: string;
  type: 'constitucion';
  name: string;
  date: string;
  holdings: { holderId: string; shares: number }[];
}

export interface ConvertibleNote {
  id: string;
  type: 'nota';
  name: string;
  date: string;
  holderId: string;
  amount: number;
  /** Descuento sobre el precio de la ronda (0..1). */
  discount: number;
  /** Valoración máxima pre-money a efectos de conversión (0 = sin cap). */
  cap: number;
}

export interface Round {
  id: string;
  type: 'ronda';
  name: string;
  date: string;
  preMoney: number;
  investments: { holderId: string; amount: number }[];
  /** Tamaño objetivo del pool sobre el post-money (0..1). */
  poolTargetPct: number;
  /** 'pre': el pool se amplía antes de la ronda y diluye solo a los socios actuales. */
  poolTiming: 'pre' | 'post';
  liqMultiple: number;
  participating: boolean;
}

export type SaleStructure = 'ordinarias' | 'sinVoto';

export interface Secondary {
  id: string;
  type: 'secundaria';
  name: string;
  date: string;
  sellers: { holderId: string; shares: number }[];
  buyerId: string;
  pricePerShare: number;
  structure: SaleStructure;
}

export type CapEvent = Incorporation | ConvertibleNote | Round | Secondary;

export interface VetoMatter {
  id: string;
  name: string;
  /** Porcentaje de votos necesario para aprobar la materia (0..1). */
  threshold: number;
}

export interface Governance {
  /** Votos por cada participación ordinaria de fundador (1 = sin voto plural). */
  votoPlural: number;
  /** Pacto de sindicación: los fundadores votan como bloque. */
  sindicacion: boolean;
  vetoMatters: VetoMatter[];
}

export interface VestingPlan {
  holderId: string;
  months: number;
  cliffMonths: number;
  start: string;
}

export interface Scenario {
  id: string;
  name: string;
  company: string;
  holders: Holder[];
  events: CapEvent[];
  governance: Governance;
  vesting: VestingPlan[];
}

/** Participaciones por titular y clase: clave `${holderId}|${classId}`. */
export type Holdings = Record<string, number>;

export interface Snapshot {
  eventId: string;
  label: string;
  holdings: Holdings;
  classes: Record<string, ShareClass>;
  pricePerShare?: number;
  postMoney?: number;
}

export interface StepResult {
  eventId: string;
  pricePerShare?: number;
  postMoney?: number;
  newInvestorShares?: number;
  newPoolShares?: number;
  conversions?: { noteId: string; holderId: string; shares: number; price: number }[];
  sold?: number;
  proceeds?: number;
  warnings: string[];
}

export interface CapRow {
  holderId: string;
  shares: number;
  econPct: number;
  votes: number;
  votePct: number;
  byClass: Record<string, number>;
}
