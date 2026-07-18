import { z } from "zod";

// ---- shared enums ----------------------------------------------------------

export const ClaimCategory = z.enum(["traction", "revenue", "team", "market", "product", "funding", "other"]);
export const ClaimStatus = z.enum(["verified", "unverified", "contradicted", "unverifiable"]);
export const Confidence = z.enum(["high", "medium", "low"]);
export const AxisName = z.enum(["founder", "market", "idea_market"]);
export const AxisVerdict = z.enum(["bullish", "neutral", "bear"]);

// ---- pipeline stage outputs ------------------------------------------------

export const ExtractionSchema = z.object({
  company_name: z.string(),
  one_liner: z.string(),
  sector: z.string(),
  geo: z.string(),
  stage: z.string(),
  tags: z.array(z.string()),
  founder: z.object({
    name: z.string(),
    email: z.string().nullable(),
    links: z.array(z.string()),
    background_summary: z.string(),
  }),
  claims: z.array(
    z.object({
      text: z.string(),
      category: ClaimCategory,
      source_ref: z.string(),
    }),
  ),
  not_disclosed: z.array(z.string()),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export const DedupSchema = z.object({ same_person: z.boolean(), reason: z.string() });

export const ScreenSchema = z.object({ pass: z.boolean(), reason: z.string() });
export type Screen = z.infer<typeof ScreenSchema>;

export const VerificationSchema = z.object({
  verdicts: z.array(
    z.object({
      claim_id: z.number().int(),
      status: ClaimStatus,
      supporting_evidence_ids: z.array(z.number().int()),
      contradicting_evidence_ids: z.array(z.number().int()),
      note: z.string(),
    }),
  ),
});

export const AxesSchema = z.object({
  axes: z.array(
    z.object({
      axis: AxisName,
      verdict: AxisVerdict,
      score: z.number(),
      confidence: Confidence,
      rationale: z.string(),
      evidence_ids: z.array(z.number().int()),
    }),
  ),
});

export const FounderComponentName = z.enum([
  "execution_track_record",
  "technical_depth",
  "domain_insight",
  "learning_velocity",
  "external_validation",
]);

export const FounderScoreSchema = z.object({
  components: z.array(
    z.object({
      name: FounderComponentName,
      score_0_10: z.number(),
      confidence: Confidence,
      evidence_ids: z.array(z.number().int()),
      note: z.string(),
    }),
  ),
  rationale: z.string(),
});
export type FounderScoreOut = z.infer<typeof FounderScoreSchema>;

const CitedBullet = z.object({ text: z.string(), evidence_ids: z.array(z.number().int()) });

export const MemoSchema = z.object({
  company_snapshot: z.string(),
  investment_hypotheses: z.array(CitedBullet),
  swot: z.object({
    strengths: z.array(CitedBullet),
    weaknesses: z.array(CitedBullet),
    opportunities: z.array(CitedBullet),
    risks: z.array(CitedBullet),
  }),
  problem_and_product: z.string(),
  traction_and_kpis: z.array(CitedBullet),
  key_unknowns: z.array(z.string()),
});
export type Memo = z.infer<typeof MemoSchema>;

export const RecommendationSchema = z.object({
  verdict: z.enum(["invest", "watch", "pass"]),
  check_size_usd: z.number().nullable(),
  confidence: Confidence,
  rationale: z.string(),
  diligence_questions: z.array(z.string()),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const MemoAndRecommendationSchema = z.object({
  memo: MemoSchema,
  recommendation: RecommendationSchema,
});

// ---- outbound sourcing -----------------------------------------------------

export const PlaysSchema = z.object({
  plays: z.array(
    z.object({
      title: z.string(),
      rationale: z.string(),
      queries: z.array(z.string()),
    }),
  ),
});
export type Plays = z.infer<typeof PlaysSchema>;

export const CandidatesSchema = z.object({
  candidates: z.array(
    z.object({
      founder_name: z.string(),
      company_name: z.string(),
      signal: z.string(),
      source_url: z.string(),
      sector: z.string(),
      geo: z.string(),
      summary: z.string(),
    }),
  ),
});

export const OutreachSchema = z.object({ subject: z.string(), body: z.string() });

// ---- natural-language query ------------------------------------------------

export const QueryFilterSchema = z.object({
  filters: z.object({
    sectors: z.array(z.string()),
    geos: z.array(z.string()),
    stages: z.array(z.string()),
    source: z.enum(["inbound", "outbound", "any"]),
    text_terms: z.array(z.string()),
  }),
  criteria: z.array(z.string()),
});
export type QueryFilter = z.infer<typeof QueryFilterSchema>;

export const RerankSchema = z.object({
  results: z.array(
    z.object({
      opportunity_id: z.number().int(),
      overall_fit: z.number(),
      criteria: z.array(
        z.object({
          criterion: z.string(),
          status: z.enum(["met", "not_met", "unknown"]),
          note: z.string(),
        }),
      ),
    }),
  ),
});
export type Rerank = z.infer<typeof RerankSchema>;
