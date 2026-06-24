export interface Facility {
  id: string;
  name: string;
  type: string;
  address: string | null;
  region_sido: string | null;
  region_sigungu: string | null;
  phone: string | null;
  capacity_total: number | null;
  capacity_current: number | null;
  external_urls: Record<string, string>;
  long_term_admin_sym: string | null;
  admin_pttn_cd: string | null;
}

export interface Evaluation {
  id: string;
  facility_id: string;
  source: string;
  eval_year: number;
  grade: string;
  domain_scores: Record<string, number>;
}

export interface ViolationRecord {
  id: string;
  facility_id: string | null;
  org_name_raw: string;
  violation_type: string | null;
  penalty: string | null;
  violation_date: string | null;
  source_url: string | null;
  match_confidence: number | null;
}

export interface ReviewRecord {
  id: string;
  facility_id: string;
  source: string;
  author_label: string | null;
  rating: number | null;
  content: string | null;
  review_date: string | null;
  source_url: string | null;
}

export interface RiskScore {
  facility_id: string;
  score: number;
  components: Record<string, number>;
  explanation: string[];
  computed_at: string;
}
