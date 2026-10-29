export type Sector =
  | "lodging"
  | "agriculture"
  | "energy"
  | "water"
  | "connectivity"
  | "education"
  | "healthcare";

export type Skill =
  | "building"
  | "guest-house"
  | "farming"
  | "cooking"
  | "front"
  | "power"
  | "water"
  | "internet"
  | "teaching"
  | "care";

export type CheckId =
  | "organizer"
  | "jtb"
  | "site-visit"
  | "parish-letter"
  | "rada"
  | "public-health"
  | "engineer"
  | "community";

export type CheckState = "yes" | "review" | "open";

export type WorkPreset = "day" | "few" | "week";

export type PathChoice = "investor" | "worker";

export type Town = {
  id: string;
  name: string;
};

export type Parish = {
  id: string;
  name: string;
  towns: Town[];
};

export type Check = {
  id: CheckId;
  state: CheckState;
};

export type Country = {
  id: string;
  name: string;
  regionId: string;
  currency: string;
  cities: Town[];
};

export type User = {
  id: string;
  name: string;
  role: PathChoice;
  countryId: string;
  parishId: string | null;
  townId: string;
  verified: boolean;
  skill: Skill | null;
  extraSkills: Skill[];
  proofLabel: string | null;
  example: string;
};

export type Project = {
  id: string;
  name: string;
  countryId: string;
  parishId: string | null;
  townId: string;
  sector: Sector;
  summary: string;
  whatYouGet: string;
  goalJmd: number;
  committedJmd: number;
  workersMatched: number;
  workersNeeded: number;
  weeklyPayout: number;
  workStarted: boolean;
  organizerName: string;
  organizerId: string | null;
  needs: Skill[];
  checks: Check[];
  team: string[];
  /** Experienced organizers mentor new ones, matched by sector and parish. */
  mentorName?: string | null;
  kind?: string | null;
  site?: SiteStatus | null;
  readiness?: Readiness;
};

export type ChainId = "bitcoin-signet" | "base-sepolia";

export type PaymentAsset = "BTC" | "USDC";

export type PaymentKind = "capital-in" | "pay-out";

export type PaymentStatus = "pending" | "confirmed" | "mismatch";

export type Wallet = {
  id: string;
  userId: string;
  chain: ChainId;
  address: string;
  label: string;
  verifiedAt: string | null;
  createdAt: string;
};

export type ProjectWallet = {
  projectId: string;
  chain: ChainId;
  address: string;
};

export type Payment = {
  id: string;
  projectId: string;
  kind: PaymentKind;
  chain: ChainId;
  txId: string;
  fromAddress: string;
  toAddress: string;
  asset: PaymentAsset;
  amount: number;
  confirmations: number;
  status: PaymentStatus;
  commitmentId: string | null;
  contributionId: string | null;
  reason: string | null;
  checkedAt: string;
  createdAt: string;
};

export type CommitmentStatus = "pledged" | "accepted";

export type Commitment = {
  id: string;
  userId: string;
  projectId: string;
  amountJmd: number;
  status: CommitmentStatus;
  createdAt: string;
  /** When this commitment starts to count. Absent means it can count now. */
  countsAt?: string | null;
};

export type ContributionStatus = "logged" | "accepted";

export type Contribution = {
  id: string;
  userId: string;
  projectId: string;
  skill: Skill;
  preset: WorkPreset;
  status: ContributionStatus;
  createdAt: string;
};

export type RequestStatus = "open" | "team-ready" | "closed";

export type SiteStatus = "own" | "lease" | "permission" | "not-yet";

export type ReadinessState = "have" | "working" | "not-yet";

export type Readiness = Record<string, ReadinessState>;

export type CapitalRequest = {
  id: string;
  userId: string;
  countryId: string;
  parishId: string | null;
  townId: string;
  sector: Sector;
  budget: number;
  workersNeeded: number;
  skills: Skill[];
  note: string;
  status: RequestStatus;
  projectId: string | null;
  createdAt: string;
  kind?: string | null;
  site?: SiteStatus | null;
  readiness?: Readiness;
};

export type ApplicationOrigin = "applied" | "invited";

export type ApplicationStatus = "waiting" | "accepted" | "declined";

export type Application = {
  id: string;
  requestId: string | null;
  projectId: string | null;
  workerId: string;
  skill: Skill;
  message: string;
  origin: ApplicationOrigin;
  status: ApplicationStatus;
  createdAt: string;
};

export type Availability = {
  id: string;
  userId: string;
  countryId: string;
  parishId: string | null;
  townId: string;
  skills: Skill[];
  note: string;
  createdAt: string;
};

export type Seed = {
  parishes: Parish[];
  countries: Country[];
  users: User[];
  projects: Project[];
  commitments: Commitment[];
  contributions: Contribution[];
  requests: CapitalRequest[];
  applications: Application[];
  availability: Availability[];
};

export type AiNote = {
  title: string;
  body: string;
};
