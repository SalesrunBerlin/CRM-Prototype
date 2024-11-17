export interface DynamicField {
  key: string;
  type: string;
  label: string;
  required?: boolean;
}

export interface ObjectRelation {
  sourceId: number;
  targetId: number;
  type: string;
}
