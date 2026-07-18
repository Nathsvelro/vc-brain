/**
 * Deterministic demo corpus for The VC Brain.
 *
 * Each seed carries the pitch-deck text that goes into `opportunities.deck_text`
 * plus the synthetic Tavily fixtures that get preloaded into `tavily_cache`, so
 * the whole demo pipeline runs offline-deterministic (zero live Tavily calls).
 *
 * Every company, person, publication, and URL below is FICTIONAL. All fixture
 * domains use the reserved `.example` TLD.
 *
 * The query templates mirror lib/pipeline/enrich.ts EXACTLY:
 *   founder_company : "NAME" "COMPANY"
 *   funding         : "COMPANY" funding OR revenue OR traction OR customers
 *   competitors     : "COMPANY" competitors alternative
 *   github          : "NAME" github
 */

/** Mirrors TavilyResult in lib/tavily.ts — declared locally so importing the
 *  corpus never touches the better-sqlite3 database singleton. */
export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export type QueryTemplate = "founder_company" | "funding" | "competitors" | "github";

export const ALL_TEMPLATES: QueryTemplate[] = ["founder_company", "funding", "competitors", "github"];

export interface SeedFixture {
  queryTemplate: QueryTemplate;
  results: TavilyResult[];
}

export interface SeedDefinition {
  companyName: string;
  founderName: string;
  deckText: string;
  sourceType: "inbound" | "outbound";
  sourceSignal?: string;
  fixtures: SeedFixture[];
}

/** Compute the exact query string enrich.ts will issue for a template. */
export function fixtureQuery(
  seed: Pick<SeedDefinition, "companyName" | "founderName">,
  template: QueryTemplate,
): string {
  switch (template) {
    case "founder_company":
      return `"${seed.founderName}" "${seed.companyName}"`;
    case "funding":
      return `"${seed.companyName}" funding OR revenue OR traction OR customers`;
    case "competitors":
      return `"${seed.companyName}" competitors alternative`;
    case "github":
      return `"${seed.founderName}" github`;
  }
}

// ---------------------------------------------------------------------------
// Extra seed: Priya Sharma's FAILED first venture (2024), seeded first and
// backdated by the seed script. Not part of the 7-seed demo array.
// ---------------------------------------------------------------------------

export const MESHCART_SEED: SeedDefinition = {
  companyName: "MeshCart",
  founderName: "Priya Sharma",
  sourceType: "inbound",
  deckText: `MeshCart — pre-seed application (deck text export)

Problem
Students and young renters overpay for household basics because they buy single units at the corner store. Bulk prices exist, but nobody wants 48 rolls of paper towel in a dorm room, and coordinating a group order over group chat dies at the payment step.

Product
MeshCart is a social commerce app where a dorm floor, a building, or a friend group pools orders into one bulk purchase and splits the savings automatically. Anyone can start a "mesh", share the link, and watch the price tick down as neighbours join. We handle payment splitting, the bulk order itself, and pickup-point coordination.

Team
Founder: Priya Sharma (Toronto). Former product manager who taught herself mobile development to ship the first version single-handedly. One part-time contract developer.

Traction
- 2,100-person waitlist across four campuses within six weeks.
- 11 app releases shipped in 7 months of building.
- 38 signed campus ambassadors.
- First live pilot: 120 completed orders in a two-week test at one residence.

Market
Start with campuses, then apartment buildings and young-professional house shares. Group buying is proven at massive scale abroad; the last-mile social layer for North American cities is unclaimed.

Ask
Pre-seed to hire one engineer, run paid pilots at ten campuses, and prove repeat-order economics ahead of a seed round.`,
  fixtures: [
    {
      queryTemplate: "founder_company",
      results: [
        {
          title: "Why we're shutting down MeshCart",
          url: "https://foundersfieldnotes.example/priya-sharma/meshcart-postmortem",
          content:
            "Priya Sharma's postmortem on MeshCart, her social group-buying app: 'We mistook a viral waitlist for demand. 2,100 signups produced fewer than 200 active buyers, and the unit economics of coordinating bulk deliveries never worked below a density we could not reach.' She details shipping 11 releases in seven months, why retention collapsed after the novelty faded, and confirms the company returned its remaining angel capital before winding down in 2024.",
          score: 0.96,
        },
        {
          title: "The most honest startup shutdown postmortems we read this year",
          url: "https://postmortemweekly.example/2024-roundup",
          content:
            "Our 2024 roundup of founder postmortems. Top of the list: MeshCart founder Priya Sharma's shutdown letter, widely shared for its unusual candour — no blame on the market, a precise accounting of what the team got wrong, and a clear-eyed read on why viral waitlists are not demand. Several investors told us it was the rare postmortem that made them MORE likely to back the founder next time.",
          score: 0.9,
        },
      ],
    },
    {
      queryTemplate: "funding",
      results: [
        {
          title: "MeshCart winds down after 14 months",
          url: "https://northloopnews.example/meshcart-winds-down",
          content:
            "Toronto social-commerce startup MeshCart has shut down after roughly 14 months of operation. The company, founded by Priya Sharma, had raised approximately $150K in angel funding and piloted group bulk-buying at several Ontario campuses. Sharma announced the wind-down in a public postmortem and said remaining funds were returned to investors.",
          score: 0.88,
        },
      ],
    },
    { queryTemplate: "competitors", results: [] },
    { queryTemplate: "github", results: [] },
  ],
};

// ---------------------------------------------------------------------------
// The 7 demo seeds
// ---------------------------------------------------------------------------

export const SEED_CORPUS: SeedDefinition[] = [
  // 1. NeuraForge — the clear-yes / verified-claims / NL-query demo -----------
  {
    companyName: "NeuraForge",
    founderName: "Lena Vogel",
    sourceType: "inbound",
    deckText: `NeuraForge — pre-seed application (deck text export)

Problem
Mid-size AI teams that run their own GPU clusters waste 30-50% of the capacity they pay for. Schedulers designed for CPU-era batch jobs fragment GPU memory, strand interactive notebooks on eight-GPU nodes, and give ML engineers no safe way to share a machine. Every team we interviewed had one senior engineer effectively babysitting a utilization dashboard instead of shipping.

Product
kilnd is an open-source GPU orchestration daemon that sits between the cluster and the workload. It bin-packs jobs by actual GPU-memory profile rather than requested whole devices, checkpoints and migrates low-priority jobs when a training run needs headroom, and exposes a single CLI that feels like a package manager, not a control plane. It installs on an existing cluster in under ten minutes with no changes to training code.

Team
Solo technical founder: Lena Vogel (Berlin). Seven years as an embedded systems engineer building real-time firmware for industrial robotics at Bergwerk Dynamics — scheduling scarce compute under hard constraints is the same problem, one layer down. Built kilnd nights and weekends until the hackathon win made it obvious this should be a company. No prior venture backing.

Traction
- Won the infrastructure track at HackBerlin 2026 with the first public demo of kilnd.
- 1.2k GitHub stars on the kilnd repository within nine weeks of launch.
- 3 design partners (Voltaic Labs, Renderpath GmbH, Mistfall Compute) running kilnd on production clusters — roughly 220 GPUs combined.
- No revenue yet by design: open core first, paid multi-cluster control plane next.

Market
Every company that owns or rents dedicated GPUs is a prospect. Utilization tooling is adopted bottom-up by the engineers who feel the pain daily, then bought top-down when the savings show up on the cloud bill.

Ask
Pre-seed. Raising a small round to go full-time, land ten more design partners, and ship the paid multi-cluster control plane.`,
    fixtures: [
      {
        queryTemplate: "founder_company",
        results: [
          {
            title: "NeuraForge comes out of stealth with kilnd, an open-source GPU scheduler born at a Berlin hackathon",
            url: "https://techdispatch.example/2026/neuraforge-kilnd-launch",
            content:
              "Berlin-based NeuraForge has open-sourced kilnd, a GPU orchestration daemon that bin-packs workloads by real memory profile. Solo founder Lena Vogel, formerly an embedded systems engineer at industrial-robotics firm Bergwerk Dynamics, wrote the first version for the HackBerlin 2026 infrastructure track, which her team won. Three design partners — Voltaic Labs, Renderpath GmbH, and Mistfall Compute — are running kilnd on production clusters totalling around 220 GPUs.",
            score: 0.97,
          },
          {
            title: "From firmware to fleet schedulers: a conversation with NeuraForge's Lena Vogel",
            url: "https://berlinbuilds.example/interviews/lena-vogel",
            content:
              "Interview with Lena Vogel on leaving embedded engineering to build NeuraForge. She describes seven years of hard-real-time firmware work, why GPU scheduling is 'the same scarcity problem with better marketing', and her decision to keep kilnd open source while charging for a multi-cluster control plane. Vogel is bootstrapped and has not taken venture funding to date.",
            score: 0.9,
          },
        ],
      },
      {
        queryTemplate: "funding",
        results: [
          {
            title: "Open-source infra projects to watch this quarter",
            url: "https://osswatch.example/2026/q2-infra-roundup",
            content:
              "Fastest riser this quarter: kilnd, the GPU orchestration daemon from NeuraForge, which crossed 1,200 GitHub stars within nine weeks of its public launch. The project reports three named design partners running it in production. No funding has been announced; founder Lena Vogel says the company is pre-revenue by design while the open-core wedge matures.",
            score: 0.93,
          },
        ],
      },
      {
        queryTemplate: "competitors",
        results: [
          {
            title: "The GPU orchestration tooling landscape, 2026 edition",
            url: "https://stackreview.example/gpu-orchestration-2026",
            content:
              "Our annual review of GPU scheduling and utilization tools. Incumbents Quotaflow and HerdRunner dominate the enterprise segment with heavyweight control planes, while a new wave of open-source entrants competes on install speed and developer experience. Standout newcomer: NeuraForge's kilnd, praised by early users for ten-minute installs and memory-profile bin-packing, though it lacks multi-cluster features the incumbents ship today.",
            score: 0.86,
          },
        ],
      },
      {
        queryTemplate: "github",
        results: [
          {
            title: "HackBerlin 2026 — official results",
            url: "https://hackberlin.example/2026/results",
            content:
              "HackBerlin 2026 results. Infrastructure track winner: team kilnd, led by Lena Vogel, for a GPU orchestration daemon that live-migrated training jobs during the demo. Judges' citation: 'the rare hackathon project that is already production-shaped'. 214 teams competed across five tracks.",
            score: 0.95,
          },
          {
            title: "Trending open-source this week: schedulers, samplers, and one very fast daemon",
            url: "https://osspulse.example/trending/2026-w19",
            content:
              "This week's trending repositories roundup: kilnd by Lena Vogel (NeuraForge) added over 400 stars in seven days following its HackBerlin win, passing the 1.2k mark. Contributors from three companies have landed patches, an early sign of real production use rather than star tourism.",
            score: 0.89,
          },
        ],
      },
    ],
  },

  // 2. QuantumLeap Analytics — the contradiction demo -------------------------
  {
    companyName: "QuantumLeap Analytics",
    founderName: "Marco Reyes",
    sourceType: "inbound",
    deckText: `QuantumLeap Analytics — seed application (deck text export)

Problem
B2B sales leaders still run the quarter out of spreadsheets. CRM data is stale by the time it reaches the forecast call, reps sandbag their commits, and finance finds out a deal slipped only after the quarter closes. Forecast misses are a board-level embarrassment that nobody has actually fixed.

Product
QuantumLeap connects to the CRM and call recordings, re-scores every open opportunity daily, and gives revenue leaders a live forecast with a per-deal "story vs. signal" gap: what the rep says versus what the activity data shows. Weekly digest, deal-risk alerts, and a one-click board slide.

Team
Founder and CEO: Marco Reyes (Austin, Texas). Eight years in sales operations, most recently owning the forecasting process for a 40-rep revenue organization. Supported by two contract engineers and a fractional designer.

Traction
- $50K MRR, growing roughly 20% month over month.
- 40 enterprise customers on annual contracts, including three Fortune-1000 logos.
- 97% gross logo retention since launch.
- Average sales cycle compressed to 21 days.

Market
Every B2B company with more than ten reps runs a forecast cadence. We land with the VP of Sales and expand into finance. The spreadsheet is the real competitor, and it is everywhere.

Ask
Raising a seed round to harden integrations, hire two account executives, and expand into revenue-operations analytics. A first check would make our founding engineer full-time.`,
    fixtures: [
      {
        queryTemplate: "founder_company",
        results: [
          {
            title: "QuantumLeap Analytics pitches AI pipeline forecasts for B2B sales teams",
            url: "https://atxstartupledger.example/quantumleap-analytics-profile",
            content:
              "Austin startup QuantumLeap Analytics, founded by former sales-operations manager Marco Reyes, sells an AI layer that re-scores CRM pipelines daily and flags at-risk deals. The product demos well and early users praise the 'story vs. signal' view. The company declined to share revenue figures or a customer count for this profile.",
            score: 0.9,
          },
        ],
      },
      {
        queryTemplate: "funding",
        results: [
          {
            title: "QuantumLeap Analytics is quietly raising — and its numbers don't match the pitch",
            url: "https://saasgrapevine.example/quantumleap-metrics-gap",
            content:
              "QuantumLeap Analytics has been shopping a seed round claiming rapid enterprise traction. Two sources with direct knowledge of the company's billing put monthly recurring revenue near $15K — not the $50K figure circulating in its deck — with roughly 12 paying customers, most on heavily discounted annual deals. One source disputed the '40 enterprise customers' figure outright, calling it 'trials plus logos from a pilot list'. The company did not respond to requests for comment.",
            score: 0.94,
          },
          {
            title: "Forum: Anyone still using QuantumLeap? We churned after one quarter",
            url: "https://revopsforum.example/t/quantumleap-churn-experience/4821",
            content:
              "Thread on a revenue-operations community forum. Original poster: 'We churned from QuantumLeap Analytics after three months — the CRM sync broke weekly and the forecast drifted from reality. When we evaluated, their site listed dozens of customers, but the references they could produce were the same two names. Felt inflated.' Several replies report similar onboarding problems; one user reports a good experience on a small team.",
            score: 0.87,
          },
        ],
      },
      {
        queryTemplate: "competitors",
        results: [
          {
            title: "Sales forecasting tools: a crowded shelf",
            url: "https://stackreview.example/sales-forecasting-tools-2026",
            content:
              "There are now more than thirty venture-backed vendors selling AI sales-forecast tooling, plus free tiers bundled into the major CRMs. Differentiation increasingly comes down to integration reliability and trust in the numbers, where several younger vendors have stumbled.",
            score: 0.82,
          },
        ],
      },
      { queryTemplate: "github", results: [] },
    ],
  },

  // 3. Willow & Sage Health — the cold-start demo -----------------------------
  {
    companyName: "Willow & Sage Health",
    founderName: "Amara Diallo",
    sourceType: "inbound",
    deckText: `Willow & Sage Health — pre-seed application (deck text export)

Problem
Publicly funded mental-health clinics triage every new referral by hand. A senior clinician reads free-text intake forms — often ten pages of physician notes, self-report questionnaires, and safeguarding history — and assigns a priority band. Backlogs mean referrals wait 8-14 weeks just to be triaged; urgent cases sit in the same queue as routine ones; and triage quality depends on who is on shift. It is the highest-stakes, least-supported hour of the clinical week.

Product
A triage copilot for clinic intake teams. It converts unstructured referrals into a consistent risk-and-need summary, drafts a suggested priority band with every supporting quote pinned to its source document, and flags safeguarding language a tired reader can miss. The clinician always decides; the copilot never contacts patients; and every suggestion carries a full provenance trail designed for clinical audit from day one.

Team
First-time solo founder: Amara Diallo (London). Six years as a research psychologist specialising in clinical assessment; self-taught engineer who built the working prototype alone over nine months. Left research after watching waiting-list position predict outcomes better than treatment choice did.

Traction
Working prototype demonstrated to intake teams at three clinics. Two clinics have signed letters of intent for supervised pilots, pending information-governance review. Deliberately no public launch, no press, and no open code yet — in a clinical setting, the pilot evidence has to come first.

Market
Thousands of publicly funded and charity-run clinics across the UK and Europe share the same intake bottleneck. The entry wedge is triage; the workflow expands naturally into waiting-list management and outcome tracking.

Ask
Pre-seed to run a six-month supervised pilot with an independent clinical-safety assessor and to hire a founding clinical engineer.`,
    // The cold-start demo: zero web footprint — every query deliberately empty.
    fixtures: [
      { queryTemplate: "founder_company", results: [] },
      { queryTemplate: "funding", results: [] },
      { queryTemplate: "competitors", results: [] },
      { queryTemplate: "github", results: [] },
    ],
  },

  // 4. Ledgerly — the returning-founder / score-goes-UP demo ------------------
  {
    companyName: "Ledgerly",
    founderName: "Priya Sharma",
    sourceType: "inbound",
    deckText: `Ledgerly — pre-seed application (deck text export)

Note from the founder
This is my second company. My first, MeshCart, shut down in 2024, and I wrote publicly about exactly why. Ledgerly is what I learned, applied to a problem with real invoices attached.

Problem
Independent restaurants receive 60-200 supplier invoices a month — on paper, in email attachments, in text-message photos. Owners key them into accounting software at midnight or pay a bookkeeper to do it weekly. The result: late fees, missed credits for short deliveries, and zero food-cost visibility until the month is already over.

Product
Ledgerly ingests invoices from any channel (photo, email forward, supplier portal), extracts line items with an accuracy loop tuned for food-service abbreviations, matches deliveries against orders, and pushes clean data into the accounting system. Owners see food cost per dish within days instead of months, and every discrepancy becomes a one-tap supplier claim.

Team
Founder: Priya Sharma (Toronto), second-time founder. MeshCart taught me to charge from day one, to sell before building, and to pick customers whose pain arrives weekly. Before writing any code I spent six weeks doing invoice entry by hand inside three restaurant back offices.

Traction
- MVP shipped six weeks after the first line of code.
- 8 pilot restaurants live in Toronto, processing roughly 1,400 invoices a month combined.
- 6 of the 8 pilots are paying ($149/month) — about $900 in MRR at time of writing.
- Two multi-location restaurant groups in trial conversations.

Market
Vertical AP automation for food service. Horizontal accounts-payable tools ignore operators below 50 locations; bookkeepers are expensive and slow. The wedge is invoices; the expansion is payments and supplier financing.

Ask
Pre-seed to hire a founding engineer and grow from 8 to 40 restaurants across the Greater Toronto Area.`,
    fixtures: [
      {
        queryTemplate: "founder_company",
        results: [
          {
            title: "Ledgerly is quietly digitizing invoices for Toronto kitchens",
            url: "https://torontotablestack.example/ledgerly-pilots",
            content:
              "Restaurant-tech newsletter item: Ledgerly, a new AP-automation tool built for independent restaurants, is running live pilots in Toronto. We confirmed deployments at five independent restaurants, with operators reporting invoice-entry time cut from hours to minutes; the company says the full pilot count is slightly higher. Founder Priya Sharma previously ran social-commerce startup MeshCart and wrote a widely shared postmortem after it shut down in 2024.",
            score: 0.92,
          },
        ],
      },
      {
        queryTemplate: "funding",
        results: [
          {
            title: "Second acts: MeshCart's Priya Sharma returns with Ledgerly",
            url: "https://northloopnews.example/priya-sharma-ledgerly",
            content:
              "A year after winding down MeshCart, Priya Sharma is back with Ledgerly, an invoice-automation product for restaurants. The company is pre-fundraise and reports a handful of paying pilot sites across Toronto restaurant groups. Local operators we spoke to said Sharma's candid MeshCart postmortem was a factor in agreeing to pilot: 'She told us exactly how she'd been wrong before. That buys trust.'",
            score: 0.9,
          },
        ],
      },
      {
        queryTemplate: "competitors",
        results: [
          {
            title: "AP automation: plenty of horizontal tools, few vertical winners",
            url: "https://stackreview.example/ap-automation-vertical-2026",
            content:
              "The accounts-payable automation category is crowded at the enterprise end, but horizontal vendors under-serve sub-50-location restaurant operators, whose invoices are messier and whose margins are thinner. Analysts see room for vertical wedges that own the food-service data model — if they can survive long enough to build supplier network effects.",
            score: 0.84,
          },
        ],
      },
      { queryTemplate: "github", results: [] },
    ],
  },

  // 5. TerraBloom Biotech — the off-thesis / filtered-at-screen demo ----------
  {
    companyName: "TerraBloom Biotech",
    founderName: "Chen Wei",
    sourceType: "inbound",
    deckText: `TerraBloom Biotech — Series A application (deck text export)

Problem
Decades of heavy chemical fertilizer use have degraded soil biology across Southeast Asia's rice and vegetable belts. Yields have plateaued while input costs climb, and regulators are tightening nitrogen-runoff rules season by season.

Product
TerraBloom develops soil-microbiome crop treatments: engineered consortia of nitrogen-fixing and phosphate-solubilizing microbes, delivered as a seed coating and a planting-time soil drench. Our lead product line has completed 14 field trials with an average yield lift of 9-14% alongside a 20% reduction in synthetic fertilizer input.

Team
Founder and CEO: Chen Wei (Singapore). PhD in microbial ecology and twelve years in agricultural R&D leadership. Team of nine, including four PhD scientists and a dedicated regulatory-affairs lead.

Traction
- 14 completed field trials across three countries over four growing seasons.
- Regulatory approval secured in two markets; filings pending in two more.
- $600K in pilot revenue through three agricultural distributors.
- Fermentation manufacturing partner identified for scale-up.

Market
Biologicals are the fastest-growing input category in agriculture, and Southeast Asia remains underserved by products validated in tropical soils rather than temperate test plots.

Ask
Raising a $12M Series A to scale fermentation manufacturing, complete pending registrations, and expand the distributor network across Southeast Asia.`,
    // Off-thesis (biotech, Series A, Singapore) — filtered at screen, so these
    // are never fetched; kept minimal on purpose.
    fixtures: [
      {
        queryTemplate: "founder_company",
        results: [
          {
            title: "TerraBloom Biotech reports multi-season field-trial results for microbial seed coatings",
            url: "https://agriresearchwire.example/terrabloom-field-trials",
            content:
              "Singapore-based TerraBloom Biotech, led by microbial ecologist Dr. Chen Wei, published summary results from 14 field trials of its soil-microbiome seed coatings, reporting yield lifts of 9-14% in tropical rice and vegetable plots.",
            score: 0.85,
          },
        ],
      },
      { queryTemplate: "funding", results: [] },
      { queryTemplate: "competitors", results: [] },
      { queryTemplate: "github", results: [] },
    ],
  },

  // 6. Parsec Robotics — the outbound-sourced / convergence-button demo -------
  {
    companyName: "Parsec Robotics",
    founderName: "Jonas Eriksson",
    sourceType: "outbound",
    sourceSignal: "Won the autonomy track at the Nordic Robotics Hackathon 2026; repo trended on GitHub",
    deckText: `Outbound-sourced candidate (not an application).
Founder: Jonas Eriksson
Company: Parsec Robotics
Sector: Robotics developer tools · Geo: Stockholm, Sweden
Summary: Parsec Robotics builds fleetmind, an open-source ROS-compatible toolkit for debugging warehouse-robot fleets. It records synchronized telemetry across every robot in a facility and lets engineers replay multi-robot incidents deterministically — the flight-recorder pattern applied to warehouse automation, where today's debugging is one engineer with four terminal windows guessing which robot lied. Jonas Eriksson was previously a robotics platform engineer at Fraktbot Systems, where he maintained internal fleet tooling for a deployment of roughly 300 robots before leaving to build the vendor-neutral version in the open. fleetmind won the autonomy track at the Nordic Robotics Hackathon 2026 and trended on GitHub the following week, adding around 900 stars.
Sourcing signal: Won the autonomy track at the Nordic Robotics Hackathon 2026; repo trended on GitHub
Source: https://nordicrobotics.example/2026/results`,
    fixtures: [
      {
        queryTemplate: "founder_company",
        results: [
          {
            title: "Nordic Robotics Hackathon 2026 — official results",
            url: "https://nordicrobotics.example/2026/results",
            content:
              "Nordic Robotics Hackathon 2026 results. Autonomy track winner: fleetmind by Jonas Eriksson (Parsec Robotics), a toolkit that records synchronized fleet telemetry and deterministically replays multi-robot incidents. Judges' note: 'It found a race condition in our own demo fleet during judging. That settled it.' 96 teams competed across four tracks in Stockholm.",
            score: 0.96,
          },
        ],
      },
      { queryTemplate: "funding", results: [] },
      {
        queryTemplate: "competitors",
        results: [
          {
            title: "Warehouse robotics software: fleet managers everywhere, debuggers nowhere",
            url: "https://stackreview.example/warehouse-robotics-tooling-2026",
            content:
              "Every warehouse-automation vendor ships a proprietary fleet manager, but cross-vendor debugging and incident-replay tooling barely exists — most integrators roll their own log pipelines. Analysts flag vendor-neutral developer tools as an open niche as mixed-vendor robot fleets become the norm.",
            score: 0.83,
          },
        ],
      },
      {
        queryTemplate: "github",
        results: [
          {
            title: "Trending robotics repos this week",
            url: "https://osspulse.example/trending/robotics-2026-w21",
            content:
              "Trending this week in robotics: fleetmind by Jonas Eriksson gained roughly 900 stars in the week after winning the Nordic Robotics Hackathon autonomy track. Eriksson, formerly a robotics platform engineer at warehouse-automation firm Fraktbot Systems, is building the toolkit in the open under Parsec Robotics; early issues show adoption attempts from at least two logistics integrators.",
            score: 0.9,
          },
        ],
      },
    ],
  },

  // 7. Mosaic Memory — the axes-disagree demo (founder bullish, idea bear) ----
  {
    companyName: "Mosaic Memory",
    founderName: "Sofia Ortiz",
    sourceType: "inbound",
    deckText: `Mosaic Memory — pre-seed application (deck text export)

Problem
Everyone photographs everything and revisits almost nothing. The average phone holds thousands of photos that are never opened again; anniversaries and childhoods scroll past unmarked. The emotional value of a camera roll rounds to zero because turning it into something you would actually hold requires hours of work nobody does.

Product
Mosaic Memory turns a camera roll and voice notes into narrated keepsake books. Point it at a date range or a person; it clusters the moments, asks you three questions in your own voice-note style, and produces a printed or digital book with narration woven through the pages. Privacy-first: media processing happens on-device wherever possible, and nothing is used for training.

Team
Founder and CEO: Sofia Ortiz (Mexico City). Nine years at Brightloop, leaving as a staff engineer running the media-pipeline team of 14. Previously founded PixelFern, a photo-editing SDK acquired by Brightloop in 2023. Founding designer joined from Brightloop's creative-tools group.

Traction
- 4,200 beta users through a six-week invite-only private beta.
- 61% of beta users completed at least one book.
- 9% purchased a printed edition at $39.
- Waitlist of 11,000 from a single viral post.

Market
Memory-keeping is an ancient spend category — scrapbooking, photo books, framing — being remade by AI. We start with new parents, the segment with the highest photo volume and the strongest gifting motion, then expand to milestones and memorials.

Ask
Pre-seed to grow the founding team to four and launch publicly in North America and Mexico.`,
    fixtures: [
      {
        queryTemplate: "founder_company",
        results: [
          {
            title: "Brightloop acquires PixelFern to bolster its creative tools",
            url: "https://techdispatch.example/2023/brightloop-acquires-pixelfern",
            content:
              "Consumer-app giant Brightloop has acquired PixelFern, the photo-editing SDK startup founded by Sofia Ortiz. PixelFern's five-person team joins Brightloop's creative-tools division; terms were not disclosed, but sources describe a healthy outcome for the company's angel backers. Ortiz, a respected media-infrastructure engineer, stays on to lead pipeline work — now, three years later, she has left to found consumer app Mosaic Memory.",
            score: 0.95,
          },
          {
            title: "Sofia Ortiz leaves Brightloop to build Mosaic Memory",
            url: "https://mxbuilders.example/profiles/sofia-ortiz",
            content:
              "Profile of Sofia Ortiz, who spent nine years at Brightloop and left as a staff engineer running its 14-person media-pipeline team. Colleagues describe her as 'the person you gave the impossible latency bug to'. Her new startup, Mosaic Memory, turns camera rolls into narrated keepsake books — a return to the consumer-memory space where she started with PixelFern.",
            score: 0.91,
          },
        ],
      },
      {
        queryTemplate: "funding",
        results: [
          {
            title: "Consumer AI keepsake apps: high downloads, brutal retention",
            url: "https://appmarketwatch.example/keepsake-apps-retention",
            content:
              "Category analysis of AI memory and keepsake apps: installs are cheap, retention is not. Median day-30 retention across the category sits under 4%, paid conversion under 1%, and subscription fatigue is measurable in cohort data. Several funded entrants have already pivoted to B2B or shut down; investors we surveyed called the category 'a graveyard of beautiful demos'.",
            score: 0.93,
          },
        ],
      },
      {
        queryTemplate: "competitors",
        results: [
          {
            title: "Forty AI scrapbook apps launched this year — and two free incumbents own the shelf",
            url: "https://appmarketwatch.example/ai-scrapbook-crowding",
            content:
              "We counted more than forty AI scrapbooking and photo-book apps launched in the past twelve months, converging on near-identical features. Meanwhile the two dominant free memory features are bundled into the major phone platforms' photo apps, and print-on-demand margins are thin. Differentiation in this category has historically lasted one platform release cycle.",
            score: 0.9,
          },
        ],
      },
      {
        queryTemplate: "github",
        results: [
          {
            title: "Open-source spotlight: media-pipeline tools by Sofia Ortiz",
            url: "https://osspulse.example/spotlight/sofia-ortiz",
            content:
              "Spotlight on Sofia Ortiz's open-source work: her image-processing utilities, written during her Brightloop years and maintained since, are widely used in mobile media pipelines and known for meticulous benchmarks. A long, consistent commit history that reads like the resume of a systems engineer who happens to love photographs.",
            score: 0.85,
          },
        ],
      },
    ],
  },
];
