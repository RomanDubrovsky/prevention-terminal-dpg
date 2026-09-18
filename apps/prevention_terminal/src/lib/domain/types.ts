export interface DomainProtocolOption {
  id: string;
  label: string;
  hint?: string;
}

export interface DomainPrompts {
  /** Prompt for the primary formal psychological conclusion (e.g. 025/у or Psychological Report) */
  conclusion: string;
  /** Prompt for the multi-disciplinary team review (e.g. ППк or MDR) */
  mdr: string;
}

export interface DomainLabels {
  /** Label for the primary formal psychological conclusion (e.g. "025/у" or "Psychological Report") */
  conclusion: string;
  /** Label for the multi-disciplinary team review (e.g. "ППк" or "MDR") */
  mdr: string;
  /** Label for functional behavioral assessment */
  fba: string;
  /** Label for behavioral intervention plan */
  bip: string;
  /** Label for characteristic/profile */
  child_profile: string;
  /** Label for audit */
  audit: string;
  /** Label for program audit */
  program_audit: string;
}

export interface DomainConfig {
  protocols: {
    caseExpertise: DomainProtocolOption[];
    iprExpertise: DomainProtocolOption[];
  };
  aiPrompts: DomainPrompts;
  labels: DomainLabels;
}
